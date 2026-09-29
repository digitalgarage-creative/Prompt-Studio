const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('prompt-studio.html','utf8');
const source=html.match(/<script>([\s\S]*)<\/script>/)[1].split('S.lang = getLang();')[0];
const ctx=vm.createContext({console,localStorage:{getItem:()=>null},document:{addEventListener:()=>{}},window:{}});
vm.runInContext(source,ctx);
vm.runInContext(`
S.lang='en'; S.content='poster'; S.form={describe:'A poster',imagePurpose:'Phone viewing',imageRelationships:'Bag right',imageChecks:'One bag; Full strap'}; S.refs={}; S.chips={}; S.colors={}; S.toggles={};
`,ctx);
let prompt=vm.runInContext('buildPrompt()',ctx); assert(prompt.includes('Phone viewing'));assert(prompt.includes('Bag right'));assert(prompt.includes('One bag; Full strap'));
vm.runInContext(`S.refs={refs:[{type:'url',value:'https://example.com/a.png',use:'Layout / composition',borrow:'spacing only',ignore:'all lettering'}]}`,ctx);
prompt=vm.runInContext('buildPrompt()',ctx);assert(prompt.includes('spacing only'));assert(prompt.includes('all lettering'));assert(prompt.includes('omit guide lines'));
vm.runInContext(`S.content='imageedit'; S.form={changes:'Black cap',keep:'Label',editAllow:'Cap reflection'}; S.refs={};`,ctx);
prompt=vm.runInContext('buildPrompt()',ctx);assert(prompt.includes('Cap reflection'));assert(prompt.includes('Label'));
assert.equal(vm.runInContext('buildRepairPrompt()',ctx),'');
vm.runInContext(`S.form.repairChange='Fix strap';S.form.repairPreserve='Label';S.form.repairAllow='Shadow';`,ctx);
prompt=vm.runInContext('buildRepairPrompt()',ctx);assert(prompt.includes('Fix strap'));assert(prompt.includes('Preserve: Label'));assert(prompt.includes('Allow: Shadow'));
vm.runInContext(`S.lang='ja'`,ctx);assert(vm.runInContext('buildRepairPrompt()',ctx).includes('変更：'));
for(const id of vm.runInContext('CONTENT_TYPES.map(c=>c.id)',ctx)) {vm.runInContext(`S.content=${JSON.stringify(id)};S.form={};S.refs={};S.chips={};S.colors={};S.toggles={};`,ctx);vm.runInContext('buildPrompt()',ctx);assert.equal(vm.runInContext('resolveFields(CONTENT_TYPES.find(c=>c.id===S.content)).filter(f=>f.id==="imageChecks").length',ctx),1);}
console.log('Prompt regressions passed across all content types, reference roles, repair prompts and Japanese.');

// Every generation mode emits its specific professional persona in both languages.
for (const lang of ['en', 'ja']) {
  vm.runInContext(`S.lang=${JSON.stringify(lang)}`, ctx);
  for (const id of vm.runInContext('CONTENT_TYPES.map(c=>c.id)', ctx)) {
    vm.runInContext(`S.content=${JSON.stringify(id)};S.form={};S.refs={};S.chips={};S.colors={};S.toggles={};`, ctx);
    const result = vm.runInContext('buildPrompt()', ctx);
    const persona = vm.runInContext(`GENERATION_PERSONAS[${JSON.stringify(id)}][${JSON.stringify(lang)}]`, ctx);
    const execution = vm.runInContext(`PERSONA_EXECUTION[${JSON.stringify(lang)}]`, ctx);
    assert(result.startsWith(persona), `${lang}: missing opening persona for ${id}`);
    assert(result.includes(execution), `${lang}: missing persona execution instruction for ${id}`);
  }
}
assert.equal(vm.runInContext('Object.keys(GENERATION_PERSONAS).length', ctx), vm.runInContext('CONTENT_TYPES.length', ctx));
console.log('All generation modes emit their dedicated persona in English and Japanese.');

// Every visible style has distinct positive and negative guidance that reaches the prompt.
const visibleStyles = vm.runInContext('[...STYLE_GROUPS.featured,...STYLE_GROUPS.more,...STYLE_GROUPS.other]', ctx);
assert.equal(new Set(visibleStyles).size, visibleStyles.length, 'duplicate style name in picker');
const guidance = visibleStyles.map(style => vm.runInContext(`ILLUSTRATION_STYLES[${JSON.stringify(style)}]`, ctx));
guidance.forEach((entry, index) => {
  assert(entry, `missing registry entry for ${visibleStyles[index]}`);
  assert(entry.description?.trim(), `missing description for ${visibleStyles[index]}`);
  assert(entry.inject?.trim(), `missing positive guidance for ${visibleStyles[index]}`);
  assert(entry.avoid?.trim(), `missing negative guidance for ${visibleStyles[index]}`);
});
assert.equal(new Set(guidance.map(entry => entry.inject)).size, visibleStyles.length, 'duplicate positive style guidance');
assert.equal(new Set(guidance.map(entry => entry.avoid)).size, visibleStyles.length, 'duplicate negative style guidance');
for (const lang of ['en', 'ja']) {
  for (const style of visibleStyles) {
    vm.runInContext(`S.lang=${JSON.stringify(lang)}; S.content='illustration'; S.form={mainVisual:'A tiny garden'}; S.chips={style:[${JSON.stringify(style)}]}; S.refs={}; S.colors={}; S.toggles={helpDecide:true};`, ctx);
    const result = vm.runInContext('buildPrompt()', ctx);
    const direction = vm.runInContext(`t(ILLUSTRATION_STYLES[${JSON.stringify(style)}].inject)`, ctx);
    const avoid = vm.runInContext(`t(ILLUSTRATION_STYLES[${JSON.stringify(style)}].avoid)`, ctx);
    assert(result.includes(direction), `${lang}: missing positive guidance for ${style}`);
    assert(result.includes(avoid), `${lang}: missing negative guidance for ${style}`);
    if (lang === 'ja') {
      assert.notEqual(direction, vm.runInContext(`ILLUSTRATION_STYLES[${JSON.stringify(style)}].inject`, ctx), `missing Japanese positive guidance for ${style}`);
      assert.notEqual(avoid, vm.runInContext(`ILLUSTRATION_STYLES[${JSON.stringify(style)}].avoid`, ctx), `missing Japanese negative guidance for ${style}`);
    }
  }
}
console.log(`All ${visibleStyles.length} visible illustration styles have distinct guidance in English and Japanese.`);

// Every visible style participates in the local recommendation matcher.
const signalStyles = vm.runInContext('Object.keys(STYLE_RECOMMENDATION_SIGNALS)', ctx);
assert.deepEqual([...signalStyles].sort(), [...visibleStyles].sort(), 'recommendation signals must cover the exact visible style catalog');
for (const style of visibleStyles) {
  assert(vm.runInContext(`STYLE_RECOMMENDATION_SIGNALS[${JSON.stringify(style)}].length >= 3`, ctx), `too few recommendation signals for ${style}`);
}
const matcherVocabulary = vm.runInContext('JSON.stringify({direct:STYLE_RECOMMENDATION_SIGNALS,concept:STYLE_CONCEPT_RULES})', ctx).toLowerCase();
assert(matcherVocabulary.includes('studio ghibli'), 'studio references requested by the user must be retained');
for (const artist of ['makoto shinkai', 'h. r. giger', 'charley harper', 'mary blair']) {
  assert(!matcherVocabulary.includes(artist), `individual artist reference should not enter matcher vocabulary: ${artist}`);
}
assert(!vm.runInContext(`STYLE_RECOMMENDATION_SIGNALS['Botanical Illustration'].includes('plant')`, ctx));
assert(!vm.runInContext(`STYLE_RECOMMENDATION_SIGNALS['Infographic'].includes('data')`, ctx));
const recommendedNames = description => Array.from(vm.runInContext(`recommendIllustrationStyles(${JSON.stringify(description)}).map(result => result.style)`, ctx));
assert.equal(recommendedNames('A botanically accurate plant specimen showing roots, leaves and petals')[0], 'Botanical Illustration');
assert.equal(recommendedNames('A tiny 16-bit game sprite with deliberately visible pixels')[0], 'Pixel Art');
assert.equal(recommendedNames('An elongated runway figure presenting a detailed garment study')[0], 'Fashion Illustration');
assert(recommendedNames('根と葉と花弁を正確に描いた植物標本').includes('Botanical Illustration'));
const cityBrief = 'A city that is a mixture of Tokyo and Thailand. The architecture combines modern and ancient buildings, Japanese pagodas, Thai palace colours, towers and bridges. It is a grand city, but I do not want a busy illustration.';
assert.deepEqual(recommendedNames(cityBrief), ['Concept Art', 'Travel Journal Watercolour', 'Minimalism']);
assert.equal(recommendedNames('A cat sitting beside a window')[0], 'Storybook');
assert.equal(recommendedNames('A red ball on a table').length, 3, 'a detailed unmatched subject should receive versatile fallback styles');
assert.equal(recommendedNames('No anime. Use a rough pencil drawing with visible construction lines.')[0], 'Pencil Sketch');
assert(!recommendedNames('No anime. Use a rough pencil drawing with visible construction lines.').includes('Anime Key Visual'), 'negated styles must not be recommended');
assert.deepEqual(recommendedNames('Avoid watercolour; make a bold screen print concert poster.'), ['Screen Print']);
assert(!recommendedNames('No watercolour. A red ball on a table.').includes('Watercolour'), 'fallbacks must respect rejected styles');
assert(!recommendedNames('Pastel colours for a clean modern app interface.').includes('Pastel'), 'a colour palette must not imply the pastel medium');
assert.equal(recommendedNames('A soft pastel drawing of dancers at dusk.')[0], 'Pastel');
assert.equal(recommendedNames('Flowers and gardens beside old buildings.')[0], 'Botanical Illustration');
assert(!recommendedNames('A happy party inside a Chrome browser window.').includes('Liquid Chrome'), 'browser names must not imply chrome material');
assert(!recommendedNames('Tokyo architecture and bridges with no anime styling.').includes('Anime Key Visual'), 'a location must not override an explicit style rejection');
assert.equal(recommendedNames('スタジオジブリ風の森と空')[0], 'Anime Key Visual');
assert.equal(recommendedNames('アニメにしないで、鉛筆画にしてください')[0], 'Pencil Sketch');
vm.runInContext(`S.chips={style:['Gouache']}; recommendIllustrationStyles('A 16-bit game sprite');`, ctx);
assert.deepEqual(Array.from(vm.runInContext('S.chips.style', ctx)), ['Gouache'], 'recommendations must not auto-select a style');
console.log('Style recommendations cover the full catalog, rank representative prompts, and never auto-select.');

// Selecting a new illustration style replaces the previous selection directly.
vm.runInContext(`document.querySelectorAll=()=>[]; document.getElementById=()=>null; S.content='illustration'; S.chips={style:['Wabi-sabi']}; selectQuick('style','Liquid Chrome');`, ctx);
assert.deepEqual(Array.from(vm.runInContext('S.chips.style', ctx)), ['Liquid Chrome']);
vm.runInContext(`selectQuick('style','Frosted Glass');`, ctx);
assert.deepEqual(Array.from(vm.runInContext('S.chips.style', ctx)), ['Frosted Glass']);
vm.runInContext(`selectQuick('style','');`, ctx);
assert.equal(vm.runInContext('S.chips.style.length', ctx), 0);
assert(html.includes(`onclick="selectQuick('\${f.id}',this.dataset.val)"><strong>\${esc(t(o))}</strong>`));
console.log('Illustration styles replace the previous selection and can be cleared.');

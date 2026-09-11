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

// Every requested preset is selectable, localized, and contributes actual guidance.
const newStyles = vm.runInContext('Object.keys(EXTENDED_ILLUSTRATION_STYLES)', ctx);
assert.equal(newStyles.length, 23);
for (const lang of ['en', 'ja']) {
  for (const style of newStyles) {
    vm.runInContext(`S.lang=${JSON.stringify(lang)}; S.content='illustration'; S.form={mainVisual:'A tiny garden'}; S.chips={style:[${JSON.stringify(style)}]}; S.refs={}; S.colors={}; S.toggles={helpDecide:true};`, ctx);
    const result = vm.runInContext('buildPrompt()', ctx);
    const direction = vm.runInContext(`t(EXTENDED_ILLUSTRATION_STYLES[${JSON.stringify(style)}].inject)`, ctx);
    assert(result.includes(direction), `${lang}: missing guidance for ${style}`);
    assert(vm.runInContext(`resolveFields(CONTENT_TYPES.find(c=>c.id==='illustration')).find(f=>f.id==='style').groups.flatMap(g=>g.options).includes(${JSON.stringify(style)})`, ctx));
    if (lang === 'ja') assert.notEqual(direction, vm.runInContext(`EXTENDED_ILLUSTRATION_STYLES[${JSON.stringify(style)}].inject`, ctx));
  }
}
console.log('All 23 illustration presets are selectable and compile in English and Japanese.');

// Selecting a new illustration style replaces the previous selection directly.
vm.runInContext(`document.querySelectorAll=()=>[]; document.getElementById=()=>null; S.content='illustration'; S.chips={style:['Wabi-sabi']}; selectQuick('style','Liquid Chrome');`, ctx);
assert.deepEqual(Array.from(vm.runInContext('S.chips.style', ctx)), ['Liquid Chrome']);
vm.runInContext(`selectQuick('style','Frosted Glass');`, ctx);
assert.deepEqual(Array.from(vm.runInContext('S.chips.style', ctx)), ['Frosted Glass']);
vm.runInContext(`selectQuick('style','');`, ctx);
assert.equal(vm.runInContext('S.chips.style.length', ctx), 0);
assert(html.includes(`onclick="selectQuick('\${f.id}',this.dataset.val)"><strong>\${esc(t(o))}</strong>`));
console.log('Illustration styles replace the previous selection and can be cleared.');

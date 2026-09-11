const { copyFileSync, writeFileSync } = require('node:fs');

// Keep the existing filename working while also serving the site root.
copyFileSync('dist/prompt-studio.html', 'dist/index.html');
writeFileSync('dist/.nojekyll', '');

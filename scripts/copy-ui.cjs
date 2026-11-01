const fs = require('node:fs');
fs.rmSync('dist/ui', {recursive:true, force:true});
fs.cpSync('src/ui', 'dist/ui', { recursive: true });
fs.rmSync('dist/gemini-worker.mjs', { force: true });

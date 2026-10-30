const fs = require('node:fs');
fs.cpSync('src/ui', 'dist/ui', { recursive: true });
fs.rmSync('dist/gemini-worker.mjs', { force: true });

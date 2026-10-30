const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const result=spawnSync(process.execPath,[
  '--test','--experimental-test-coverage',
  '--test-coverage-include=dist/**','--test-coverage-include=src/ui/presentation.js',
  '--test-coverage-lines=85','--test-coverage-branches=80','--test-coverage-functions=85',
  'test/*.test.cjs'
],{encoding:'utf8'});
const report=(result.stdout||'')+(result.stderr||'');
fs.mkdirSync('test-results',{recursive:true});
fs.writeFileSync('test-results/coverage.txt',report);
process.stdout.write(report);
if(result.error)console.error(result.error.message);
process.exitCode=result.status??1;

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {findCli,cliEnvironment}=require('../dist/cli');

test('CLI discovery prefers native executables and preserves the caller environment',t=>{
  const before=process.env.PATH;
  t.mock.method(fs,'existsSync',file=>file===path.join(cliEnvironment().PATH.split(path.delimiter)[0],process.platform==='win32'?'claude.exe':'claude'));
  const cli=findCli('claude');
  assert.deepEqual(cli.args,[]);
  assert.equal(cli.env.PATH,cliEnvironment().PATH);
  assert.equal(process.env.PATH,before);
});

test('npm CLI entrypoints run through Node mode instead of shell interpolation',t=>{
  t.mock.method(fs,'existsSync',file=>file.replaceAll('\\','/').endsWith('@openai/codex/bin/codex.js'));
  const cli=findCli('codex');
  assert.equal(cli.file,process.execPath);
  assert.equal(cli.env.ELECTRON_RUN_AS_NODE,'1');
  assert.equal(cli.args.length,1);
  assert.match(cli.args[0],/codex\.js$/);
});

test('Windows Codex starts the official npm binary directly rather than a visible grandchild', {skip:process.platform!=='win32'},t=>{
  for(const layout of ['nested','hoisted','legacy']){
    t.mock.restoreAll();
    const root=path.join(require('node:os').homedir(),'AppData/Roaming/npm/node_modules'),triple=process.arch==='arm64'?'aarch64-pc-windows-msvc':'x86_64-pc-windows-msvc';
    const vendor=layout==='nested'?path.join(root,'@openai/codex/node_modules/@openai',`codex-win32-${process.arch}`,'vendor'):layout==='hoisted'?path.join(root,'@openai',`codex-win32-${process.arch}`,'vendor'):path.join(root,'@openai/codex/vendor');
    const binary=path.join(vendor,triple,'bin','codex.exe');
    t.mock.method(fs,'existsSync',file=>file===binary||file===path.join(root,'@openai/codex/bin/codex.js'));
    const cli=findCli('codex');assert.equal(cli.file,binary);assert.deepEqual(cli.args,[]);
  }
});

test('missing official CLI produces an actionable error for either provider',t=>{
  t.mock.method(fs,'existsSync',()=>false);
  for(const provider of ['claude','codex'])assert.throws(()=>findCli(provider),e=>e.code==='missing_cli'&&/官方 CLI/.test(e.message));
});

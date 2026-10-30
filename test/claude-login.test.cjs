const {test}=require('node:test');
const assert=require('node:assert/strict');
const {ClaudeLogin}=require('../dist/claude-login');
const command=script=>()=>({file:process.execPath,args:['-e',script,'--'],env:process.env});

test('Claude child login validates authorization codes and completes through stdin',async()=>{
  const login=new ClaudeLogin(command("console.log('Paste code here');process.stdin.on('data',v=>process.exit(v.toString().trim()==='TEST-CODE'?0:1))"));
  assert.throws(()=>login.submitCode('TEST-CODE'),/沒有等待授權碼/);
  let ready;
  const waiting=new Promise(r=>ready=r);
  const job=login.start(info=>{if(info.codeRequired)ready()},5000);
  await waiting;
  await assert.rejects(login.start(()=>{}),/正在進行中/);
  for(const invalid of [null,'bad\ncode','x'.repeat(4097),''])assert.throws(()=>login.submitCode(invalid),/完整授權碼/);
  login.submitCode(' TEST-CODE ');
  await job;
  assert.throws(()=>login.submitCode('TEST-CODE'),/沒有等待授權碼/);
  login.close();
});

test('Claude login cancellation and timeout terminate the pending child',async()=>{
  for(const cancel of [true,false]){
    const login=new ClaudeLogin(command('setInterval(()=>{},1000)'));
    const job=login.start(()=>{},cancel?5000:30);
    const rejection=assert.rejects(job,cancel?/已取消/:/逾時/);
    if(cancel)login.close();
    await rejection;
  }
});

test('Claude process failures return sanitized errors',async()=>{
  const failed=new ClaudeLogin(command("console.error('SECRET');process.exit(1)"));
  await assert.rejects(failed.start(()=>{},5000),e=>e.code==='auth'&&!e.message.includes('SECRET'));
  const absent=new ClaudeLogin(()=>({file:'quota-island-nonexistent-executable',args:[],env:process.env}));
  await assert.rejects(absent.start(()=>{},5000),e=>e.code==='missing_cli');
});

test('a code submission that never completes times out and can start again',async()=>{
  const login=new ClaudeLogin(command("console.log('Paste code here');process.stdin.on('data',()=>{});setInterval(()=>{},1000)"),35);
  for(let attempt=0;attempt<2;attempt++){
    let prompt;const waiting=new Promise(resolve=>prompt=resolve);
    const job=login.start(info=>{if(info.codeRequired)prompt()},5000);
    const rejected=assert.rejects(job,/授權碼驗證逾時/);
    await waiting;login.submitCode('TEST-CODE');
    assert.throws(()=>login.submitCode('TEST-CODE'),/沒有等待授權碼/);
    await rejected;
  }
});

test('canceling verification settles login and unrelated output does not reuse an old code prompt',async()=>{
  const login=new ClaudeLogin(command("console.log('Paste code here');process.stdin.on('data',()=>console.log('Processing'));setInterval(()=>{},1000)"),5000);
  let prompt,seen=0;const waiting=new Promise(resolve=>prompt=resolve);
  const job=login.start(info=>{if(info.codeRequired){seen++;prompt()}},5000);
  const rejected=assert.rejects(job,/已取消/);
  await waiting;login.submitCode('TEST-CODE');await new Promise(resolve=>setTimeout(resolve,60));
  assert.equal(seen,1);login.close();await rejected;
});

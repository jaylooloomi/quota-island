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

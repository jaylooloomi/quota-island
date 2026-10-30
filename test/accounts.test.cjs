const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Accounts}=require('../dist/accounts'),{ProviderError}=require('../dist/model');
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pebble-accounts-')),services=new Map();
  const factory=dir=>{const s={dir,value:20,reads:0,signedOut:false,limited:false,read:async()=>{s.reads++;if(s.signedOut)throw new ProviderError('auth','signed out');if(s.limited)throw new ProviderError('rate_limit','cooldown',60000);return {provider:'claude',plan:'Pro',source:'fixture',windows:[{id:'seven_day',label:'每週',usedPercent:s.value,resetsAt:'2099-01-01T00:00:00Z'}]};},login:async(_id,_open,progress)=>{progress({codeRequired:true});s.signedOut=false;},submitCode:()=>{s.submitted=true;},cancelLogin:()=>{s.cancelled=true;},logout:async()=>{s.signedOut=true;},close:()=>{s.closed=true;}};services.set(path.basename(dir),s);return s;};
  const create=()=>new Accounts(root,factory,async()=>{},()=>{},()=>{});return {root,services,create,cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('independent Claude profiles poll in parallel and preserve per-account settings across restart',async()=>{
  const f=fixture();let a=f.create();try{
    const x=a.add('Claude 工作'),y=a.add('Claude 個人');assert.notEqual(x,y);assert.notEqual(f.services.get(x).dir,f.services.get(y).dir);
    assert.throws(()=>a.add('Claude 工作'));
    f.services.get(x).value=12;f.services.get(y).value=45;await a.tick();
    let state=a.snapshot();assert.equal(state.providers[x].reading.windows[0].usedPercent,12);assert.equal(state.providers[y].reading.windows[0].usedPercent,45);
    assert.equal(state.reservePercent[x],5);assert.equal(state.reservePercent[y],5);
    a.patch({reservePercent:{[x]:20,[y]:-1},visible:{[y]:false},paceWindows:{[x]:'seven_day'}});a.close();a=f.create();state=a.snapshot();
    assert.equal(state.accounts.length,2);assert.equal(state.reservePercent[x],20);assert.equal(state.reservePercent[y],5);assert.equal(state.visible[y],false);assert.equal(state.paceWindows[x],'seven_day');
    await a.login(x);a.submit(x,'TEST');await a.reopen(x);a.cancel(x);assert.equal(f.services.get(x).submitted,true);assert.equal(f.services.get(x).cancelled,true);
    await a.logout(x);assert.equal(a.snapshot().providers[x].reading,null);assert.equal(a.snapshot().enabled[x],false);assert.equal(a.snapshot().enabled[y],true);
    await a.tick(true);assert.equal(a.snapshot().providers[x].reading,null);await a.login(x);assert.equal(a.snapshot().enabled[x],true);
    await a.remove(x);assert.equal(a.has(x),false);assert.equal(fs.existsSync(f.services.get(x).dir),false);assert.equal(a.has(y),true);
    assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(path.join(f.root,'accounts.json'),'utf8'))).includes('accessToken'),false);
  }finally{a.close();f.cleanup();}
});
test('rate limits remain isolated per account and survive restarting monitoring',async()=>{
  const f=fixture();let a=f.create();try{
    const x=a.add('limited'),y=a.add('working');f.services.get(x).limited=true;await a.tick();
    assert.equal(a.snapshot().providers[x].status,'unavailable');assert.equal(a.snapshot().providers[y].status,'ready');
    a.close();a=f.create();await a.tick(true);assert.equal(f.services.get(x).reads,0);assert.equal(f.services.get(y).reads,1);
    a.patch({enabled:{[y]:false}});assert.equal(a.snapshot().enabled[y],false);
  }finally{a.close();f.cleanup();}
});
test('profile input never chooses arbitrary filesystem paths',async()=>{
  const f=fixture();let a=f.create();try{
    for(const value of ['',null,'x'.repeat(25),'bad\nname'])assert.throws(()=>a.add(value));
    assert.equal(a.has('../outside'),false);await assert.rejects(a.remove('../outside'));
    a.close();fs.writeFileSync(path.join(f.root,'accounts.json'),JSON.stringify([{id:'../outside',label:'evil'},{id:'claude-account-00000000-0000-0000-0000-000000000000',label:''}]));a=f.create();assert.equal(a.snapshot().accounts.length,0);
  }finally{a.close();f.cleanup();}
});

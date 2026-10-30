const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {MorningHello,taipeiClock}=require('../dist/morning-hello'),{helloCommand,sendClaudeHello}=require('../dist/hello-command');
const {ProviderError}=require('../dist/model');
function setup(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pebble hello '));let now=Date.parse('2026-11-01T00:00:00Z'),sent=[];const file=path.join(dir,'runs.json');const create=(send=async id=>{sent.push(id);})=>new MorningHello(file,send,()=>{},()=>now);const state=()=>({enabled:true,status:'ready',reading:{windows:[{id:'five_hour',usedPercent:0,resetsAt:null},{id:'seven_day',usedPercent:15,resetsAt:'2026-11-04T00:00:00Z'}]},updatedAt:new Date(now).toISOString(),nextPollAt:now+120000});return {dir,file,sent,create,state,get now(){return now;},set now(v){now=v;},close:()=>fs.rmSync(dir,{recursive:true,force:true})};}
test('08:00 Taiwan sends once per eligible Claude profile across concurrent ticks and restart',async()=>{
 const f=setup();try{const id='claude-account-00000000-0000-0000-0000-000000000001',c=[{id:'claude',state:f.state()},{id,state:f.state()}],a=f.create();await Promise.all([a.tick(true,'08:00',c),a.tick(true,'08:00',c)]);assert.deepEqual(f.sent,['claude',id]);await f.create().tick(true,'08:00',c);assert.equal(f.sent.length,2);assert.equal(a.snapshot().claude.status,'sent');
 const updated=f.state();updated.updatedAt=new Date(f.now+1000).toISOString();updated.reading.windows[0].resetsAt=new Date(f.now+5*3600000).toISOString();await a.tick(true,'08:00',[{id:'claude',state:updated}]);assert.equal(a.snapshot().claude.status,'confirmed');
 }finally{f.close();}
});
test('time zone, disabled schedule, paused app and four-hour catch-up boundaries',async()=>{
 const f=setup();try{assert.deepEqual(taipeiClock(Date.parse('2026-10-31T16:05:00Z')),{day:'2026-11-01',minute:5});const a=f.create(),c=()=>[{id:'claude',state:f.state()}];f.now-=60000;await a.tick(true,'08:00',c());assert.equal(f.sent.length,0);f.now+=60000;await a.tick(false,'08:00',c());await a.tick(true,'08:00',c(),true);await a.tick(true,'99:99',c());assert.equal(f.sent.length,0);f.now+=4*3600000;await a.tick(true,'08:00',c());assert.equal(f.sent.length,0);f.now-=60000;await a.tick(true,'08:00',c());assert.equal(f.sent.length,1);
 }finally{f.close();}
});
test('active windows skip while unavailable, limited, logged-out, stale and exhausted profiles never send',async()=>{
 const f=setup();try{const a=f.create(),active=f.state();active.reading.windows[0].resetsAt=new Date(f.now+3600000).toISOString();await a.tick(true,'08:00',[{id:'claude',state:active}]);assert.equal(a.snapshot().claude.status,'active');assert.equal(f.sent.length,0);
 let index=10;for(const patch of [{enabled:false},{status:'signed_out'},{status:'unavailable',errorCode:'rate_limit'},{status:'stale'},{refreshing:true},{updatedAt:'invalid'},{updatedAt:new Date(f.now-11*60000).toISOString()}]){const next=f.create(),id='claude-account-00000000-0000-0000-0000-'+String(index++).padStart(12,'0');await next.tick(true,'08:00',[{id,state:{...f.state(),...patch}}]);assert.equal(f.sent.length,0);assert.equal(next.snapshot()[id],undefined);}
 const blocked=f.state();blocked.reading.windows[1].usedPercent=100;await a.tick(true,'08:00',[{id:'codex',state:f.state()},{id:'claude-account-00000000-0000-0000-0000-000000000002',state:blocked}]);assert.equal(f.sent.length,0);
 }finally{f.close();}
});
test('ambiguous process failures and interrupted runs never resend on restart',async()=>{
 const f=setup();try{const a=f.create(async()=>{f.sent.push('attempt');throw new ProviderError('network','private error');});await a.tick(true,'08:00',[{id:'claude',state:f.state()}]);assert.equal(a.snapshot().claude.status,'error');await f.create().tick(true,'08:00',[{id:'claude',state:f.state()}]);assert.equal(f.sent.length,1);
 fs.writeFileSync(f.file,JSON.stringify({claude:{day:'2026-11-01',status:'sending',at:new Date(f.now).toISOString()}}));const next=f.create();await next.tick(true,'08:00',[{id:'claude',state:f.state()}]);assert.equal(next.snapshot().claude.status,'uncertain');assert.equal(f.sent.length,1);
 }finally{f.close();}
});
test('failed durable claim cannot send and next calendar day may run again',async()=>{
 const f=setup();try{fs.writeFileSync(f.file,'blocked');const blocked=new MorningHello(path.join(f.file,'child'),async()=>{throw Error('must not run');},()=>{},()=>f.now);await blocked.tick(true,'08:00',[{id:'claude',state:f.state()}]);assert.equal(blocked.snapshot().claude.code,'storage');
 fs.rmSync(f.file);const a=f.create();await a.tick(true,'08:00',[{id:'claude',state:f.state()}]);f.now+=86400000;await a.tick(true,'08:00',[{id:'claude',state:f.state()}]);assert.equal(f.sent.length,2);
 }finally{f.close();}
});
test('Hello CLI uses subscription profile, no tools, no hooks, no MCP and no API key fallback',async()=>{
 const f=setup();try{const cmd={file:process.execPath,args:[path.join(__dirname,'fixtures/hello-cli.cjs')],env:{...process.env,CLAUDE_CONFIG_DIR:f.dir,ANTHROPIC_API_KEY:'SECRET',CLAUDE_CODE_OAUTH_TOKEN:'SECRET',CLAUDECODE:'1'}},spec=helloCommand(cmd,path.join(f.dir,'work'));
 assert.equal(spec.options.windowsHide,true);assert.equal(spec.options.env.ANTHROPIC_API_KEY,undefined);assert.equal(spec.options.env.CLAUDE_CODE_OAUTH_TOKEN,undefined);assert.equal(spec.options.env.CLAUDE_CONFIG_DIR,f.dir);assert.ok(spec.args.includes('--no-session-persistence'));assert.equal(spec.args[spec.args.indexOf('--tools')+1],'');
 await assert.rejects(sendClaudeHello(cmd,f.dir,spec.options.cwd),{code:'auth'});fs.writeFileSync(path.join(f.dir,'.credentials.json'),JSON.stringify({claudeAiOauth:{accessToken:'fake-test-token'}}));await sendClaudeHello(cmd,f.dir,spec.options.cwd);assert.deepEqual(fs.readdirSync(spec.options.cwd),[]);
 }finally{f.close();}
});

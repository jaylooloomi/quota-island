const test=require('node:test'),assert=require('node:assert/strict');
const {taskSourceDiagnostics}=require('../dist/task-source-diagnostics');
test('diagnostics select metadata and never expose credentials, task text or device identifiers',()=>{
 const now=Date.now(),value=taskSourceDiagnostics({rows:[{provider:'codex',source:'rollout',status:'running',title:'PRIVATE_PROMPT',project:'PRIVATE_PATH',token:'PRIVATE_TOKEN'}],localSource:{available:true,checkedAt:now},remote:{enabled:true,error:'RPC_TIMEOUT',token:'PRIVATE_TOKEN',hosts:[{id:'PRIVATE_ID',name:'Work PC',online:true,state:'error',error:'RPC_TIMEOUT',counts:{running:0,unknown:3},checkedAt:now}] }},'1.29.2','Home PC');
 assert.equal(value.local.counts.running,1);assert.equal(value.remote.hosts[0].counts.unknown,3);assert.equal(value.remote.hosts[0].error,'RPC_TIMEOUT');assert.ok(!JSON.stringify(value).includes('PRIVATE_'));
});
test('malformed diagnostic fields are bounded and unknown fields omitted',()=>{
 const value=taskSourceDiagnostics({remote:{error:'secret with spaces',hosts:[{name:'x'.repeat(200),state:'INVALID',checkedAt:Infinity,counts:{running:-1,unknown:Infinity}}]}},'v','PC');assert.equal(value.remote.error,'');assert.equal(value.remote.hosts[0].name.length,80);assert.equal(value.remote.hosts[0].state,'unknown');assert.equal(value.remote.hosts[0].checkedAt,null);assert.equal(value.remote.hosts[0].counts.running,0);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Antigravity, parseAntigravity, localAntigravityStatus } = require('../dist/antigravity');
const payload = {userStatus:{planStatus:{planInfo:{planName:'Pro'}},cascadeModelConfigData:{clientModelConfigs:[
  {label:'Gemini Flash',quotaInfo:{remainingFraction:1,resetTime:'2026-11-01T00:00:00Z'}},
  {label:'Claude Sonnet',quotaInfo:{remainingFraction:.01}},
  {label:'Gemini Argon',quotaInfo:{remainingFraction:.2494,resetTime:'2026-11-02T00:00:00Z'}},
  {label:'GPT-OSS',quotaInfo:{remainingFraction:.5}},
  {label:'Gemini unknown',quotaInfo:{remainingFraction:null}},
  {label:'Gemini malformed',quotaInfo:{remainingFraction:'0.5'}},
]}}};
test('Antigravity uses only measured Gemini quotas, keeps exact percentages and selects most constrained first',()=>{
  const r=parseAntigravity(payload);
  assert.equal(r.windows.length,2);assert.equal(r.windows[0].label,'Gemini Argon');
  assert.equal(r.windows[0].usedPercent,75.06);assert.equal(r.windows[1].usedPercent,0);
  assert.equal(r.windows[0].resetsAt,'2026-11-02T00:00:00.000Z');assert.match(r.source,/Antigravity/);
  assert.ok(!r.windows.some(w=>/Claude|GPT/.test(w.label)));
});
test('Antigravity row identity is stable when the local server changes row order',()=>{
  const a=parseAntigravity(payload);
  const b=parseAntigravity({userStatus:{cascadeModelConfigData:{clientModelConfigs:[...payload.userStatus.cascadeModelConfigData.clientModelConfigs].reverse()}}});
  assert.deepEqual(a.windows.map(w=>w.id),b.windows.map(w=>w.id));
});
test('a wrong local listener does not hide a working Antigravity quota endpoint, and CSRF never leaves the adapter',async()=>{
  let calls=0;
  const adapter=new Antigravity(async()=>[{pid:1,token:'TEST-CSRF-SECRET',ports:[10001,10002]}],async(_candidate,port)=>{calls++;if(port===10001)throw new Error('not the RPC listener');return payload;});
  const reading=await adapter.read();assert.equal(calls,2);assert.ok(!JSON.stringify(reading).includes('TEST-CSRF-SECRET'));
});
test('unavailable and unknown Antigravity quotas are not rendered as zero',async()=>{
  assert.throws(()=>parseAntigravity({}),{code:'schema'});
  assert.throws(()=>parseAntigravity({userStatus:{cascadeModelConfigData:{clientModelConfigs:[{label:'Gemini',quotaInfo:{remainingFraction:null}}]}}}),{code:'schema'});
  await assert.rejects(new Antigravity(async()=>[]).read(),{code:'auth'});
  await assert.rejects(localAntigravityStatus({pid:1,token:'TEST',ports:[]},-1),{code:'network'});
});

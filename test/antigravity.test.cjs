const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Antigravity, parseAntigravity, parseAntigravitySummary, localAntigravityStatus } = require('../dist/antigravity');
const summary={response:{groups:[
  {displayName:'Gemini Models',buckets:[{bucketId:'gemini-weekly',window:'weekly',remainingFraction:.99,resetTime:'2026-11-03T00:00:00Z'},{bucketId:'gemini-5h',window:'5h',remainingFraction:1}]},
  {displayName:'Claude and GPT models',buckets:[{bucketId:'3p-weekly',window:'weekly',remainingFraction:.5},{bucketId:'3p-5h',window:'5h',remainingFraction:1}]},
  {displayName:'Gemini 4 Argon',buckets:[{bucketId:'argon-weekly',window:'weekly',remainingFraction:.25}]}
]}};
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
  const reading=await adapter.read();assert.ok(calls>=2);assert.ok(!JSON.stringify(reading).includes('TEST-CSRF-SECRET'));
});

test('group summaries preserve both model families and every real quota window',()=>{
  const reading=parseAntigravitySummary(summary,'Pro');
  assert.equal(reading.provider,'gemini');assert.equal(reading.plan,'Pro');assert.equal(reading.windows.length,5);
  assert.deepEqual(reading.windows.map(w=>100-w.usedPercent),[99,100,50,100,25]);
  assert.equal(reading.windows[2].group,'Claude and GPT models');
  assert.match(reading.windows[4].label,/Argon.*每週/);
  assert.equal(reading.windows[0].resetsAt,'2026-11-03T00:00:00.000Z');
});

test('partial group responses do not invent session allowances or accept malformed quotas',()=>{
  const reading=parseAntigravitySummary({groups:[null,{displayName:'Gemini Models',buckets:[null,{window:'weekly',remainingFraction:.7},{window:'5h',remainingFraction:null},{remainingFraction:1,enabled:false},{remainingFraction:'1'},{remainingFraction:2}]}]});
  assert.equal(reading.windows.length,1);assert.equal(reading.windows[0].usedPercent,30);
  assert.throws(()=>parseAntigravitySummary({groups:[]}),{code:'schema'});
});

test('adapter prefers real grouped summary and does not lose optional plan metadata',async()=>{
  const adapter=new Antigravity(async()=>[{pid:1,token:'TEST-SECRET',ports:[12345]}],async(_c,_p,method)=>method==='RetrieveUserQuotaSummary'?summary:payload);
  const reading=await adapter.read();assert.equal(reading.windows.length,5);assert.equal(reading.plan,'Pro');
  assert.ok(!JSON.stringify(reading).includes('TEST-SECRET'));
});

test('grouped quota requests can use the discovered local HTTP listener',async()=>{
  const http=require('node:http');
  const server=http.createServer((req,res)=>{
    assert.match(req.url,/RetrieveUserQuotaSummary$/);assert.equal(req.headers['x-codeium-csrf-token'],'TEST-TOKEN');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(summary));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const port=server.address().port;
    const value=await localAntigravityStatus({pid:1,token:'TEST-TOKEN',ports:[port]},port,'RetrieveUserQuotaSummary','http');
    assert.equal(parseAntigravitySummary(value).windows.length,5);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('a richer summary from another known account does not replace the app account',async()=>{
  const adapter=new Antigravity(async()=>[{pid:1,token:'A',ports:[1]},{pid:2,token:'B',ports:[2]}],async(c,_p,method)=>{
    if(method==='RetrieveUserQuotaSummary'){if(c.pid===1)throw Error('legacy app');return summary;}
    return {...payload,userStatus:{...payload.userStatus,email:c.pid===1?'app@example.test':'other@example.test'}};
  });
  const reading=await adapter.read();assert.equal(reading.windows.length,2);
  assert.ok(!JSON.stringify(reading).includes('@example.test'));
});
test('unavailable and unknown Antigravity quotas are not rendered as zero',async()=>{
  assert.throws(()=>parseAntigravity({}),{code:'schema'});
  assert.throws(()=>parseAntigravity({userStatus:{cascadeModelConfigData:{clientModelConfigs:[{label:'Gemini',quotaInfo:{remainingFraction:null}}]}}}),{code:'schema'});
  await assert.rejects(new Antigravity(async()=>[]).read(),{code:'auth'});
  await assert.rejects(localAntigravityStatus({pid:1,token:'TEST',ports:[]},-1),{code:'network'});
});

test('account switching rejects the old identity and automatically accepts only new-account quotas',async()=>{
  let email='first@example.invalid';
  const adapter=new Antigravity(async()=>[{pid:1,token:'private',ports:[1234]}],async(_candidate,_port,method)=>method==='RetrieveUserQuotaSummary'?summary:{userStatus:{email,planStatus:{planInfo:{planName:'Pro'}}}});
  await adapter.read();adapter.beginSwitch();
  await assert.rejects(adapter.read());assert.equal(adapter.waitingForAccount,true);
  email='second@example.invalid';const reading=await adapter.read();
  assert.equal(adapter.waitingForAccount,false);assert.equal(reading.windows.length,5);
  assert.equal(JSON.stringify(reading).includes('@example.invalid'),false);
});
test('switching never accepts quota with missing identity metadata',async()=>{
  const adapter=new Antigravity(async()=>[{pid:1,token:'private',ports:[1234]}],async(_candidate,_port,method)=>method==='RetrieveUserQuotaSummary'?summary:{});
  adapter.beginSwitch();await assert.rejects(adapter.read());assert.equal(adapter.waitingForAccount,true);
  adapter.cancelSwitch();assert.equal((await adapter.read()).windows.length,5);
});

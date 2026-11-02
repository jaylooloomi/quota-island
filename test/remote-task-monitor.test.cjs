const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {remoteStatus,remoteRow,validateChallenge,Controller,RemoteTaskMonitor,derSignature,publicSpki}=require('../dist/remote-task-monitor');
test('remote runtime status is authoritative; missing and unsupported states stay unknown',()=>{
  for(const [input,status] of [[{type:'active',activeFlags:[]},'running'],[{type:'active',activeFlags:['waitingOnApproval']},'waiting'],[{type:'active',activeFlags:['waitingOnUserInput']},'waiting'],[{type:'idle'},'idle'],[{type:'notLoaded'},'unknown'],[{type:'active'},'unknown'],[{type:'active',activeFlags:['futureFlag']},'unknown'],[null,'unknown']])assert.equal(remoteStatus(input),status);
});
test('remote rows retain metadata only and namespace identities across devices',()=>{
  const t={id:'task-1',name:'Name\ntext',cwd:'D:/project',updatedAt:100,status:{type:'active',activeFlags:[]},preview:'private',turns:[{items:'private'}]};
  const a=remoteRow(t,'env_a','PC',101000),b=remoteRow(t,'env_b','Other PC',101000);
  assert.notEqual(a.id,b.id);assert.equal(a.confirmedAt,100000);assert.equal(a.observedAt,101000);assert.equal(a.title,'Name text');assert.equal(a.source,'remote');assert.ok(!JSON.stringify(a).includes('private'));
  assert.equal(remoteRow({...t,parentThreadId:'parent'},'env_a','PC',101000),null);
  assert.equal(remoteRow({...t,id:'../bad'},'env_a','PC',101000),null);
  assert.equal(remoteRow({...t,updatedAt:Infinity},'env_a','PC',101000).confirmedAt,null);
});
test('challenge validation binds account, client, endpoint, digest, scope and expiry',()=>{
  const e={clientId:'client',accountUserId:'account'},c={nonce:'n'.repeat(43),target_origin:'https://chatgpt.com',target_path:'/backend-api/codex/remote/control/client/refresh/finish',client_id:'client',account_user_id:'account',audience:'remote_control_client_enrollment',challenge_expires_at:Math.floor(Date.now()/1000)+60};
  validateChallenge(c,e,'refresh');validateChallenge({...c,challenge_expires_at:new Date(Date.now()+60000).toISOString()},e,'refresh');
  for(const delta of [{target_origin:'https://evil.test'},{target_path:'/wrong'},{client_id:'other'},{account_user_id:'other'},{nonce:'short'},{challenge_expires_at:0},{challenge_expires_at:Math.floor(Date.now()/1000)+99999}])assert.throws(()=>validateChallenge({...c,...delta},e,'refresh'));
  const token='local-fixture-token',expires=Math.floor(Date.now()/1000)+60,scopes=['remote_control_controller_websocket'];
  const w={type:'device_key_challenge',nonce:c.nonce,targetOrigin:c.target_origin,targetPath:'/backend-api/codex/remote/control/client',clientId:'client',accountUserId:'account',purpose:'remote_control_client_websocket',audience:'remote_control_client_websocket',sessionId:'s',tokenSha256Base64url:crypto.createHash('sha256').update(token).digest('base64url'),tokenExpiresAt:expires,scopes};
  validateChallenge(w,e,'socket',token,expires,scopes);
  for(const delta of [{tokenSha256Base64url:'wrong'},{tokenExpiresAt:0},{scopes:['other']},{targetOrigin:'wss://chatgpt.com'},{purpose:'other'}])assert.throws(()=>validateChallenge({...w,...delta},e,'socket',token,expires,scopes));
});
test('P-256 DER signatures verify and malformed public blobs are rejected',()=>{
  const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'}),payload=Buffer.from('local test');
  for(let i=0;i<20;i++){const raw=crypto.sign('sha256',payload,{key:privateKey,dsaEncoding:'ieee-p1363'});assert.equal(crypto.verify('sha256',payload,publicKey,derSignature(raw)),true);}
  assert.throws(()=>derSignature(Buffer.alloc(63)));assert.throws(()=>publicSpki(Buffer.alloc(72).toString('base64')));
});
test('RPC replies are bound to stream and device; unrelated events are discarded; disconnect rejects pending calls',async()=>{
  const c=new Controller('',()=>{}),sent=[];c.ws={readyState:1,send:v=>sent.push(JSON.parse(v)),terminate(){}};c.enrollment={clientId:'client'};c.expiry=Date.now()+60000;c.authenticated=true;c.closed=false;c.streams.set('env_a',{env:'env_a',id:'stream',seq:0});
  await assert.rejects(c.rpc('env_a','thread/resume',{}),/METHOD_NOT_ALLOWED/);
  const response=c.rpc('env_a','thread/read',{threadId:'t',includeTurns:false}),id=sent[0].message.id;
  c.receive({type:'server_message',client_id:'client',env_id:'env_b',stream_id:'stream',message:{id,result:'wrong'}});assert.equal(c.pending.size,1);
  c.receive({type:'server_message',client_id:'client',env_id:'env_a',stream_id:'other',message:{id,result:'wrong'}});assert.equal(c.pending.size,1);
  c.receive({type:'server_message',client_id:'client',env_id:'env_a',stream_id:'stream',message:{id,result:{thread:{id:'t'}}}});assert.deepEqual(await response,{thread:{id:'t'}});
  const pending=c.rpc('env_a','thread/read',{threadId:'t'});c.disconnect();await assert.rejects(pending,/DISCONNECTED/);assert.equal(c.pending.size,0);assert.equal(c.usable,false);
});
test('controller refuses pairing, revocation and arbitrary backend requests',async()=>{
  const c=new Controller('',()=>{});
  for(const [route,method] of [['/codex/remote/control/client/enroll/start','POST'],['/codex/remote/control/clients/c/revoke','POST'],['/other','GET'],['/codex/remote/control/environments?limit=100','POST']])await assert.rejects(c.request(route,method),/INVALID_ROUTE/);
});
test('bounded chunk assembly reconstructs a reply and rejects oversized or inconsistent chunks',async()=>{
  const c=new Controller('',()=>{}),sent=[];c.ws={readyState:1,send:v=>sent.push(JSON.parse(v)),terminate(){}};c.enrollment={clientId:'client'};c.expiry=Date.now()+60000;c.authenticated=true;c.closed=false;c.streams.set('env_a',{env:'env_a',id:'s',seq:0});
  const response=c.rpc('env_a','thread/list',{}),id=sent[0].message.id,b=Buffer.from(JSON.stringify({id,result:{data:[]}}));
  const base={type:'server_message_chunk',client_id:'client',env_id:'env_a',stream_id:'s',seq_id:1,segment_count:2,message_size_bytes:b.length};
  c.receive({...base,segment_id:1,message_chunk_base64:b.subarray(10).toString('base64')});c.receive({...base,segment_id:0,message_chunk_base64:b.subarray(0,10).toString('base64')});assert.deepEqual(await response,{data:[]});
  assert.throws(()=>c.receive({...base,segment_count:999999}),/CHUNK_LIMIT/);c.disconnect();
});
test('remote monitor excludes local host, refreshes actual status, invalidates offline state, backs off and never reads turns',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pebble-remote-fixture-'));fs.writeFileSync(path.join(root,'.codex-global-state.json'),JSON.stringify({'electron-local-remote-control-environment-id':'env_local'}));
  const m=new RemoteTaskMonitor(root,()=>{});let online=true,status={type:'active',activeFlags:[]},calls=0;
  m.controller={usable:true,connect:async()=>{},request:async()=>({items:[{env_id:'env_local',online:true},{env_id:'env_other',online,display_name:'PC'}]}),rpc:async(env,method,params)=>{calls++;assert.equal(env,'env_other');if(method==='thread/list')return {data:[{id:'t',status:{type:'idle'},updatedAt:Date.now()/1000}]};assert.equal(method,'thread/read');assert.equal(params.includeTurns,false);return {thread:{id:'t',updatedAt:Date.now()/1000,status,turns:[{private:'discarded'}]}};},heartbeat(){},disconnect(){}};
  try{await m.tick();assert.equal(m.snapshot().rows[0].status,'running');status={type:'idle'};await m.tick();assert.equal(m.snapshot().rows[0].status,'idle');online=false;await m.tick();assert.equal(m.snapshot().rows[0].status,'unknown');
    m.controller.connect=async()=>{calls++;throw Error('REMOTE_HTTP_429');};await m.tick();assert.equal(m.snapshot().available,false);const before=calls;await m.tick();assert.equal(calls,before,'backoff blocks repeated retries');assert.equal(m.snapshot().rows[0].status,'unknown');
  }finally{m.close();fs.rmSync(root,{recursive:true,force:true});}
});

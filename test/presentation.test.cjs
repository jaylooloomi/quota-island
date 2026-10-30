const {test}=require('node:test');
const assert=require('node:assert/strict');
test('compact weekly selection never substitutes session quota and prefers all-model weekly',()=>{
  const {weeklyWindow}=require('../src/ui/presentation');
  const session={id:'five_hour',label:'5 小時',usedPercent:99},all={id:'seven_day',label:'每週 · 所有模型',usedPercent:15},scoped={id:'seven_day_fable',label:'Fable 每週',usedPercent:80};
  assert.equal(weeklyWindow([session,scoped,all]),all);assert.equal(weeklyWindow([session]),null);
  assert.equal(weeklyWindow([{id:'primary',label:'7 天',usedPercent:30}]).usedPercent,30);
  assert.equal(weeklyWindow([{id:'a-weekly',label:'A',usedPercent:25},{id:'b-weekly',label:'B',usedPercent:50},session]).usedPercent,50);
});
const {groupWindows,shortWindow,windowLabel,resetDate}=require('../src/ui/presentation');
test('equal Antigravity variants become one visible row without merging different models or quotas',()=>{
  const rows=[{id:'a',label:'Gemini Argon (High)',usedPercent:75,resetsAt:'2026-11-01'},
    {id:'b',label:'Gemini Argon (Low)',usedPercent:75,resetsAt:'2026-11-01'},
    {id:'c',label:'Gemini Argon (Medium)',usedPercent:80,resetsAt:'2026-11-01'},
    {id:'d',label:'Gemini Flash (High)',usedPercent:0,resetsAt:'2026-11-01'}];
  const grouped=groupWindows(rows);assert.equal(grouped.length,3);assert.equal(grouped[0].variants.length,2);
  assert.equal(grouped[0].label,'Gemini Argon');assert.equal(grouped[1].usedPercent,80);
});
test('reset dates include year date and clock time in the local timezone for every provider',()=>{
  for(const locale of ['zh-TW','en','ja','ko']){
    const value=resetDate('2026-11-04T11:22:00Z',locale,'Asia/Taipei');
    assert.match(value,/2026/);assert.match(value,/11/);assert.match(value,/04/);assert.match(value,/19:22/);
  }
  assert.match(resetDate('2026-12-31T18:00:00Z','zh-TW','Asia/Taipei'),/2027\/01\/01.*02:00/);
  assert.equal(resetDate(null),null);assert.equal(resetDate('bad date'),null);
  assert.equal(resetDate('2026-11-04T11:22:00Z','bad','UTC'),resetDate('2026-11-04T11:22:00Z','zh-TW','UTC'));
});
test('model names and quota reset boundaries are preserved in compact presentation',()=>{
  assert.equal(shortWindow('Gemini Flash'),'Flash');
  assert.equal(shortWindow('Gemini Pro'),'Pro');
  assert.equal(shortWindow('1.5 小時'),'1.5h');
  assert.equal(shortWindow('30 天'),'30d');
  assert.equal(windowLabel('Gemini 4 Argon'),'4 Argon');
  assert.equal(windowLabel('每週'),'每週');
  assert.deepEqual(groupWindows([]),[]);
  const rows=[{id:'a',label:'Gemini Argon (High)',usedPercent:10,resetsAt:'2026-11-01'},
    {id:'b',label:'Gemini Argon (Low)',usedPercent:10,resetsAt:'2026-11-02'}];
  assert.equal(groupWindows(rows).length,2,'Different reset windows must never be merged');
  assert.equal(rows[0].label,'Gemini Argon (High)','Presentation must not mutate readings');
});
test('compact window names retain the actual model or cadence',()=>{
  assert.equal(shortWindow('7 天'),'7d');assert.equal(shortWindow('5 小時'),'5h');
  assert.equal(shortWindow('Gemini 4 Argon'),'Argon');assert.equal(shortWindow('unknown window'),'unknown window');
});

test('pacing reserves a percentage of total quota and divides actual time without rounding days up',()=>{
  const {pacing}=require('../src/ui/presentation');const now=Date.UTC(2026,9,31);
  const w={usedPercent:20,resetsAt:new Date(now+4*86400000).toISOString()};
  const p=pacing(w,10,now);assert.equal(p.allowance,17.5);assert.equal(p.reserve,10);assert.equal(p.available,70);assert.equal(p.used,20);assert.equal(p.unit,'day');
  assert.equal(pacing({...w,resetsAt:new Date(now+3.5*86400000).toISOString()},10,now).allowance,20);
  const h=pacing({...w,resetsAt:new Date(now+5*3600000).toISOString()},10,now);assert.equal(h.unit,'hour');assert.equal(h.allowance,14);
  assert.equal(pacing({...w,resetsAt:new Date(now+1800000).toISOString()},10,now).allowance,70);
  assert.equal(pacing({...w,usedPercent:95},10,now).allowance,0);
  assert.equal(pacing(w,0,now).allowance,20);assert.equal(pacing(w,100,now).allowance,0);
});
test('pacing handles absent malformed expired and exhausted quota without invented allowance',()=>{
  const {pacing}=require('../src/ui/presentation');const now=Date.now();
  for(const w of [null,{usedPercent:NaN,resetsAt:'2099-01-01'},{usedPercent:-1,resetsAt:'2099-01-01'},{usedPercent:101,resetsAt:'2099-01-01'},{usedPercent:20,resetsAt:null},{usedPercent:20,resetsAt:'bad'},{usedPercent:20,resetsAt:new Date(now).toISOString()}])assert.equal(pacing(w,10,now),null);
  assert.equal(pacing({usedPercent:100,resetsAt:new Date(now+86400000).toISOString()},10,now).allowance,0);
  assert.equal(pacing({usedPercent:0,resetsAt:new Date(now+86400000).toISOString()},NaN,now).configured,10);
});
test('pacing keeps selected windows separate and defaults to all-model weekly rather than scoped models',()=>{
  const {paceWindow}=require('../src/ui/presentation');const windows=[{id:'five_hour',usedPercent:12},{id:'seven_day_fable',usedPercent:80},{id:'seven_day',usedPercent:15}];
  assert.equal(paceWindow(windows).id,'seven_day');assert.equal(paceWindow(windows,'five_hour').id,'five_hour');
  assert.equal(paceWindow([{id:'a-weekly',usedPercent:5},{id:'b-weekly',usedPercent:20}]).id,'b-weekly');
  assert.equal(paceWindow([{id:'session',usedPercent:12}]).id,'session');assert.equal(paceWindow([]),null);
});

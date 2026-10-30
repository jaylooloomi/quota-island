const {test}=require('node:test');
const assert=require('node:assert/strict');
const {groupWindows,shortWindow,windowLabel}=require('../src/ui/presentation');
test('equal Antigravity variants become one visible row without merging different models or quotas',()=>{
  const rows=[{id:'a',label:'Gemini Argon (High)',usedPercent:75,resetsAt:'2026-11-01'},
    {id:'b',label:'Gemini Argon (Low)',usedPercent:75,resetsAt:'2026-11-01'},
    {id:'c',label:'Gemini Argon (Medium)',usedPercent:80,resetsAt:'2026-11-01'},
    {id:'d',label:'Gemini Flash (High)',usedPercent:0,resetsAt:'2026-11-01'}];
  const grouped=groupWindows(rows);assert.equal(grouped.length,3);assert.equal(grouped[0].variants.length,2);
  assert.equal(grouped[0].label,'Gemini Argon');assert.equal(grouped[1].usedPercent,80);
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

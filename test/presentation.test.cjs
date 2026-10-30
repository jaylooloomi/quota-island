const {test}=require('node:test');
const assert=require('node:assert/strict');
const {groupWindows,shortWindow}=require('../src/ui/presentation');
test('equal Antigravity variants become one visible row without merging different models or quotas',()=>{
  const rows=[{id:'a',label:'Gemini Argon (High)',usedPercent:75,resetsAt:'2026-11-01'},
    {id:'b',label:'Gemini Argon (Low)',usedPercent:75,resetsAt:'2026-11-01'},
    {id:'c',label:'Gemini Argon (Medium)',usedPercent:80,resetsAt:'2026-11-01'},
    {id:'d',label:'Gemini Flash (High)',usedPercent:0,resetsAt:'2026-11-01'}];
  const grouped=groupWindows(rows);assert.equal(grouped.length,3);assert.equal(grouped[0].variants.length,2);
  assert.equal(grouped[0].label,'Gemini Argon');assert.equal(grouped[1].usedPercent,80);
});
test('compact window names retain the actual model or cadence',()=>{
  assert.equal(shortWindow('7 天'),'7d');assert.equal(shortWindow('5 小時'),'5h');
  assert.equal(shortWindow('Gemini 4 Argon'),'Argon');assert.equal(shortWindow('unknown window'),'unknown window');
});

const {test}=require('node:test'),assert=require('node:assert/strict'),{sample}=require('../src/ui/pet-animation');
test('continuous 3D blends adjacent drawings while pixels retain crisp frame steps',()=>{
 const smooth=sample('smooth','claude',100);assert.equal(smooth.frame,0);assert.equal(smooth.next,1);assert.equal(smooth.mix,.5);
 const pixel=sample('pixel','claude',100);assert.equal(pixel.mix,0);
 assert.notEqual(sample('smooth','claude',500).frame,sample('smooth','claude',100).frame);
});
test('all providers remain within available frame ranges with cyclic rabbit motion',()=>{
 for(const style of ['smooth','pixel'])for(const provider of ['claude','codex','gemini'])for(let t=0;t<10000;t+=37){const p=sample(style,provider,t);for(const frame of [p.frame,p.next])assert.ok(frame>=0&&frame<(provider==='gemini'?6:12));assert.ok(p.mix>=0&&p.mix<1);}
 assert.equal(sample('smooth','gemini',2399).frame,0);assert.equal(sample('smooth','gemini',2400).frame,0);
});
test('reduced motion always renders a stable unblended first frame',()=>{for(const style of ['smooth','pixel'])for(const t of [0,900,3000])assert.deepEqual(sample(style,'claude',t,true),{frame:0,next:1,mix:0});});

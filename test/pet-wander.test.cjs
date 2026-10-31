const {test}=require('node:test'),assert=require('node:assert/strict'),{create}=require('../src/ui/pet-wander'),{sample}=require('../src/ui/pet-animation');
test('roaming path stays within the stage and alternates walking and resting',()=>{
 const path=create(446,()=>.5);let min=Infinity,max=-Infinity,moving=0,resting=0,left=0,right=0;
 for(let i=0;i<2000;i++){const p=path.step(1/60);min=Math.min(min,p.x);max=Math.max(max,p.x);p.moving?moving++:resting++;p.face===1?right++:left++;assert.ok(p.x>=92&&p.x+72<=446-10);}
 assert.ok(max-min>100);assert.ok(moving&&resting&&left&&right);
});
test('large time jumps cannot teleport a roaming pet outside boundaries',()=>{const p=create(446,()=>0);let previous=p.step(0);for(let i=0;i<200;i++){const next=p.step(5000);assert.ok(Math.abs(next.x-previous.x)<=3.81);previous=next;}});
test('all three walking roles use twelve steps and freeze under reduced motion',()=>{for(const id of ['claude','codex','gemini']){const frames=new Set();for(let i=0;i<12;i++)frames.add(sample('walk',id,i*1100/12+1).frame);assert.equal(frames.size,12);assert.equal(sample('walk',id,700,true).frame,0);}});

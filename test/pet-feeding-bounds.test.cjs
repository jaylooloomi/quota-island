const {test}=require('node:test'),assert=require('node:assert/strict'),{feedingTarget}=require('../src/ui/pet-wander');
test('food targets reserve space for the full character at both rounded stage edges',()=>{for(const width of [414,448,464])for(const click of [-100,0,20,width/2,width,width+100]){const target=feedingTarget(width,click);assert.ok(target.petX>=18);assert.ok(target.petX+72<=width-18);assert.equal(target.foodX,target.petX+36);}});
test('feeding in the center is not shifted',()=>{assert.deepEqual(feedingTarget(448,224),{foodX:224,petX:188});});

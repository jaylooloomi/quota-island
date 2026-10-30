const {test}=require('node:test'),assert=require('node:assert/strict');
const {fitWindow,snapWindow}=require('../dist/window-position');
const area={x:0,y:0,width:1920,height:1040};
test('visible island snaps to four edges and corners while avoiding the taskbar',()=>{
  for(const [x,horizontal] of [[3,'left'],[1460,'right']])for(const [y,vertical] of [[4,'top'],[960,'bottom']]){
    const r=snapWindow({x,y,width:464,height:76},area);assert.equal(r.dock.horizontal,horizontal);assert.equal(r.dock.vertical,vertical);
    assert.equal(horizontal==='left'?r.bounds.x+8:r.bounds.x+r.bounds.width-8,horizontal==='left'?0:1920);
    assert.equal(vertical==='top'?r.bounds.y+8:r.bounds.y+r.bounds.height-8,vertical==='top'?0:1040);
  }
  assert.deepEqual(snapWindow({x:500,y:300,width:464,height:76},area).dock,{horizontal:null,vertical:null});
  assert.deepEqual(snapWindow({x:3,y:300,width:464,height:76},area).dock,{horizontal:'left',vertical:null});
  assert.deepEqual(snapWindow({x:1460,y:300,width:464,height:76},area).dock,{horizontal:'right',vertical:null});
  assert.deepEqual(snapWindow({x:500,y:4,width:464,height:76},area).dock,{horizontal:null,vertical:'top'});
  assert.deepEqual(snapWindow({x:500,y:960,width:464,height:76},area).dock,{horizontal:null,vertical:'bottom'});
  assert.equal(snapWindow({x:20,y:300,width:464,height:76},area).dock.horizontal,null);
});
test('bottom corner anchoring survives expanded heights without changing window width',()=>{
  const dock={horizontal:'right',vertical:'bottom'};
  for(const height of [76,522,850,1200]){
    const r=fitWindow({x:1464,y:972,width:464,height:76},area,464,height,dock);
    assert.equal(r.x+r.width-8,1920);assert.equal(r.y+r.height-8,1040);assert.equal(r.width,464);assert.ok(r.height<=1040);
  }
});
test('negative-origin monitors and work-area offsets are handled in display coordinates',()=>{
  const display={x:-1600,y:40,width:1600,height:860};
  const r=snapWindow({x:-1598,y:42,width:464,height:76},display);
  assert.equal(r.bounds.x,-1608);assert.equal(r.bounds.y,32);
  const off=fitWindow({x:-3000,y:2000,width:464,height:76},display,464,700);
  assert.ok(off.x+8>=display.x);assert.ok(off.y+off.height-8<=900);
  const small=fitWindow(off,{x:0,y:0,width:320,height:240},464,800,{horizontal:'right',vertical:'bottom'});
  assert.equal(small.width,320);assert.equal(small.height,240);assert.equal(small.x+small.width-8,320);
});

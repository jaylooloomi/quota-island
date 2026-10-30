const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-snap-'));
  const env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});
  let app=await launch();
  try{
    let page=await app.firstWindow();await page.locator('#mini-claude').filter({hasText:'36%'}).waitFor();
    const area=await app.evaluate(({screen,BrowserWindow})=>screen.getDisplayMatching(BrowserWindow.getAllWindows()[0].getBounds()).workArea);
    const drag=async(x,y)=>{await app.evaluate(({BrowserWindow},{x,y})=>{const w=BrowserWindow.getAllWindows()[0];w.emit('will-move',{}, {...w.getBounds(),x,y});w.setPosition(x,y);w.emit('moved');},{x,y});};
    const bounds=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
    const cx=area.x+Math.round((area.width-464)/2),cy=area.y+Math.round((area.height-76)/2);
    for(const [x,y,horizontal,vertical] of [[area.x+4,cy,'left',null],[area.x+area.width-468,cy,'right',null],[cx,area.y+4,null,'top'],[cx,area.y+area.height-80,null,'bottom']]){
      await drag(x,y);assert.deepEqual((await page.evaluate(()=>window.quota.getState())).settings.dock,{horizontal,vertical},'Side snapping preserves the free axis');
    }
    for(const horizontal of ['left','right'])for(const vertical of ['top','bottom']){
      await drag(horizontal==='left'?area.x+4:area.x+area.width-464-4,vertical==='top'?area.y+4:area.y+area.height-76-4);
      const b=await bounds();assert.equal(horizontal==='left'?b.x+8:b.x+b.width-8,horizontal==='left'?area.x:area.x+area.width);assert.equal(vertical==='top'?b.y+8:b.y+b.height-8,vertical==='top'?area.y:area.y+area.height);
    }
    await page.locator('#toggle').click();await page.waitForFunction(()=>innerHeight>480);
    let b=await bounds();assert.equal(b.y+b.height-8,area.y+area.height,'Expanded panel keeps bottom alignment');assert.equal(b.x+b.width-8,area.x+area.width);
    await page.locator('#settings-toggle').click();await page.locator('#settings').waitFor();
    await page.waitForFunction(()=>document.querySelector('.panel-body').scrollHeight<=document.querySelector('.panel-body').clientHeight+1);
    b=await bounds();assert.equal(b.y+b.height-8,area.y+area.height,'Settings growth keeps bottom alignment');
    await page.locator('#settings-toggle').click();await page.locator('#collapse').click();
    await page.waitForFunction(()=>innerHeight===76);b=await bounds();assert.equal(b.y+b.height-8,area.y+area.height);
    await app.close();app=await launch();page=await app.firstWindow();await page.locator('#mini-claude').filter({hasText:'36%'}).waitFor();
    b=await bounds();assert.equal(b.x+b.width-8,area.x+area.width);assert.equal(b.y+b.height-8,area.y+area.height,'Dock survives restart');
    const center={x:area.x+Math.round((area.width-464)/2),y:area.y+Math.round((area.height-76)/2)};
    await drag(center.x,center.y);b=await bounds();assert.equal(b.x,center.x);assert.equal(b.y,center.y,'Dragging away releases snapping');
    const dock=(await page.evaluate(()=>window.quota.getState())).settings.dock;assert.deepEqual(dock,{horizontal:null,vertical:null});
    const report={passed:true,packaged:!!executablePath,checks:['four native-window corner positions','visible edges aligned beyond transparent inset','work area excludes taskbar','expanded and settings height retain bottom anchor','compact restores anchored corner','dock persists across restart','dragging away releases dock'],mode:'native window bounds with simulated user-move events'};
    await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/window-snap.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});

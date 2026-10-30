const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-pacing-'));
  const env={...process.env,QUOTA_TEST_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});
  let app=await launch();
  try{
    let page=await app.firstWindow();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();await page.locator('#toggle').click();
    assert.deepEqual((await page.evaluate(()=>window.quota.getState())).settings.reservePercent,{claude:10,codex:10,gemini:10},'Fresh defaults reserve 10%');
    const send=s=>app.evaluate(({BrowserWindow},state)=>BrowserWindow.getAllWindows()[0].webContents.send('state',state),s);
    const shape=()=>page.locator('.card').evaluateAll(nodes=>({width:innerWidth,height:innerHeight,footerY:document.querySelector('footer').getBoundingClientRect().y,rows:nodes.map(el=>{const r=el.getBoundingClientRect(),heading=el.querySelector('.card-heading').getBoundingClientRect(),icon=el.querySelector('.provider-icon').getBoundingClientRect(),name=el.querySelector('.provider-identity h2').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,headingX:heading.x,headingY:heading.y,iconY:icon.y,nameX:name.x,nameY:name.y,nameWidth:name.width,nameFont:getComputedStyle(el.querySelector('.provider-identity h2')).fontSize};})}));
    for(const locale of ['zh-TW','en','ja','ko']){
      await page.evaluate(locale=>window.quota.settings({locale,pacing:false,remaining:true,reservePercent:{claude:10,codex:10,gemini:10}}),locale);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const base=await shape();
      const barCenters=()=>page.locator('.card').evaluateAll(cards=>cards.map(card=>{const bar=card.querySelector('.quota-windows:not([hidden]) .track,.pacing-content:not([hidden]) .pace-bar'),r=bar.getBoundingClientRect();return r.y+r.height/2;}));
      const remainingBars=await barCenters();
      await page.locator('#mode-used').click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.deepEqual(await barCenters(),remainingBars,`${locale}: used bars align with remaining`);
      await page.locator('#mode-pacing').click();
      await page.waitForFunction(()=>document.querySelector('#mode-pacing').getAttribute('aria-pressed')==='true');
      assert.deepEqual(await shape(),base,`${locale}: pacing must preserve every card and window dimension`);
      assert.deepEqual(await barCenters(),remainingBars,`${locale}: pacing bar centers align with remaining`);
      const state=await page.evaluate(()=>window.quota.getState()),fixture=structuredClone(state);
      for(const [id,remaining] of [['claude',62],['codex',80],['gemini',34]]){
        Object.assign(fixture.providers[id],{status:'ready',updatedAt:new Date().toISOString(),reading:{provider:id,plan:id==='claude'?'Team':'Pro',windows:[{id:'seven_day',label:'每週 · 所有模型',usedPercent:100-remaining,resetsAt:new Date(Date.now()+4*86400000).toISOString()}],source:'Test fixture'}});
      }
      fixture.providers.gemini.reading.windows[0].group='Gemini Models';
      fixture.providers.claude.reading.windows.unshift({id:'five_hour',label:'本次工作階段',usedPercent:12,resetsAt:new Date(Date.now()+5*3600000).toISOString()});
      fixture.providers.claude.reading.windows.push({id:'seven_day_fable',label:'Fable · 每週',usedPercent:20,resetsAt:new Date(Date.now()+4*86400000).toISOString()});
      await send(fixture);await page.locator('.card.codex .pace-value').filter({hasText:'17.5'}).waitFor();
      assert.equal(await page.locator('.pacing-content:not([hidden])').count(),3);
      const suggestionLabels={'zh-TW':'建議用量',en:'Suggested use',ja:'推奨使用量',ko:'권장 사용량'};
      assert.deepEqual(await page.locator('.pace-budget-label').allTextContents(),[suggestionLabels[locale],suggestionLabels[locale],suggestionLabels[locale]]);
      assert.equal(await page.locator('.pace-budget').evaluateAll(nodes=>nodes.every(el=>{const label=el.querySelector('.pace-budget-label').getBoundingClientRect(),value=el.querySelector('.pace-value').getBoundingClientRect(),reserve=el.parentElement.querySelector('.pace-reserve-label').getBoundingClientRect();return label.right<=value.left&&el.getBoundingClientRect().right<=reserve.left;})),true,`${locale}: suggested-use label must precede the value without overlapping reserve`);
      for(const row of await page.locator('.pacing-content').evaluateAll(nodes=>nodes.map(el=>({text:el.textContent,width:el.clientWidth,scroll:el.scrollWidth,segments:[...el.querySelectorAll('.pace-segment')].map(s=>parseFloat(s.style.width))})))){
        assert.ok(row.scroll<=row.width+1,`${locale}: pacing row overflow`);assert.ok(row.text.includes('10%'));assert.ok(!row.text.includes('10 點'));assert.equal(row.segments.reduce((a,b)=>a+b,0),100);
      }
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
      assert.equal(await page.locator('.panel-header').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Header must fit three modes');
      await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/pacing-${locale}.png`});
      const grouped=structuredClone(fixture);
      grouped.providers.gemini.reading.windows=[
        {id:'gemini-weekly',group:'Gemini Models',label:'Gemini Models · 每週',usedPercent:1},
        {id:'gemini-5h',group:'Gemini Models',label:'Gemini Models · 5 小時',usedPercent:0},
        {id:'claude-weekly',group:'Claude and GPT models',label:'Claude and GPT models · 每週',usedPercent:50},
        {id:'claude-5h',group:'Claude and GPT models',label:'Claude and GPT models · 5 小時',usedPercent:0},
        {id:'argon-weekly',group:'Gemini 4 Argon',label:'Gemini 4 Argon · 每週',usedPercent:75},
      ].map(w=>({...w,resetsAt:new Date(Date.now()+4*86400000).toISOString()}));
      let groupedShape,detailAnchors;
      for(const mode of ['remaining','used','pacing','remaining']){
        grouped.settings.pacing=mode==='pacing';grouped.settings.remaining=mode!=='used';
        await send(grouped);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const current=await shape();if(groupedShape)assert.deepEqual(current,groupedShape,`${locale}: real Antigravity groups must keep card, identity and footer coordinates across ${mode}`);else groupedShape=current;
        if(mode!=='pacing'){
          const tracks=await page.locator('.card.claude,.card.gemini').evaluateAll(cards=>cards.map(card=>[...card.querySelectorAll('.track')].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width};})));
          assert.deepEqual(tracks[1],tracks[0],`${locale}: Antigravity and Claude progress tracks must share widths and columns in ${mode}`);
          assert.ok(tracks[1][1].x-tracks[1][0].x-tracks[1][0].width>=9,`${locale}: quota tracks need a visible gap`);
        }
        const anchors=await page.locator('.card.claude,.card.gemini').evaluateAll((cards,pacing)=>cards.map(card=>{const r=card.getBoundingClientRect(),link=card.querySelector(pacing?'.pace-link':'.quota-details-link'),b=link.getBoundingClientRect();return {right:r.right-b.right,bottom:r.bottom-b.bottom,height:b.height,font:getComputedStyle(link).fontSize};}),mode==='pacing');
        if(detailAnchors)assert.deepEqual(anchors,detailAnchors,`${locale}: pacing details must share quota/model details anchors in ${mode}`);else detailAnchors=anchors;
        await page.screenshot({path:`test-results/pacing-${locale}-grouped-${mode}.png`});
      }
      await page.locator('#tab-accounts').click();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.deepEqual(await shape(),groupedShape,`${locale}: grouped Antigravity identity must align between quota and accounts`);
      await page.locator('#tab-quota').click();
      const invalid=structuredClone(fixture);invalid.providers.codex.reading.windows[0].resetsAt=null;await send(invalid);
      assert.equal(await page.locator('.card.codex .pace-value').textContent(),'—','Missing reset must not invent guidance');
      const stale=structuredClone(fixture);stale.providers.codex.status='stale';await send(stale);assert.equal(await page.locator('.card.codex .pace-value').textContent(),'—');
      await page.evaluate(()=>window.quota.settings({pacing:true}));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const beforeAccordion=await shape();
      const linkBefore=await page.locator('.card.codex .pace-link').boundingBox();
      await page.locator('.card.codex .pace-link').click();await page.locator('#pace-details').waitFor();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(await page.locator('#pace-details').evaluate(el=>el.parentElement.classList.contains('codex')),true,'Details expand inside selected card');
      assert.equal(await page.locator('.card:visible').count(),3,'Other provider rows stay visible');
      const expanded=await shape();assert.equal(expanded.width,464);assert.ok(expanded.height>beforeAccordion.height);
      const linkAfter=await page.locator('.card.codex .pace-link').boundingBox();
      assert.equal(linkAfter.y,linkBefore.y,'Expanded pacing action must stay in the original main row');
      assert.equal(linkAfter.x+linkAfter.width,linkBefore.x+linkBefore.width,'Expanded pacing action stays right aligned');
      assert.equal(expanded.rows[1].headingY,beforeAccordion.rows[1].headingY,'Codex heading stays in its main row');
      assert.equal(expanded.rows[1].iconY,beforeAccordion.rows[1].iconY,'Codex icon stays in its main row');
      assert.match(await page.locator('#pace-details-title').textContent(),/Codex/,'Detail title must match selected provider');
      await page.locator('#pace-reserve').fill('20');await page.locator('#pace-reserve').dispatchEvent('change');
      await page.waitForFunction(()=>document.querySelector('#pace-reserve-value').textContent==='20%');
      const saved=await page.evaluate(()=>window.quota.getState());assert.equal(saved.settings.reservePercent.codex,20);
      const selected=await page.locator('#pace-window').inputValue();await page.locator('#pace-window').selectOption(selected);
      assert.equal((await page.evaluate(()=>window.quota.getState())).settings.paceWindows.codex,selected);
      await page.screenshot({path:`test-results/pacing-${locale}-details.png`});
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${locale}: detail must fit`);
      await page.locator('.card.gemini .pace-link').click();
      assert.equal(await page.locator('#pace-details').evaluate(el=>el.parentElement.classList.contains('gemini')),true,'Opening another card moves the single accordion');
      assert.equal(await page.locator('.card.pace-expanded').count(),1);
      await page.locator('.card.gemini .pace-link').click();
      await page.waitForFunction(()=>document.querySelector('#pace-details').hidden);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.deepEqual(await shape(),beforeAccordion,'Collapsing restores original rows and window');
      await page.locator('#mode-used').click();
      assert.equal(await page.locator('.pacing-content:not([hidden])').count(),0);
      await page.evaluate(()=>window.quota.settings({reservePercent:{codex:10}}));
    }
    await page.evaluate(()=>window.quota.settings({pacing:true,reservePercent:{codex:25}}));
    await page.evaluate(()=>window.quota.settings({reservePercent:{codex:-1,claude:101},pacing:'invalid'}));
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.reservePercent.codex,25);
    await app.close();app=await launch();page=await app.firstWindow();
    const saved=await page.evaluate(()=>window.quota.getState());assert.equal(saved.settings.pacing,true);assert.equal(saved.settings.reservePercent.codex,25);assert.ok(saved.settings.paceWindows.codex);
    await app.close();
    const prefPath=path.join(dir,'preferences.json'),legacy=JSON.parse(await fs.readFile(prefPath,'utf8'));
    legacy.reserveDefaultsVersion=2;legacy.reservePercent={claude:5,codex:20,gemini:0};await fs.writeFile(prefPath,JSON.stringify(legacy));
    app=await launch();page=await app.firstWindow();
    assert.deepEqual((await page.evaluate(()=>window.quota.getState())).settings.reservePercent,{claude:10,codex:20,gemini:0},'Old 5% default migrates to 10%; other configured values stay unchanged');
    await page.evaluate(()=>window.quota.settings({reservePercent:{claude:10}}));
    await app.close();app=await launch();page=await app.firstWindow();
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.reservePercent.claude,10,'A new explicit 10% choice survives future restarts');
    const report={passed:true,packaged:!!executablePath,checks:['three modes preserve row and window dimensions','four-language pacing and details fit','reserve percentage and independent quota segments','missing reset and stale data suppress advice','reserve and window preferences persist','invalid preferences rejected']};
    await fs.writeFile('test-results/pacing.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});

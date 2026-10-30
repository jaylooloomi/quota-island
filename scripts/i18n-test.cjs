const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {parseClaude}=require('../dist/model');
const {parseAntigravitySummary}=require('../dist/antigravity');
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'quota-languages-'));
  const env={...process.env,QUOTA_TEST_DATA:directory};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});
  let app=await launch();
  try{
    let page=await app.firstWindow();await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();
    assert.equal(await page.locator('.panel-header #refresh').count(),0);
    assert.equal(await page.locator('footer #refresh').count(),1);
    await page.locator('#toggle').click();await page.locator('#settings-toggle').click();
    const names={'zh-TW':'剩餘額度',en:'Remaining quota',ja:'残りの利用枠',ko:'남은 할당량'};
    const audit=async label=>{
      const issues=await page.locator('.settings,.settings label,.settings select,.auth-code-form,.auth-code-form button,.auth-message,.connection-actions,.connection-description,.connection-note,.connection-steps,.segmented').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).flatMap(el=>{
        const rect=el.getBoundingClientRect(),root=document.querySelector('.panel-body').getBoundingClientRect();
        return el.scrollWidth>el.clientWidth+1||rect.left<root.left-1||rect.right>root.right+1?[{class:el.className,text:el.textContent.slice(0,80),width:el.clientWidth,scroll:el.scrollWidth}]:[];
      }));
      assert.deepEqual(issues,[],`${label}: horizontal clipping or overflow`);
    };
    await fs.mkdir('test-results',{recursive:true});
    let footerButtonPositions;
    for(const locale of ['en','ja','ko','zh-TW']){
      await page.locator('#language-shortcut').click();
      await page.locator(`#language-popover [data-locale="${locale}"]`).click();
      await page.locator('#mode-label').filter({hasText:names[locale]}).waitFor();
      assert.equal(await page.locator('#language-popover').isVisible(),false);
      assert.equal(await page.locator('#settings').isVisible(),false);
      const positions=await page.locator('.footer-preferences .footer-control').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width};}));
      if(footerButtonPositions)assert.deepEqual(positions,footerButtonPositions,`${locale}: footer buttons must not move with language`);else footerButtonPositions=positions;
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('html').getAttribute('lang'),locale);
      await page.waitForFunction(()=>{const body=document.querySelector('.panel-body');return window.innerHeight>520&&body.scrollHeight<=body.clientHeight+1;});
      assert.equal(await page.locator('#quit').evaluate(el=>el.getBoundingClientRect().bottom<=document.querySelector('footer').getBoundingClientRect().top),true,`${locale}: settings actions must be visible without scrolling`);
      await audit(`${locale} settings`);
      await page.locator('#settings').screenshot({path:`test-results/language-${locale}-settings.png`});
      assert.equal(await page.locator('.segmented button').evaluateAll(buttons=>buttons.every(button=>{
        const style=getComputedStyle(button);
        return style.whiteSpace==='nowrap'&&button.scrollWidth<=button.clientWidth&&button.scrollHeight<=button.clientHeight;
      })),true,`${locale}: percentage toggle labels must fit on one line`);
      await page.locator('#settings-toggle').click();
      await page.waitForFunction(()=>{const body=document.querySelector('.panel-body');return window.innerHeight<520&&body.scrollHeight<=body.clientHeight+1;});
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${locale}: cards must fit`);
      assert.equal(await page.locator('.quota-number').count(),5);
      const resetLabels=await page.locator('.reset').evaluateAll(nodes=>nodes.map(el=>({text:el.textContent,title:el.title,width:el.clientWidth,scroll:el.scrollWidth})));
      const clock=locale==='ko'?/\d{1,2}시\s*\d{1,2}분/:/\d{2}:\d{2}/;
      assert.equal(resetLabels.every(row=>/\d/.test(row.text)&&/\d{4}/.test(row.title)&&clock.test(row.title)&&row.scroll<=row.width+1),true,`${locale}: invalid reset countdown ${JSON.stringify(resetLabels)}`);
      assert.equal(await page.locator('.card-heading').evaluateAll(nodes=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1)),true);
      await page.screenshot({path:`test-results/language-${locale}.png`});
      await page.locator('footer').screenshot({path:`test-results/language-${locale}-footer.png`});
      assert.equal(await page.locator('.footer-local').isVisible(),true);
      assert.equal(await page.locator('footer').evaluate(el=>{
        const local=el.querySelector('.footer-local').getBoundingClientRect();
        const preferences=el.querySelector('.footer-preferences').getBoundingClientRect();
        const sync=el.querySelector('.footer-sync-controls').getBoundingClientRect();
        return local.right<=preferences.left+1&&preferences.right<=sync.left+1&&sync.right<=el.getBoundingClientRect().right;
      }),true,`${locale}: footer sections must not overlap`);
      await page.locator('#language-shortcut').click();
      assert.equal(await page.locator(`#language-popover [data-locale="${locale}"]`).getAttribute('aria-checked'),'true');
      assert.deepEqual(await page.locator('#language-popover button').allTextContents(),['繁體中文','English','日本語','한국어']);
      await page.screenshot({path:`test-results/language-${locale}-language-menu.png`});
      await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
      await page.locator('#language-popover').waitFor({state:'hidden'});
      await page.waitForFunction(()=>document.activeElement.id==='language-shortcut',null,{timeout:3000});
      assert.equal(await page.locator('#language-shortcut').evaluate(el=>el===document.activeElement),true);
      await page.locator('#language-shortcut').click();await page.locator('#sync-shortcut').click();
      assert.equal(await page.locator('#language-popover').isVisible(),false);
      assert.equal(await page.locator('#sync-popover').isVisible(),true);
      assert.equal(await page.locator('.sync-entry').count(),3);
      await page.screenshot({path:`test-results/language-${locale}-sync-menu.png`});
      await page.locator('#mode-label').click();assert.equal(await page.locator('#sync-popover').isVisible(),false);
      const quotaSizes=await page.locator('.card').evaluateAll(nodes=>({height:innerHeight,cards:nodes.map(el=>el.getBoundingClientRect().height)}));
      await page.locator('#tab-accounts').click();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.deepEqual(await page.locator('.card').evaluateAll(nodes=>({height:innerHeight,cards:nodes.map(el=>el.getBoundingClientRect().height)})),quotaSizes,`${locale}: quota/account switching must preserve card and window heights`);
      assert.equal(await page.locator('#tab-accounts').getAttribute('aria-selected'),'true');
      assert.equal(await page.locator('.card.codex .quota-windows').isVisible(),false);
      await audit(`${locale} accounts`);
      assert.equal(await page.locator('.account-actions').evaluateAll(nodes=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1)),true);
      await page.screenshot({path:`test-results/language-${locale}-accounts.png`});
      await page.locator('#sync-shortcut').click();await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('#sync-popover').isVisible(),false);
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('#tab-accounts').getAttribute('aria-selected'),'true');
      await page.locator('.card.codex .account-logout').click();
      assert.equal(await page.locator('.card.codex .logout-confirm').isVisible(),true);
      await page.locator('.card.codex .cancel-logout').click();
      await page.locator('#tab-accounts').focus();await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#tab-quota').getAttribute('aria-selected'),'true');
      await page.locator('.card.codex .connection-status').click();
      assert.equal(await page.locator('.card.codex .login').isEnabled(),true);
      if(locale==='en')assert.match(await page.locator('.card.codex .login').textContent(),/Switch Codex account/);
      await page.locator('.card.codex .close-connection').click();
      const baseline=await page.evaluate(()=>window.quota.getState());
      const grouped=structuredClone(baseline);grouped.settings.remaining=true;
      grouped.providers.gemini.reading=parseAntigravitySummary({response:{groups:[
        {displayName:'Gemini Models',buckets:[{bucketId:'gw',window:'weekly',remainingFraction:.99},{bucketId:'gs',window:'5h',remainingFraction:1}]},
        {displayName:'Claude and GPT models',buckets:[{bucketId:'cw',window:'weekly',remainingFraction:.5},{bucketId:'cs',window:'5h',remainingFraction:1}]},
        {displayName:'Gemini 4 Argon',buckets:[{bucketId:'aw',window:'weekly',remainingFraction:.25}]}
      ]}},'Pro');
      await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),grouped);
      await page.locator('.card.gemini .quota-details-link').waitFor({state:'visible'});
      assert.equal(await page.locator('.card.gemini h2').textContent(),'Antigravity');
      await page.locator('.card.gemini .quota-details-link').click();
      assert.equal(await page.locator('#cards').isVisible(),false);
      assert.deepEqual(await page.locator('.group-number').allTextContents(),['99%','100%','50%','100%','25%']);
      assert.equal(await page.locator('.quota-group').count(),3);
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${locale}: complete Antigravity summary must fit`);
      await page.screenshot({path:`test-results/language-${locale}-antigravity-groups.png`});
      grouped.settings.remaining=false;
      await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),grouped);
      await page.locator('.group-number').first().filter({hasText:'1%'}).waitFor();
      assert.deepEqual(await page.locator('.group-number').allTextContents(),['1%','0%','50%','0%','75%']);
      await page.locator('#close-quota-details').click();
      await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),baseline);
      const modern=structuredClone(baseline);
      modern.providers.claude.reading=parseClaude({limits:[
        {kind:'session',group:'session',percent:12,is_active:false,resets_at:'2026-11-01T00:00:00Z'},
        {kind:'weekly_all',group:'weekly',percent:15,is_active:false,resets_at:'2026-11-04T13:59:59Z'},
        {kind:'weekly_scoped',group:'weekly',percent:20,is_active:true,scope:{model:{display_name:'Fable'}},resets_at:'2026-11-04T13:59:59Z'}]},'team');
      modern.settings.remaining=true;
      await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),modern);
      await page.locator('.card.claude .quota-details-link').waitFor({state:'visible'});
      assert.deepEqual(await page.locator('.card.claude .quota-number').allTextContents(),['88%','85%']);
      assert.doesNotMatch(await page.locator('.card.claude .quota-windows').textContent(),/Fable/);
      const fitModern=await page.locator('.panel-body').evaluate(el=>({visible:el.clientHeight,content:el.scrollHeight,cards:[...el.querySelectorAll('.card')].map(card=>({height:card.getBoundingClientRect().height,rows:[...card.querySelectorAll('.quota-row')].map(row=>row.getBoundingClientRect().height)}))}));
      await page.screenshot({path:`test-results/language-${locale}-claude-modern-remaining.png`});
      assert.ok(fitModern.content<=fitModern.visible+1,`${locale}: Fable fit ${JSON.stringify(fitModern)}`);
      assert.equal(await page.locator('.card.claude .window-label').evaluateAll(nodes=>nodes.every(el=>el.scrollWidth<=el.clientWidth+1)),true,`${locale}: Claude limit names must not be truncated`);
      await page.screenshot({path:`test-results/language-${locale}-claude-modern-remaining.png`});
      await page.locator('.card.claude .quota-details-link').click();
      assert.match(await page.locator('#quota-groups').textContent(),/Fable/);
      assert.deepEqual(await page.locator('.group-number').allTextContents(),['85%','80%']);
      await page.screenshot({path:`test-results/language-${locale}-claude-model-details.png`});
      modern.settings.remaining=false;
      await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),modern);
      await page.locator('.group-number').first().filter({hasText:'15%'}).waitFor();
      assert.deepEqual(await page.locator('.card.claude .quota-number').allTextContents(),['12%','15%']);
      assert.deepEqual(await page.locator('.group-number').allTextContents(),['15%','20%']);
      await page.screenshot({path:`test-results/language-${locale}-claude-modern-used.png`});
      await page.locator('#close-quota-details').click();
      await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),baseline);
      await page.waitForFunction(()=>document.querySelectorAll('.card.claude .quota-row').length===2);
      const limited=structuredClone(baseline);
      limited.providers.claude.status='unavailable';limited.providers.claude.reading=null;
      limited.providers.claude.error='服務暫時限制查詢頻率，等待後將自動重試';limited.providers.claude.nextPollAt=Date.now()+3600000;
      await app.evaluate(({BrowserWindow},snapshot)=>BrowserWindow.getAllWindows()[0].webContents.send('state',snapshot),limited);
      await page.locator('#sync-shortcut').click();
      assert.equal(await page.locator('.sync-retry').count(),1);
      assert.match(await page.locator('.sync-retry').textContent(),/1|60/);
      await page.locator('#sync-refresh').click();
      await page.keyboard.press('Escape');
      await app.evaluate(({BrowserWindow},snapshot)=>BrowserWindow.getAllWindows()[0].webContents.send('state',snapshot),limited);
      await page.locator('.card.claude .connection-status').click();
      assert.equal(await page.locator('.card.claude .login').isEnabled(),true);
      if(locale==='en'){
        assert.match(await page.locator('.card.claude .connection-note').textContent(),/Retry in/);
        assert.doesNotMatch(await page.locator('.card.claude').innerText(),/[\u3400-\u9fff]/);
      }
      await page.locator('.card.claude .close-connection').click();
      await app.evaluate(({BrowserWindow},snapshot)=>BrowserWindow.getAllWindows()[0].webContents.send('state',snapshot),baseline);
      await page.locator('.card.claude.ready').waitFor({state:'attached'});
      for(const [id,phase] of [['claude','code'],['claude','verifying'],['claude','cooldown'],['claude','error'],['gemini','authorizing'],['codex','authorizing']]){
        const snapshot=structuredClone(baseline);
        snapshot.providers[id].status='unavailable';snapshot.providers[id].reading=null;
        snapshot.providers[id].error='服務暫時限制查詢頻率，等待後將自動重試';snapshot.providers[id].nextPollAt=Date.now()+3600000;
        const pending=!['cooldown','error'].includes(phase);
        snapshot.auth[id]={pending,phase,codeRequired:phase==='code',canReopen:true,message:phase==='verifying'?'正在驗證授權碼，最多等待 60 秒；可取消後重新登入。':phase==='cooldown'?'帳號授權已完成；配額查詢仍在冷卻，期滿後會自動同步。':phase==='error'?'授權碼驗證逾時，請重新登入取得新授權碼。':'等待瀏覽器授權，完成後會自動同步配額…'};
        await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),snapshot);
        const card=page.locator(`.card.${id}`);
        await page.locator(`.card.${id}.unavailable`).waitFor({state:'attached'});
        if(pending)await card.locator('.connection-details').waitFor({state:'visible'});
        else await card.locator('.connection-status').click();
        if(id==='claude'&&pending)assert.equal(await card.locator('.cancel-login').isVisible(),true);
        if(phase==='code')assert.equal(await card.locator('.auth-code-form').isVisible(),true);
        if(phase==='verifying'){
          assert.equal(await card.locator('.auth-code-form').isVisible(),false);
          assert.match(await card.locator('.auth-message').textContent(),/60/);
        }
        if(phase==='cooldown'){
          assert.equal(await card.locator('.login').isEnabled(),true);
          assert.equal(await card.locator('.auth-message').evaluate(el=>el.classList.contains('error')),false);
        }
        await card.locator('.source').evaluate(el=>el.open=true);
        await audit(`${locale} ${id} ${phase}`);
        await card.screenshot({path:`test-results/language-${locale}-${id}-${phase}.png`});
        await card.locator('.close-connection').click();
        await app.evaluate(({BrowserWindow},value)=>BrowserWindow.getAllWindows()[0].webContents.send('state',value),baseline);
        await page.locator(`.card.${id}.ready`).waitFor({state:'attached'});
      }
      await page.locator('#settings-toggle').click();
    }
    await page.locator('#language').selectOption('ko');
    await page.locator('html[lang="ko"]').waitFor();
    await page.evaluate(()=>window.quota.antigravityAccount('disconnect'));
    const disconnected=await page.evaluate(()=>window.quota.getState());
    assert.equal(disconnected.settings.enabled.gemini,false);
    assert.equal(disconnected.providers.gemini.reading,null);
    await page.evaluate(()=>window.quota.refresh());
    assert.equal((await page.evaluate(()=>window.quota.getState())).providers.gemini.reading,null,'Manual refresh must not reconnect a disconnected source');
    await page.locator('[data-visible="codex"]').uncheck();
    await page.waitForFunction(()=>document.querySelector('.compact-provider.codex').hidden&&document.querySelector('.card.codex').hidden);
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.enabled.codex,true,'Hiding a service must preserve its monitoring setting');
    await app.close();app=await launch();page=await app.firstWindow();
    await page.locator('html[lang="ko"]').waitFor();
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.enabled.gemini,false,'Disconnect survives restart');
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.visible.codex,false,'Visibility must survive restart');
    await page.evaluate(()=>window.quota.settings({visible:{claude:false,codex:false,gemini:false}}));
    await page.locator('#toggle').click();
    await page.locator('#no-visible-providers').waitFor();
    await page.locator('#settings-toggle').click();
    await page.locator('[data-visible="codex"]').check();
    await page.locator('#settings-toggle').click();
    await page.locator('.card.codex').waitFor();
    assert.equal(await page.locator('#no-visible-providers').isVisible(),false);
    await page.evaluate(()=>window.quota.settings({locale:'unsupported'}));
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.locale,'ko');
    const report={passed:true,packaged:!!executablePath,locales:['zh-TW','en','ja','ko'],checks:['settings layout and screenshots in all languages','three provider login details','Claude authorization-code form','Claude verification waiting and cancel control','authorization completed separately from quota cooldown','timeout error with retry','expanded source details','percentage toggle has no wrapping','all quota cards fit','immediate translation and Chinese restoration','language persists across restart','invalid language ignored']};
    await fs.writeFile('test-results/i18n.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1});

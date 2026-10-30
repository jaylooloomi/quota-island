const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'quota-languages-'));
  const env={...process.env,QUOTA_TEST_DATA:directory};delete env.ELECTRON_RUN_AS_NODE;
  const executablePath=process.env.QUOTA_PACKAGED_EXE;
  const launch=()=>electron.launch({...(executablePath?{executablePath}:{}),args:[...(executablePath?[]:['.']),'--demo','--test-mode'],env});
  let app=await launch();
  try{
    let page=await app.firstWindow();await page.locator('#mini-codex').filter({hasText:'12%'}).waitFor();
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
    for(const locale of ['en','ja','ko','zh-TW']){
      await page.locator('#language').selectOption(locale);
      await page.locator('#mode-label').filter({hasText:names[locale]}).waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'),locale);
      await audit(`${locale} settings`);
      await page.locator('#settings').screenshot({path:`test-results/language-${locale}-settings.png`});
      assert.equal(await page.locator('.segmented button').evaluateAll(buttons=>buttons.every(button=>{
        const style=getComputedStyle(button);
        return style.whiteSpace==='nowrap'&&button.scrollWidth<=button.clientWidth&&button.scrollHeight<=button.clientHeight;
      })),true,`${locale}: percentage toggle labels must fit on one line`);
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('.panel-body').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${locale}: cards must fit`);
      assert.equal(await page.locator('.quota-number').count(),5);
      assert.equal(await page.locator('.card-heading').evaluateAll(nodes=>nodes.every(el=>el.querySelector('.provider-identity').getBoundingClientRect().right<=el.querySelector('.connection-status').getBoundingClientRect().left+1)),true);
      await page.screenshot({path:`test-results/language-${locale}.png`});
      await page.locator('.card.codex .connection-status').click();
      assert.equal(await page.locator('.card.codex .login').isEnabled(),true);
      if(locale==='en')assert.match(await page.locator('.card.codex .login').textContent(),/Switch Codex account/);
      await page.locator('.card.codex .close-connection').click();
      const baseline=await page.evaluate(()=>window.quota.getState());
      const limited=structuredClone(baseline);
      limited.providers.claude.status='unavailable';limited.providers.claude.reading=null;
      limited.providers.claude.error='服務暫時限制查詢頻率，等待後將自動重試';limited.providers.claude.nextPollAt=Date.now()+3600000;
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
    await app.close();app=await launch();page=await app.firstWindow();
    await page.locator('html[lang="ko"]').waitFor();
    await page.evaluate(()=>window.quota.settings({locale:'unsupported'}));
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.locale,'ko');
    const report={passed:true,packaged:!!executablePath,locales:['zh-TW','en','ja','ko'],checks:['settings layout and screenshots in all languages','three provider login details','Claude authorization-code form','Claude verification waiting and cancel control','authorization completed separately from quota cooldown','timeout error with retry','expanded source details','percentage toggle has no wrapping','all quota cards fit','immediate translation and Chinese restoration','language persists across restart','invalid language ignored']};
    await fs.writeFile('test-results/i18n.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  }finally{await app.close();await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1});

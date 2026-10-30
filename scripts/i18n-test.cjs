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
    await fs.mkdir('test-results',{recursive:true});
    for(const locale of ['en','ja','ko','zh-TW']){
      await page.locator('#language').selectOption(locale);
      await page.locator('#mode-label').filter({hasText:names[locale]}).waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'),locale);
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
      await page.locator('#settings-toggle').click();
    }
    await page.locator('#language').selectOption('ko');
    await page.locator('html[lang="ko"]').waitFor();
    await app.close();app=await launch();page=await app.firstWindow();
    await page.locator('html[lang="ko"]').waitFor();
    await page.evaluate(()=>window.quota.settings({locale:'unsupported'}));
    assert.equal((await page.evaluate(()=>window.quota.getState())).settings.locale,'ko');
    console.log(JSON.stringify({passed:true,packaged:!!executablePath,checks:['four language selector options','immediate translation','HTML language tag','all quota cards fit','account login translated','Chinese restored after switching','language persists across restart','invalid language ignored']},null,2));
  }finally{await app.close();await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(error=>{console.error(error);process.exitCode=1});

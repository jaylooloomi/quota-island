const {test}=require('node:test');
const assert=require('node:assert/strict');
const {locales,dictionaries,normalizeLocale,translate}=require('../src/ui/i18n');
test('all four languages have matching complete catalog keys and safe locale fallback',()=>{
  for(const locale of locales){
    assert.deepEqual(Object.keys(dictionaries[locale]),Object.keys(dictionaries['zh-TW']));
    for(const value of Object.values(dictionaries[locale]))assert.ok(value.trim());
  }
  assert.equal(normalizeLocale('bad'),'zh-TW');
  assert.equal(translate('剩餘','bad'),'剩餘');
  assert.equal(translate('Codex','en'),'Codex');
});
test('translation handles all supported time patterns and safe diagnostic summaries',()=>{
  for(const locale of ['en','ja','ko'])for(const text of ['3 分鐘前同步','2 小時前同步','4 分鐘後重設','3 天 2 小時後重設','2 小時 0 分後自動重試','連接你的 Claude 帳號以讀取配額資訊。','1.5 小時','Codex 配額即將用完','Pro 已使用 95%','服務回覆 HTTP 429 · 自動同步','未知查詢頻率錯誤','未知授權碼錯誤','未知 CLI 錯誤','未知登入錯誤','未知錯誤']){
    assert.ok(translate(text,locale));assert.notEqual(translate(text,locale),text);
  }
  assert.equal(translate('', 'en'),'');
});

test('DOM localization restores originals across languages and translates accessibility attributes',()=>{
  const {localizeDocument}=require('../src/ui/i18n');
  const text={nodeValue:' 剩餘 ',parentElement:{closest:()=>false}};
  const skipped={nodeValue:'日本語',parentElement:{closest:()=>true}};
  const attrs={title:'設定','aria-label':'語言',placeholder:'Claude 授權碼'};
  const el={hasAttribute:key=>key in attrs,getAttribute:key=>attrs[key],setAttribute:(key,value)=>attrs[key]=value};
  const document={documentElement:{},body:{},createTreeWalker:()=>{let i=0;return {nextNode:()=>[text,skipped][i++]};},querySelectorAll:()=>[el]};
  localizeDocument(document,'en');assert.equal(text.nodeValue,' Remaining ');assert.equal(attrs.title,'Settings');
  localizeDocument(document,'ja');assert.equal(text.nodeValue,' 残り ');assert.equal(attrs.title,'設定');
  localizeDocument(document,'zh-TW');assert.equal(text.nodeValue,' 剩餘 ');
  text.nodeValue='已用';attrs.title='本機執行';localizeDocument(document,'ko');
  assert.equal(text.nodeValue,'사용');assert.equal(attrs.title,'로컬 실행');assert.equal(skipped.nodeValue,'日本語');
});
test('localized countdowns and login messages preserve values and account identity',()=>{
  assert.equal(translate('2 小時 24 分後重設','en'),'Resets in 2h 24m');
  assert.equal(translate('約 32 分鐘後自動重試','ja'),'約32分後に再試行');
  assert.equal(translate('登入 Claude 並同步 →','ko'),'Claude 로그인 →');
  assert.equal(translate('登入 Claude（管理授權） →','en'),'Sign in to Claude →');
  assert.equal(translate('7 天','ja'),'7日');
  assert.equal(translate('ChatGPT 訂閱','en'),'ChatGPT plan');
  assert.equal(translate('每週','ko'),'주간');
  assert.match(translate('目前限制的是配額查詢，不代表已登出。可登入或更新授權；重新登入不會解除限流。約 32 分鐘後自動重試。','en'),/Retry in ~32m/);
});

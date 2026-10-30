'use strict';
const api=window.quota;
const ids=['claude','gemini','codex'];
const names={claude:'Claude',gemini:'Gemini',codex:'Codex'};
const subtitles={claude:'Claude Code',gemini:'CLI / Code Assist',codex:'ChatGPT 訂閱'};
const presentation=window.QuotaPresentation;
const $=id=>document.getElementById(id);
const cardNodes={};
let state,settingsOpen=false,activeDetail=null,draggedProvider=null,suppressClickUntil=0;
let currentView='quota',confirmLogout=null,logoutBusy=null;
function setView(view){currentView=view;settingsOpen=false;activeDetail=null;confirmLogout=null;render(state);}
const previousPending=new Map();
function orderProviders(order){
  const strip=$('provider-strip');
  for(const [index,id] of order.entries()){
    const button=strip.querySelector(`[data-provider="${id}"]`);
    if(strip.children[index]!==button)strip.insertBefore(button,strip.children[index]??null);
    if($('cards').children[index]!==cardNodes[id])$('cards').insertBefore(cardNodes[id],$('cards').children[index]??null);
  }
}
function moveProvider(id,target){
  if(!state||id===target)return;
  const order=[...state.settings.order],to=order.indexOf(target);
  order.splice(order.indexOf(id),1);order.splice(to,0,id);
  state.settings.order=order;orderProviders(order);api.settings({order});
}
function finishDrag(){draggedProvider=null;suppressClickUntil=Date.now()+400;document.querySelectorAll('.reordering,.reorder-target').forEach(node=>node.classList.remove('reordering','reorder-target'));}
function enableReorder(node,id,targetNode=node){
  node.draggable=true;
  node.addEventListener('dragstart',event=>{
    if(event.target.closest('button,input')&&event.target.closest('button')!==node){event.preventDefault();return;}
    draggedProvider=id;suppressClickUntil=Date.now()+600;
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-quota-provider',id);targetNode.classList.add('reordering');
  });
  targetNode.addEventListener('dragover',event=>{if(draggedProvider&&draggedProvider!==id){event.preventDefault();event.dataTransfer.dropEffect='move';targetNode.classList.add('reorder-target');}});
  targetNode.addEventListener('dragleave',event=>{if(!targetNode.contains(event.relatedTarget))targetNode.classList.remove('reorder-target');});
  targetNode.addEventListener('drop',event=>{if(!draggedProvider)return;event.preventDefault();moveProvider(draggedProvider,id);finishDrag();});
  node.addEventListener('dragend',finishDrag);
}
function elapsed(date){
  if(!date)return '尚未同步';
  const seconds=Math.max(0,(Date.now()-Date.parse(date))/1000);
  return seconds<60?'剛剛同步':seconds<3600?`${Math.floor(seconds/60)} 分鐘前同步`:`${Math.floor(seconds/3600)} 小時前同步`;
}
function countdown(date){
  if(!date)return '重設時間未提供';
  const remaining=Math.max(0,Date.parse(date)-Date.now());
  if(!remaining)return '已到重設時間 · 等待同步';
  const minutes=Math.ceil(remaining/60000),hours=Math.floor(minutes/60);
  if(minutes<60)return `${minutes} 分鐘後重設`;
  if(hours<24)return `${hours} 小時 ${minutes%60} 分後重設`;
  return `${Math.floor(hours/24)} 天 ${hours%24} 小時後重設`;
}
function percent(w){return Math.round(state.settings.remaining?100-w.usedPercent:w.usedPercent);}
function retryLabel(s){
  if(!s.nextPollAt||s.nextPollAt<=Date.now())return '';
  const minutes=Math.max(1,Math.ceil((s.nextPollAt-Date.now())/60000));
  return minutes>=60?`${Math.floor(minutes/60)} 小時 ${minutes%60} 分後自動重試`:`約 ${minutes} 分鐘後自動重試`;
}
function resetLabel(id,date){
  const formatted=presentation.resetDate(date,state.settings.locale);
  return formatted?`下次重置 ${formatted}`:'重設時間未提供';
}
function tone(w){return w.usedPercent>=95?'danger':w.usedPercent>=80?'warning':'';}
function ready(s){return s.enabled&&s.status==='ready'&&s.reading&&(!s.updatedAt||Date.now()-Date.parse(s.updatedAt)<24*3600000);}
function sourceFor(id){
  if(id==='gemini')return state.settings.googleSource==='antigravity'?'Antigravity 本機服務的 Gemini 模型配額；沿用 Antigravity 帳號，需保持 Antigravity 執行。這不是 Gemini 網頁版或企業 Code Assist 額度。':'企業 Code Assist OAuth 配額；個人版請選擇 Antigravity 來源。';
  return id==='codex'?'官方 Codex app-server · account/rateLimits/read。由 Codex CLI 管理 ChatGPT 帳號授權。':'官方 Claude Code 管理登入，讀取本機授權後查詢 Claude OAuth 用量端點。';
}
function startLogin(id){activeDetail=id;void api.login(id);}
function makeCards(){
  for(const id of ids){
    const card=$('card-template').content.firstElementChild.cloneNode(true);card.classList.add(id);card.dataset.provider=id;
    card.querySelector('h2').textContent=names[id];card.querySelector('.provider-subtitle').textContent=subtitles[id];
    const logo=document.createElement('img');logo.src=`icons/${id}.svg`;logo.alt='';logo.draggable=false;card.querySelector('.provider-icon').append(logo);
    card.querySelector('.connection-logo').src=`icons/${id}.svg`;
    const heading=card.querySelector('.card-heading');heading.title='拖曳調整卡片順序';enableReorder(heading,id,card);
    card.querySelector('.connection-status').addEventListener('click',()=>{activeDetail=activeDetail===id?null:id;render(state);});
    card.querySelector('.close-connection').addEventListener('click',()=>{activeDetail=null;render(state);});
      card.querySelector('.connect-primary').addEventListener('click',()=>{const s=state.providers[id];if(s.status==='unavailable'&&!/429|限制查詢|查詢頻率/.test(s.error??''))void api.refresh();else startLogin(id);});
    card.querySelector('.login').addEventListener('click',()=>startLogin(id));
    card.querySelector('.account-switch').addEventListener('click',async()=>{
      if(id==='gemini'&&state.settings.googleSource==='antigravity'){
        activeDetail=id;render(state);const result=await api.openAntigravity();
        if(!result.ok){state.auth[id]={pending:false,phase:'error',message:result.message};render(state);}
      }else startLogin(id);
    });
    card.querySelector('.account-logout').addEventListener('click',()=>{confirmLogout=id;render(state);});
    card.querySelector('.cancel-logout').addEventListener('click',()=>{confirmLogout=null;render(state);});
    card.querySelector('.confirm-logout').addEventListener('click',async()=>{
      logoutBusy=id;render(state);
      let result;
      try{result=await api.logout(id);}catch{result={ok:false,message:'登出未完成，請稍後重試'};}
      finally{logoutBusy=null;confirmLogout=null;const next=await api.getState();if(!result?.ok){next.auth[id]={pending:false,phase:'error',message:result?.message};activeDetail=id;}render(next);}
    });
    card.querySelector('.cancel-login').addEventListener('click',()=>api.cancelLogin(id));
    card.querySelector('.provider-link').addEventListener('click',()=>api.openProvider(id));
    card.querySelector('.reopen-login').addEventListener('click',()=>api.reopenLogin(id));
    card.querySelector('.auth-code-form').addEventListener('submit',event=>{event.preventDefault();const input=card.querySelector('.auth-code'),code=input.value.trim();input.value='';if(code)api.submitCode(id,code);});
    card.querySelector('.setup-links button').addEventListener('click',()=>api.openProvider(`install-${id}`));
    $('cards').append(card);cardNodes[id]=card;
    const miniTrack=document.createElement('span');miniTrack.className='mini-track';miniTrack.innerHTML='<span></span>';
    document.querySelector(`.compact-provider[data-provider="${id}"] .mini-info`).append(miniTrack);
  }
}
function renderConnection(id,s,auth){
  const card=cardNodes[id],connected=ready(s),antigravity=id==='gemini'&&state.settings.googleSource==='antigravity';
  const details=card.querySelector('.connection-details');details.hidden=activeDetail!==id;
  card.classList.toggle('details-open',!details.hidden);
  card.querySelector('.connection-status').setAttribute('aria-expanded',String(!details.hidden));
  card.querySelector('.connection-description').textContent=id==='codex'?'登入要監控的 ChatGPT 訂閱帳號，可與 Claude、Gemini 使用不同帳號。':antigravity?'沿用 Antigravity 的 Google 帳號，讀取 Gemini 配額資訊。':`連接你的 ${id==='gemini'?'Google':names[id]} 帳號以讀取配額資訊。`;
  card.querySelector('.connection-account h4').textContent=id==='claude'?'Claude Code':id==='codex'?'Codex':antigravity?'Antigravity · Gemini':'Google Code Assist';
  const phase=auth?.phase;
  const step=connected?4:phase==='syncing'||phase==='cooldown'?2:phase==='connecting'||phase==='verifying'?1:0;
  card.querySelector('.connection-steps').style.setProperty('--progress',`${Math.min(100,step/3*100)}%`);
  for(const node of card.querySelectorAll('.connection-steps li')){
    const index=Number(node.dataset.step);node.classList.toggle('done',index<step);node.classList.toggle('active',index===step&&!!auth?.pending);
    node.querySelector('span').textContent=index<step?'✓':String(index+1);
  }
  const message=card.querySelector('.auth-message');
  message.textContent=auth?.pending||['error','cooldown'].includes(auth?.phase)?auth.message:connected?'已連接，配額已自動同步':s.error||'完成授權後會自動同步配額。';
  message.classList.toggle('success',!!connected);message.classList.toggle('error',phase==='error'||(!auth?.pending&&phase!=='cooldown'&&['stale','unavailable'].includes(s.status)));
  const text=phase==='syncing'?'自動同步中…':phase==='connecting'?'連接中…':auth?.pending?'等待授權…':id==='codex'?(connected?'切換 Codex 帳號 →':'登入 Codex（ChatGPT） →'):connected?'重新連接':antigravity?'連接 Antigravity 並同步 →':`登入 ${id==='gemini'?'Google':names[id]} 並同步 →`;
  for(const button of [card.querySelector('.login'),card.querySelector('.connect-primary')]){button.textContent=text;button.disabled=!!auth?.pending||!s.enabled;}
  if(phase==='verifying')card.querySelector('.login').textContent='驗證授權碼中…';
  const limited=/429|限制查詢|查詢頻率/.test(s.error??'');
  card.querySelector('.connect-primary').hidden=false;
  if(limited&&!auth?.pending){for(const button of [card.querySelector('.login'),card.querySelector('.connect-primary')])button.textContent=`登入 ${id==='gemini'?'Google':names[id]}（管理授權） →`;}
  else if(s.status==='unavailable')card.querySelector('.connect-primary').textContent='重新同步';
  else if(s.status==='loading'){card.querySelector('.connect-primary').textContent='同步中…';card.querySelector('.connect-primary').disabled=true;}
  card.querySelector('.connection-note').textContent=limited?`目前限制的是配額查詢，不代表已登出。可登入或更新授權；重新登入不會解除限流。${retryLabel(s)||'冷卻後自動重試'}。`:'登入完成後自動更新，不必手動查用量。';
  if(id==='codex')card.querySelector('.connection-note').textContent+=' Codex 使用獨立的 OpenAI／ChatGPT 授權；切換會同步更新本機 Codex CLI 的帳號，不會登出 Claude 或 Gemini。瀏覽器若帶入其他帳號，請選擇使用其他帳號登入。';
  if(auth?.pending)card.querySelector('.connection-note').textContent=phase==='verifying'?'正在等待官方登入程序完成驗證；配額限流不會阻止帳號授權。':'請在瀏覽器完成登入；若選錯帳號，可取消後重試。';
  card.querySelector('.cancel-login').hidden=id!=='claude'||!auth?.pending||phase==='syncing';
  card.querySelector('.auth-code-form').hidden=!auth?.pending||!auth?.codeRequired;
  card.querySelector('.reopen-login').hidden=!auth?.pending||!auth?.canReopen||phase==='syncing';
  card.querySelector('.provider-link').hidden=!s.reading;
  card.querySelector('.setup-links').hidden=id==='gemini'||!s.error?.includes('CLI');
  card.querySelector('.source p').textContent=s.reading?.source||sourceFor(id);
}
function renderCard(id){
  const s=state.providers[id],card=cardNodes[id],auth=state.auth[id];
  const expired=s.updatedAt&&Date.now()-Date.parse(s.updatedAt)>24*3600000;
  const windows=s.enabled&&!expired?presentation.groupWindows(s.reading?.windows??[]):[];
  card.classList.remove('ready','stale','signed_out','loading','unavailable','disabled');card.classList.add(!s.enabled?'disabled':expired?'unavailable':s.status);
  card.classList.toggle('pending',!!auth?.pending);
  const usesAntigravity=id==='gemini'&&state.settings.googleSource==='antigravity';
  const limited=/429|限制查詢|查詢頻率/.test(s.error??'');
  card.querySelector('.provider-subtitle').textContent=id==='gemini'?(state.demo?'CLI / Code Assist':usesAntigravity?'Antigravity':'Code Assist · 企業版'):subtitles[id];
  const plan=card.querySelector('.plan');plan.textContent=s.reading?.plan??'';plan.hidden=!s.reading?.plan;plan.title=s.reading?.plan??'';
  let status=!s.enabled?'已暫停':s.status==='ready'?'已連接':s.status==='stale'?'更新失敗':s.status==='loading'?'同步中':s.status==='signed_out'?'未連接':limited?'服務限流':'讀取失敗';
  if(expired)status='資料過期';if(auth?.pending)status=auth.phase==='syncing'?'同步中':'連接中';
  card.querySelector('.status-label').textContent=status;
  const updated=card.querySelector('.updated');updated.textContent=elapsed(s.updatedAt);updated.title=s.error??(s.updatedAt?new Date(s.updatedAt).toLocaleString():'尚未同步');
  const container=card.querySelector('.quota-windows');container.replaceChildren();container.classList.toggle('single',windows.length===1);container.hidden=!windows.length;
  for(const w of windows){
    const row=$('window-template').content.firstElementChild.cloneNode(true);if(tone(w))row.classList.add(tone(w));
    row.querySelector('.window-label').textContent=presentation.windowLabel(w.label);row.querySelector('.window-label').title=w.variants.join(' / ');
    const value=percent(w);row.querySelector('.quota-number').textContent=`${value}%`;
    const track=row.querySelector('.track');track.setAttribute('aria-valuenow',String(value));track.setAttribute('aria-label',`${names[id]} ${w.label} ${state.settings.remaining?'剩餘':'已用'}`);
    row.querySelector('.fill').style.width=`${value}%`;
    row.querySelector('.reset').textContent=resetLabel(id,w.resetsAt);
    if(presentation.resetDate(w.resetsAt,state.settings.locale)){
      row.querySelector('.reset').title=new Intl.DateTimeFormat(state.settings.locale,{dateStyle:'full',timeStyle:'long'}).format(new Date(w.resetsAt));
      row.querySelector('.reset').setAttribute('data-localized-title','');
      row.querySelector('.reset').dataset.countdown=countdown(w.resetsAt);
      row.querySelector('.reset').title+=' · '+window.QuotaI18n.translate(countdown(w.resetsAt),state.settings.locale);
    }
    container.append(row);
  }
  const empty=card.querySelector('.empty-state');empty.hidden=!!windows.length;
  card.querySelector('.empty-title').textContent=!s.enabled?'已暫停此來源':auth?.pending?(auth.codeRequired?'等待授權碼':auth.phase==='syncing'?'連接完成，正在同步…':'等待帳號連接…'):s.status==='signed_out'?'連接你的帳號':s.status==='loading'?'正在讀取配額…':expired?'資料已過期':limited?'配額服務暫時限流':'暫時無法取得配額';
  const errorText=limited?['服務回覆 HTTP 429',retryLabel(s)].filter(Boolean).join(' · '):s.error?[s.error,retryLabel(s)].filter(Boolean).join(' · '):'';
  card.querySelector('.empty-message').textContent=!s.enabled?'在設定中開啟來源即可恢復同步。':auth?.pending||auth?.phase==='error'?auth.message:errorText||'完成連接後，配額會自動出現在這裡。';
  card.querySelector('.empty-message').title=s.error??'';
  renderConnection(id,s,auth);
  const accountActions=card.querySelector('.account-actions');accountActions.hidden=currentView!=='accounts'||activeDetail===id;
  const switchButton=card.querySelector('.account-switch');switchButton.textContent=usesAntigravity?'前往 Antigravity 切換':ready(s)?'切換帳號':'登入帳號';
  switchButton.disabled=!!auth?.pending||logoutBusy===id||!s.enabled;
  const logoutButton=card.querySelector('.account-logout');logoutButton.hidden=id==='gemini'||!s.reading;logoutButton.disabled=!!auth?.pending||logoutBusy===id;
  card.querySelector('.logout-confirm').hidden=confirmLogout!==id;
  for(const button of card.querySelectorAll('.logout-confirm button'))button.disabled=logoutBusy===id;
  const mini=$(`mini-${id}`),windowLabel=$(`window-${id}`),button=document.querySelector(`.compact-provider[data-provider="${id}"]`),w=windows[0];
  button.classList.toggle('unconnected',!w);button.classList.toggle('disabled',!s.enabled);button.classList.toggle('stale',s.status==='stale');
  mini.className=`mini-value${w?'':' unknown'}`;
  mini.textContent=!s.enabled?'暫停':expired?'資料過期':s.status==='stale'?'更新失敗':w?`${percent(w)}%`:s.status==='loading'?'同步中':s.status==='signed_out'?'未連接':limited?'限流中':'讀取失敗';
  windowLabel.textContent=s.status==='stale'&&w?`${percent(w)}%`:w?presentation.shortWindow(w.label):'';
  windowLabel.setAttribute('aria-label',s.status==='stale'&&w?`上次資料 ${percent(w)}%`:windowLabel.textContent);
  if(id==='codex')button.querySelector('.mini-logo').src=s.status==='stale'?'icons/codex-error.svg':'icons/codex.svg';
  button.querySelector('.mini-alert').hidden=s.status!=='stale'&&s.status!=='unavailable';
  mini.title=w?`${names[id]} · ${w.label} · ${state.settings.remaining?'剩餘':'已用'} ${percent(w)}%${s.status==='stale'?' · 舊資料':''}`:s.error||status;
  button.querySelector('.mini-track').hidden=!w;
  button.querySelector('.mini-track span').style.width=w?`${percent(w)}%`:'0%';
}
function render(next){
  if(!next)return;state=next;
  for(const id of ids){
    const wasPending=previousPending.get(id),pending=!!state.auth[id]?.pending;
    if(pending&&!wasPending)activeDetail=id;
    if(wasPending&&!pending&&state.auth[id]?.phase==='ready')setTimeout(()=>{if(activeDetail===id&&state.auth[id]?.phase==='ready'){activeDetail=null;render(state);}},1200);
    previousPending.set(id,pending);
  }
  orderProviders(state.settings.order??ids);$('island').classList.toggle('expanded',state.expanded);$('panel').hidden=!state.expanded;
  $('toggle').setAttribute('aria-expanded',String(state.expanded));
  $('compact-mode').textContent=state.settings.remaining?'剩餘':'已用';$('mode-label').textContent=state.settings.remaining?'剩餘額度':'已用額度';
  $('mode-remaining').setAttribute('aria-pressed',String(state.settings.remaining));$('mode-used').setAttribute('aria-pressed',String(!state.settings.remaining));
  $('demo-banner').hidden=!state.demo;$('app-version').textContent=`v${state.version}`;
  for(const id of ['compact-version','header-version','footer-version'])$(id).textContent=`v${state.version}`;
  $('island').classList.toggle('accounts-view',currentView==='accounts');
  $('island').classList.toggle('settings-view',settingsOpen);
  $('settings').hidden=!settingsOpen;
  $('settings-toggle').setAttribute('aria-expanded',String(settingsOpen));
  $('cards').hidden=settingsOpen;
  for(const view of ['quota','accounts']){$(`tab-${view}`).setAttribute('aria-selected',String(view===currentView));$(`tab-${view}`).tabIndex=view===currentView?0:-1;}
  $('cards').setAttribute('role','tabpanel');$('cards').setAttribute('aria-labelledby',`tab-${currentView}`);
  const healthy=!state.paused&&ids.some(id=>ready(state.providers[id]));$('live-dot').classList.toggle('off',!healthy);
  document.querySelector('.footer-dot').classList.toggle('off',!healthy);$('footer-status').textContent=state.paused?'已暫停同步':'自動同步';
  for(const key of ['alwaysOnTop','notifications'])$(key).checked=state.settings[key];
  $('google-source').value=state.settings.googleSource;$('google-source').disabled=!!state.auth.gemini?.pending;
  for(const input of document.querySelectorAll('[data-enable]'))input.checked=state.settings.enabled[input.dataset.enable];
  ids.forEach(renderCard);
  $('language').value=state.settings.locale??'zh-TW';
  window.QuotaI18n.localizeDocument(document,state.settings.locale);
  if(state.settings.locale==='en')$('compact-mode').textContent=state.settings.remaining?'Left':'Used';
}
makeCards();
document.querySelectorAll('[data-expand]').forEach(button=>{
  enableReorder(button,button.dataset.provider);
  button.addEventListener('click',()=>{if(!draggedProvider&&Date.now()>suppressClickUntil)api.expand(true);});
  button.addEventListener('keydown',event=>{if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key)||!state)return;const order=state.settings.order,index=order.indexOf(button.dataset.provider),target=order[index+(event.key==='ArrowLeft'?-1:1)];if(target){event.preventDefault();moveProvider(button.dataset.provider,target);button.focus();}});
});
$('toggle').addEventListener('click',()=>api.expand(true));$('collapse').addEventListener('click',()=>api.expand(false));
$('refresh').addEventListener('click',async()=>{$('refresh').disabled=true;$('refresh').classList.add('spinning');try{await api.refresh();}finally{$('refresh').classList.remove('spinning');setTimeout(()=>{$('refresh').disabled=false;},700);}});
$('settings-toggle').addEventListener('click',()=>{settingsOpen=!settingsOpen;$('settings-toggle').setAttribute('aria-expanded',String(settingsOpen));render(state);});
$('mode-remaining').addEventListener('click',()=>api.settings({remaining:true}));$('mode-used').addEventListener('click',()=>api.settings({remaining:false}));
$('hide').addEventListener('click',()=>api.hide());$('quit').addEventListener('click',()=>api.quit());
$('google-source').addEventListener('change',event=>api.settings({googleSource:event.target.value}));
for(const view of ['quota','accounts'])$(`tab-${view}`).addEventListener('click',()=>setView(view));
document.querySelector('.view-tabs').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const view=event.key==='Home'?'quota':event.key==='End'?'accounts':currentView==='quota'?'accounts':'quota';setView(view);$(`tab-${view}`).focus();}});
$('accounts-shortcut').addEventListener('click',()=>setView('accounts'));
$('language-shortcut').addEventListener('click',()=>{settingsOpen=true;activeDetail=null;render(state);$('language').focus();});
$('compact-refresh').addEventListener('click',()=>api.refresh());
$('language').addEventListener('change',event=>api.settings({locale:event.target.value}));
for(const key of ['alwaysOnTop','notifications'])$(key).addEventListener('change',event=>api.settings({[key]:event.target.checked}));
for(const input of document.querySelectorAll('[data-enable]'))input.addEventListener('change',()=>api.settings({enabled:{[input.dataset.enable]:input.checked}}));
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(confirmLogout){confirmLogout=null;render(state);}else if(activeDetail){activeDetail=null;render(state);}else if(settingsOpen){settingsOpen=false;$('settings-toggle').setAttribute('aria-expanded','false');render(state);}else api.expand(false);});
api.subscribe(render);api.getState().then(render);setInterval(()=>{if(state)render(state);},15000);

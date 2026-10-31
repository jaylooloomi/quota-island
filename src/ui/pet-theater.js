(function(){
  const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let state,playing=false,previewPlaying=false,idle=false,lastAlert=0,nextIdle=Date.now()+120000+Math.random()*180000,idleIndex=0,finishTimer,phaseTimer;
  let seen={};try{seen=JSON.parse(localStorage.getItem('quota-pet-alerts')||'{}');if(!seen||Array.isArray(seen)||typeof seen!=='object')seen={};}catch{}
  const text=value=>window.QuotaI18n.translate(value,state?.settings.locale??'zh-TW');
  const brand=document.querySelector('.compact-brand');
  const brandPet=document.createElement('span');brandPet.className='pet-sprite brand-pet';brandPet.setAttribute('aria-hidden','true');brand.append(brandPet);
  function sprite(el,provider,pose=0){el.style.setProperty('--pet-row',provider==='codex'?50:provider==='gemini'?100:0);el.style.setProperty('--pet-pose',pose*50);}
  function stop(){clearTimeout(finishTimer);clearTimeout(phaseTimer);playing=false;previewPlaying=false;idle=false;$('pet-stage').hidden=true;$('island').classList.remove('pet-playing');brand.classList.remove('pet-idle');void window.quota.petHeight(0);nextIdle=Date.now()+120000+Math.random()*180000;}
  function alert(event,preview=false){
    stop();playing=true;previewPlaying=preview;if(!preview){lastAlert=Date.now();seen=window.QuotaPetPolicy.claim(seen,event);try{localStorage.setItem('quota-pet-alerts',JSON.stringify(seen));}catch{}}
    const account=preview?text('預覽・展示資料'):state.accounts?.find(a=>a.id===event.id)?.label??(event.provider==='gemini'?'Antigravity':event.provider==='codex'?'Codex':'Claude');
    $('pet-caption').textContent=`${account} · ${text(event.label)} · ${text('剩餘')} ${event.remaining}%`;
    $('pet-caption').title=`${account} · ${event.label} · ${window.QuotaPresentation.resetDate(event.reset,state.settings.locale)}`;
    $('pet-message').textContent=text(event.level===3?'額度用盡，先休息一下':event.level===2?'能源即將用盡，放慢腳步':'能源偏低，救援隊出動');
    for(const el of $('pet-stage').querySelectorAll('.pet-sprite'))sprite(el,el.dataset.pet,el.dataset.pet===event.provider?1:0);
    $('pet-stage').dataset.affected=event.provider;$('pet-stage').dataset.phase='warning';$('pet-stage').hidden=false;$('island').classList.add('pet-playing');
    $('pet-close').setAttribute('aria-label',text('關閉小劇場'));
    void window.quota.petHeight(112);
    if(!reduced.matches)phaseTimer=setTimeout(()=>{if(!playing)return;$('pet-stage').dataset.phase='rescue';for(const el of $('pet-stage').querySelectorAll('.pet-sprite'))sprite(el,el.dataset.pet,el.dataset.pet===event.provider?2:el.dataset.pet==='codex'?1:0);$('pet-message').textContent=text(event.level===3?'等待重置，一起充電':'補給一下，保持配速');},1800);
    finishTimer=setTimeout(stop,4400);
  }
  function check(){
    if(!state||state.expanded||document.hidden||state.paused){if(playing||idle)stop();return;}
    if(playing){if(!previewPlaying&&state.settings.petAlerts===false)stop();return;}
    if(window.quotaPetDragging||document.querySelector('.reordering')){if(idle)stop();return;}
    const event=window.QuotaPetPolicy.events(state,seen)[0];
    if(event&&Date.now()-lastAlert>=30000){alert(event);return;}
    if(state.settings.petIdle===false||reduced.matches){if(idle)stop();return;}
    if(!idle&&Date.now()>=nextIdle&&!brand.matches(':hover')){
      idle=true;sprite(brandPet,['claude','codex','gemini'][idleIndex++%3]);brand.classList.add('pet-idle');finishTimer=setTimeout(stop,4500);
    }
  }
  $('pet-close').addEventListener('click',stop);
  window.quota.onPetSuspend(stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else nextIdle=Date.now()+120000+Math.random()*180000;});
  document.addEventListener('dragstart',()=>{window.quotaPetDragging=true;stop();});document.addEventListener('dragend',()=>{window.quotaPetDragging=false;});document.addEventListener('drop',()=>{window.quotaPetDragging=false;});
  reduced.addEventListener('change',()=>{if(idle)stop();});
  setInterval(check,1000);
  window.QuotaPets={update(next){state=next;check();},preview(){if(state&&!state.expanded)alert({provider:'claude',id:'claude',label:'每週',remaining:15,reset:new Date(Date.now()+86400000).toISOString(),level:1},true);}};
})();

(function(){
  const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let state,playing=false,previewPlaying=false,idle=false,idlePreview=false,lastAlert=0,nextIdle=Date.now()+120000+Math.random()*180000,idleIndex=0,finishTimer,phaseTimer,restTimer,previewLoopTimer;
  let seen={};try{seen=JSON.parse(localStorage.getItem('quota-pet-alerts')||'{}');if(!seen||Array.isArray(seen)||typeof seen!=='object')seen={};}catch{}
  const text=value=>window.QuotaI18n.translate(value,state?.settings.locale??'zh-TW');
  const brand=document.querySelector('.compact-brand');
  const brandPet=document.createElement('span');brandPet.className='pet-sprite brand-pet';brandPet.setAttribute('aria-hidden','true');brand.append(brandPet);
  let nativeSuspended=false,roaming=false,roamWanted=false,roamRequest=0,roamTicket=0,lastRole=null;
  const roamPet=document.createElement('span');roamPet.id='roam-pet';roamPet.hidden=true;roamPet.setAttribute('aria-hidden','true');const roamCanvas=document.createElement('canvas');roamCanvas.width=144;roamCanvas.height=144;roamCanvas.className='pet-canvas';roamPet.append(roamCanvas);$('pet-stage').append(roamPet);
  function roam(manual=false,requested){
    if(!state||state.expanded||document.hidden||state.paused)return;
    if(manual)stop();else if(playing||roaming)return;
    stop();roaming=true;if(manual)roamWanted=true;const ticket=++roamTicket,roles=['claude','codex','gemini','octopus'].filter(id=>id!==lastRole),role=['claude','codex','gemini','octopus'].includes(requested)?requested:roles[Math.floor(Math.random()*roles.length)];lastRole=role;
    window.QuotaPetAnimation.load('walk').then(frames=>{
      if(ticket!==roamTicket||!roaming)return;
      const stage=$('pet-stage');stage.dataset.phase='roam';stage.hidden=false;roamPet.hidden=false;roamPet.dataset.role=role;$('island').classList.add('pet-playing');
      $('pet-caption').textContent=`${text('太空散步')} · ${role==='claude'?'Claude':role==='codex'?'Codex':role==='octopus'?text('小章魚'):'Antigravity'}`;$('pet-caption').title=text('隨機角色陪伴，不代表帳號配額');$('pet-message').style.width='68px';$('pet-close').setAttribute('aria-label',text('關閉散步'));void window.quota.petHeight(112);
      const path=window.QuotaPetWander.create(stage.clientWidth);let last=performance.now(),elapsed=0,previous='';
      const step=time=>{
        roamRequest=0;if(!roaming||document.hidden)return;
        const dt=(time-last)/1000;last=time;const position=path.step(reduced.matches?0:dt);if(position.moving&&!reduced.matches)elapsed+=dt*1000*position.speed/38;
        roamPet.style.transform=`translateX(${position.x}px)`;roamCanvas.style.transform=`scaleX(${position.face})`;roamPet.dataset.moving=String(position.moving&&!reduced.matches);
        const message=reduced.matches?'陪你休息':position.moving?'職守中':'休息一下';if(message!==previous){$('pet-message').textContent=text(message);previous=message;}
        const sample=window.QuotaPetAnimation.sample('walk',role,position.moving?elapsed:0,reduced.matches),ctx=roamCanvas.getContext('2d');ctx.clearRect(0,0,144,144);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1-sample.mix;ctx.drawImage(frames[role][sample.frame],0,0);if(sample.mix){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=sample.mix;ctx.drawImage(frames[role][sample.next],0,0);}ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';roamPet.dataset.frame=String(sample.frame);
        if(!reduced.matches)roamRequest=requestAnimationFrame(step);
      };
      step(last);
    }).catch(()=>{if(ticket===roamTicket)stop();});
  }
  let frameRequest=0,animationStart=0,atlas=null,style=null,assetVersion=0;
  const actors=[brandPet,...$('pet-stage').querySelectorAll('.pet-sprite')];
  for(const el of actors){const canvas=document.createElement('canvas');canvas.width=144;canvas.height=144;canvas.className='pet-canvas';canvas.setAttribute('aria-hidden','true');el.append(canvas);}
  function draw(time){
    frameRequest=0;if((!playing&&!idle)||document.hidden||!atlas)return;
    const elapsed=time-animationStart;
    for(const el of actors){if(el===brandPet?!idle:!playing||el.hidden)continue;const provider=el.dataset.actor??el.dataset.pet,frames=atlas[provider];if(style==='classic'&&provider!=='octopus')continue;if(!frames)continue;const sample=window.QuotaPetAnimation.sample(provider==='octopus'?'hello':style,provider,elapsed,reduced.matches),canvas=el.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,144,144);ctx.imageSmoothingEnabled=style!=='pixel';ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1-sample.mix;ctx.drawImage(frames[sample.frame],0,0);if(sample.mix){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=sample.mix;ctx.drawImage(frames[sample.next],0,0);}ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';el.dataset.frame=String(sample.frame);}
    if(!reduced.matches)frameRequest=requestAnimationFrame(draw);
  }
  function startAnimation(){cancelAnimationFrame(frameRequest);animationStart=performance.now();if(atlas)draw(animationStart);}
  function chooseStyle(next){
    const selected=['classic','smooth','pixel'].includes(next)?next:'smooth';if(selected===style)return;
    style=selected;atlas=null;const version=++assetVersion;cancelAnimationFrame(frameRequest);
    $('island').dataset.petStyle=style;
    window.QuotaPetAnimation.load(style).then(result=>{if(version!==assetVersion)return;atlas=result;startAnimation();}).catch(()=>{if(version!==assetVersion)return;style='classic';$('island').dataset.petStyle='classic';});
  }
  function sprite(el,provider,pose=0){el.dataset.actor=provider;el.style.setProperty('--pet-row',provider==='codex'?50:provider==='gemini'?100:0);el.style.setProperty('--pet-pose',pose*50);}
  function align(){
    if(!playing)return;
    const stage=$('pet-stage'),bounds=stage.getBoundingClientRect();
    for(const pet of stage.querySelectorAll('.pet-sprite')){
      const slot=document.querySelector(`.compact-provider[data-provider="${pet.dataset.pet}"]`),rect=slot.getBoundingClientRect();
      pet.hidden=slot.hidden||!rect.width;
      if(!pet.hidden)pet.style.left=`${rect.left+rect.width/2-bounds.left-pet.offsetWidth/2}px`;
    }
    $('pet-message').style.width=`${Math.max(56,brand.getBoundingClientRect().right-bounds.left-15)}px`;
  }
  function stop(){cancelAnimationFrame(roamRequest);roamRequest=0;roaming=false;roamTicket++;roamPet.hidden=true;cancelAnimationFrame(frameRequest);frameRequest=0;clearTimeout(finishTimer);clearTimeout(phaseTimer);clearTimeout(restTimer);clearInterval(previewLoopTimer);playing=false;previewPlaying=false;idle=false;idlePreview=false;$('pet-stage').hidden=true;$('island').classList.remove('pet-playing');brand.classList.remove('pet-idle');void window.quota.petHeight(0);nextIdle=Date.now()+120000+Math.random()*180000;}
  function alert(event,preview=false){
    stop();playing=true;previewPlaying=preview;if(!preview){lastAlert=Date.now();seen=window.QuotaPetPolicy.claim(seen,event);try{localStorage.setItem('quota-pet-alerts',JSON.stringify(seen));}catch{}}
    const account=preview?text('預覽・展示資料'):state.accounts?.find(a=>a.id===event.id)?.label??(event.provider==='gemini'?'Antigravity':event.provider==='codex'?'Codex':'Claude');
    $('pet-caption').textContent=`${account} · ${text(event.label)} · ${text('剩餘')} ${event.remaining}%`;
    $('pet-caption').title=`${account} · ${event.label} · ${window.QuotaPresentation.resetDate(event.reset,state.settings.locale)}`;
    $('pet-message').textContent=text(event.level===3?'額度用盡，先休息一下':event.level===2?'能源即將用盡，放慢腳步':'能源偏低，救援隊出動');
    for(const el of $('pet-stage').querySelectorAll('.pet-sprite'))sprite(el,el.dataset.pet,el.dataset.pet===event.provider?1:0);
    $('pet-stage').dataset.affected=event.provider;$('pet-stage').dataset.phase='warning';$('pet-stage').hidden=false;$('island').classList.add('pet-playing');
    align();requestAnimationFrame(align);
    startAnimation();
    $('pet-close').setAttribute('aria-label',text('關閉小劇場'));
    void window.quota.petHeight(112);
    const phases=()=>{
      if(!playing)return;clearTimeout(phaseTimer);clearTimeout(restTimer);$('pet-stage').dataset.phase='warning';$('pet-message').textContent=text(event.level===3?'額度用盡，先休息一下':event.level===2?'能源即將用盡，放慢腳步':'能源偏低，救援隊出動');for(const el of $('pet-stage').querySelectorAll('.pet-sprite'))sprite(el,el.dataset.pet,el.dataset.pet===event.provider?1:0);
    if(!reduced.matches)phaseTimer=setTimeout(()=>{if(!playing)return;$('pet-stage').dataset.phase='rescue';for(const el of $('pet-stage').querySelectorAll('.pet-sprite'))sprite(el,el.dataset.pet,el.dataset.pet===event.provider?2:el.dataset.pet==='codex'?1:0);$('pet-message').textContent=text(event.level===3?'等待重置，一起充電':'補給一下，保持配速');},2000);
    restTimer=setTimeout(()=>{if(!playing)return;$('pet-stage').dataset.phase='rest';$('pet-message').textContent=text(event.level===3?'等待重置，一起充電':'補給一下，保持配速');for(const el of $('pet-stage').querySelectorAll('.pet-sprite'))sprite(el,el.dataset.pet,2);},4000);
    };
    phases();if(preview&&!reduced.matches)previewLoopTimer=setInterval(phases,6000);
    finishTimer=setTimeout(stop,preview?180000:6000);
  }
  function showIdle(preview=false,requested){
    stop();idle=true;idlePreview=preview;brandPet.style.animationDuration=preview?'15s':'4.5s';sprite(brandPet,['claude','codex','gemini','octopus'].includes(requested)?requested:['claude','codex','gemini','octopus'][idleIndex++%4]);brand.classList.add('pet-idle');startAnimation();finishTimer=setTimeout(stop,preview?15000:4500);
  }
  function check(){
    if(!state||state.expanded||nativeSuspended||document.hidden||state.paused){if(playing||idle||roaming)stop();return;}
    if(playing){if(!previewPlaying&&state.settings.petAlerts===false)stop();return;}
    if(window.quotaPetDragging||document.querySelector('.reordering')){if(idle||roaming)stop();return;}
    if(idlePreview)return;
    const event=window.QuotaPetPolicy.events(state,seen)[0];
    if(event&&Date.now()-lastAlert>=30000){alert(event);return;}
    if(roaming){if(!roamWanted&&state.settings.petRoam!==true)stop();return;}
    if(state.settings.petRoam===true||roamWanted){roam();return;}
    if(state.settings.petIdle===false||reduced.matches){if(idle)stop();return;}
    if(!idle&&Date.now()>=nextIdle&&!brand.matches(':hover')){
      showIdle();
    }
  }
  $('pet-close').addEventListener('click',()=>{if(roaming){roamWanted=false;if(state?.settings.petRoam)void window.quota.settings({petRoam:false});}stop();});
  window.quota.onPetSuspend(reason=>{if(reason==='resume'){nativeSuspended=false;check();}else{nativeSuspended=reason==='drag'||reason==='hide';stop();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else nextIdle=Date.now()+120000+Math.random()*180000;});
  document.addEventListener('dragstart',()=>{window.quotaPetDragging=true;stop();});document.addEventListener('dragend',()=>{window.quotaPetDragging=false;});document.addEventListener('drop',()=>{window.quotaPetDragging=false;});
  reduced.addEventListener('change',()=>{if(idle||roaming)stop();else startAnimation();});
  setInterval(check,1000);
  new ResizeObserver(align).observe($('provider-strip'));
  window.QuotaPets={previewIdle(role){if(state&&!state.expanded&&!nativeSuspended&&!document.hidden&&!state.paused)showIdle(true,role);},roam:role=>roam(true,role),update(next){if(state?.settings.petRoam===true&&next.settings.petRoam===false)roamWanted=false;state=next;chooseStyle(next.settings.petStyle);check();align();},preview(){if(state&&!state.expanded)alert({provider:'claude',id:'claude',label:'每週',remaining:15,reset:new Date(Date.now()+86400000).toISOString(),level:1},true);}};
})();

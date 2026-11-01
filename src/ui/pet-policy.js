(function(root){
  function events(state,seen={},now=Date.now()){
    if(state.paused||state.settings.petAlerts===false)return [];
    const result=[];
    for(const [id,s] of Object.entries(state.providers??{})){
      if(!s.enabled||s.refreshing||state.settings.visible?.[id]===false||s.status!=='ready'||!s.updatedAt||!Number.isFinite(Date.parse(s.updatedAt))||now-Date.parse(s.updatedAt)>10*60000)continue;
      for(const w of s.reading?.windows??[]){
        if(!Number.isFinite(w.usedPercent)||w.usedPercent<80||w.usedPercent>100||!(Date.parse(w.resetsAt)>now))continue;
        const level=w.usedPercent>=100?3:w.usedPercent>=95?2:1;
        const key=JSON.stringify([id,w.id,w.resetsAt]);
        if(seen[`${key}:${level}`])continue;
        result.push({id,provider:id.startsWith('claude-account-')?'claude':id,key,level,label:w.label,remaining:Math.round(100-w.usedPercent),reset:w.resetsAt});
      }
    }
    return result.sort((a,b)=>b.level-a.level||a.remaining-b.remaining);
  }
  function claim(seen,event){for(let level=1;level<=event.level;level++)seen[`${event.key}:${level}`]=true;return Object.fromEntries(Object.entries(seen).slice(-512));}
  const api={events,claim};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPetPolicy=api;
})(globalThis);

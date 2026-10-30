(function(root){
  function groupWindows(windows){
    const groups=new Map();
    for(const window of windows){
      const base=window.label.replace(/\s*\((High|Medium|Low)\)\s*$/i,'');
      const variant=base!==window.label;
      const key=variant?JSON.stringify([base,window.usedPercent,window.resetsAt]):`id:${window.id}`;
      if(groups.has(key)){groups.get(key).variants.push(window.label);continue;}
      groups.set(key,{...window,label:variant?base:window.label,variants:[window.label]});
    }
    return [...groups.values()];
  }
  function shortWindow(label){
    if(/argon/i.test(label))return 'Argon';
    if(/flash/i.test(label))return 'Flash';
    if(/pro/i.test(label))return 'Pro';
    if(/每週|7\s*天/.test(label))return '7d';
    const hour=label.match(/^(\d+(?:\.\d+)?)\s*小時$/);if(hour)return `${hour[1]}h`;
    const days=label.match(/^(\d+)\s*天$/);if(days)return `${days[1]}d`;
    return label;
  }
  function windowLabel(label){
    if(/gemini/i.test(label))return label.replace(/^gemini\s*/i,'');
    return label;
  }
  function resetDate(date,locale='zh-TW',timeZone){
    if(!date)return null;
    const value=new Date(date);if(!Number.isFinite(value.getTime()))return null;
    const supported=['zh-TW','en','ja','ko'].includes(locale)?locale:'zh-TW';
    return new Intl.DateTimeFormat(supported,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(timeZone?{timeZone}:{})}).format(value);
  }
  function weeklyWindow(windows){
    const weekly=windows.filter(w=>/weekly|seven_day|每週|每周|7\s*天/i.test(`${w.id} ${w.label}`)&&Number.isFinite(w.usedPercent));
    return weekly.find(w=>w.id==='seven_day')??[...weekly].sort((a,b)=>b.usedPercent-a.usedPercent)[0]??null;
  }
  function paceWindow(windows,selected){
    const exact=windows.find(w=>w.id===selected);if(exact)return exact;
    const all=windows.find(w=>w.id==='seven_day');if(all)return all;
    const weekly=windows.filter(w=>/weekly|seven_day|每週|7\s*天/i.test(`${w.id} ${w.label}`));
    return [...(weekly.length?weekly:windows)].sort((a,b)=>b.usedPercent-a.usedPercent)[0]??null;
  }
  function pacing(window,reservePercent=10,now=Date.now()){
    if(!window||!Number.isFinite(window.usedPercent)||window.usedPercent<0||window.usedPercent>100)return null;
    const hours=(Date.parse(window.resetsAt)-now)/3600000;
    if(!Number.isFinite(hours)||hours<=0)return null;
    const configured=Number.isFinite(reservePercent)?Math.max(0,Math.min(100,reservePercent)):10;
    const remaining=100-window.usedPercent,reserve=Math.min(configured,remaining),available=Math.max(0,remaining-reserve);
    const unit=hours<24?'hour':'day',periods=unit==='hour'?hours:hours/24;
    // A partial final period must never suggest more than all distributable quota.
    const allowance=Math.min(available,available/periods);
    return {remaining,reserve,configured,available,used:window.usedPercent,hours,unit,periods,allowance};
  }
  const api={groupWindows,shortWindow,windowLabel,resetDate,weeklyWindow,paceWindow,pacing};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPresentation=api;
})(globalThis);

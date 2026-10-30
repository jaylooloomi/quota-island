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
  const api={groupWindows,shortWindow,windowLabel};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPresentation=api;
})(globalThis);

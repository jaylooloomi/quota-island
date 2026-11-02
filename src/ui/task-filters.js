(function(root){
  const order=['running','today','threeDays','fiveDays','idle','waiting','unknown','all'];
  function matches(row,filter,now=Date.now()){
    if(filter==='all')return true;
    const days={today:1,threeDays:3,fiveDays:5}[filter];
    if(!days)return row.status===filter;
    const time=row.confirmedAt;
    if(typeof time!=='number'||!Number.isFinite(time)||time<=0||time>now)return false;
    const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);
    return time>=start.getTime();
  }
  const api={order,matches};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaTaskFilters=api;
})(typeof window==='object'?window:globalThis);

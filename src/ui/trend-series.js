(function(root){
  'use strict';
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  function niceStep(value){const power=10**Math.floor(Math.log10(value)),n=value/power;return(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*power;}
  function build(points,relative=true){
    let segment,baseline,start,last,count=0;
    const rows=points.map(p=>{if(p.segment!==segment||!start){segment=p.segment;baseline=p.used;start=p;count=0;}count++;last=p;const delta=round(p.used-baseline);return{...p,baseline,delta,value:relative?delta:p.used};});
    let min=0,max=100,ticks=[0,50,100];
    if(relative){
      const low=Math.min(0,...rows.map(p=>p.value)),high=Math.max(0,...rows.map(p=>p.value)),top=Math.max(1,Math.min(100,high*1.1)),step=niceStep(Math.max(1,top-low)/4);
      min=round(Math.floor(low/step)*step);max=round(Math.ceil(top/step)*step);ticks=[];
      for(let value=min;value<=max+step/100;value+=step)ticks.push(round(value));
    }
    return{points:rows,min,max,ticks,relative,summary:start?{start,last,count,change:count>1?round(last.used-start.used):null}:null};
  }
  const api={build};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaTrendSeries=api;
})(typeof window==='object'?window:globalThis);

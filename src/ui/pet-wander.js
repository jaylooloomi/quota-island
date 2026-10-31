(function(root){
  function create(width=446,random=Math.random){
    const min=92,max=Math.max(min,width-82);let x=(min+max)/2,target=min+random()*(max-min),pause=0,speed=0,face=target>=x?1:-1;
    return {step(dt){dt=Math.max(0,Math.min(.1,dt));if(pause>0){pause-=dt;speed=0;return {x,face,moving:false,speed};}const delta=target-x;if(Math.abs(delta)<2){x=target;pause=.8+random()*1.6;target=face>0?min+random()*Math.max(0,x-min-40):Math.min(max,x+40)+random()*Math.max(0,max-x-40);if(Math.abs(target-x)<40)target=x<(min+max)/2?max:min;face=target>x?1:-1;speed=0;return {x,face,moving:false,speed};}speed=Math.min(38,speed+65*dt,Math.sqrt(130*Math.abs(delta)));const step=Math.min(Math.abs(delta),speed*dt);x+=Math.sign(delta)*step;return {x,face,moving:true,speed};}};
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPetWander=api;
})(globalThis);

(function(root){
  function create(width=446,random=Math.random){
    const min=92,max=Math.max(min,width-82);let x=(min+max)/2,speed=0,face=random()>=.5?1:-1;
    return {step(dt){dt=Math.max(0,Math.min(.1,dt));if(max===min)return {x,face,moving:false,speed:0};speed=Math.min(38,speed+65*dt);x+=face*speed*dt;if(x>=max){x=2*max-x;face=-1;}else if(x<=min){x=2*min-x;face=1;}return {x,face,moving:true,speed};}};
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPetWander=api;
})(globalThis);

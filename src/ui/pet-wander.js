(function(root){
  function create(width=446,random=Math.random){
    const min=92,max=Math.max(min,width-82);let x=(min+max)/2,speed=0,goal=null,face=random()>=.5?1:-1;
    return {go(target){goal=Math.max(0,Math.min(width-72,target));},cancelGoal(){goal=null;},step(dt){dt=Math.max(0,Math.min(.1,dt));if(goal!==null){const delta=goal-x;face=delta===0?face:Math.sign(delta);speed=Math.min(85,speed+200*dt);x+=Math.sign(delta)*Math.min(Math.abs(delta),speed*dt);return {x,face,moving:Math.abs(goal-x)>.5,speed,arrived:Math.abs(goal-x)<=.5};}if(max===min)return {x,face,moving:false,speed:0};const outside=x<min||x>max;if(outside)face=x<min?1:-1;speed=Math.min(38,speed+65*dt);x+=face*speed*dt;if(!outside&&x>=max){x=2*max-x;face=-1;}else if(!outside&&x<=min){x=2*min-x;face=1;}return {x,face,moving:true,speed};}};
  }
  const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPetWander=api;
})(globalThis);

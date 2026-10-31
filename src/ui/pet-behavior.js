(function(root){
 const durations={hello:4,sad:4,sleep:9,drink:7,eat:4,recharge:7};
 function create(random=Math.random){let mode='walk',elapsed=0,next=35+random()*25,last='',drinkCooldown=0;return {act(action){if(!durations[action])return false;mode=action;elapsed=0;last=action;if(action==='drink')drinkCooldown=1200;return true;},feed(){mode='seek';elapsed=0;},arrive(){if(mode==='seek'){mode='eat';elapsed=0;}},step(dt){dt=Math.max(0,Math.min(.1,dt));elapsed+=dt;drinkCooldown=Math.max(0,drinkCooldown-dt);if(mode==='walk'){next-=dt;if(next<=0){const options=['hello','sad','sleep','drink'].filter(x=>x!==last&&(x!=='drink'||drinkCooldown===0));this.act(options[Math.floor(random()*options.length)]);}}else if(mode!=='seek'&&elapsed>=durations[mode]){mode='walk';elapsed=0;next=35+random()*30;}return {mode,elapsed};}};}
 const api={create,durations};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPetBehavior=api;
})(globalThis);

(function(root){
  const rows={smooth:[[0,242],[242,470],[470,705],[705,928],[928,1100]],pixel:[[0,274],[274,512],[512,740],[740,953],[953,1180]],walk:[[0,236],[236,450],[450,676],[676,891],[891,1079],[1079,1254]]};
  function sample(style,provider,elapsed,reduced=false){
    const duration=style.endsWith('walk')?1100:style==='pixel'?1800:2400,p=reduced?0:Math.max(0,elapsed)%duration/duration*12;
    const logical=Math.floor(p),map=i=>provider==='gemini'&&!style.endsWith('walk')?[0,1,2,3,4,5,5,4,3,2,1,0][i%12]:i%12;
    return {frame:map(logical),next:map(logical+1),mix:!style.startsWith('pixel')&&!reduced?p-logical:0};
  }
  // Remove disconnected neighbouring sprites that cross a cell boundary; retain interior details.
  function cleanEdges(data,width,height){
    const seen=new Uint8Array(width*height),parts=[];
    for(let start=0;start<seen.length;start++){if(seen[start]||data[start*4+3]<16)continue;const queue=[start];seen[start]=1;let edge=false;
      for(let i=0;i<queue.length;i++){const n=queue[i],x=n%width,y=Math.floor(n/width);if(x===0||x===width-1||y===0||y===height-1)edge=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*width+xx;if(xx>=0&&xx<width&&yy>=0&&yy<height&&!seen[j]&&data[j*4+3]>=16){seen[j]=1;queue.push(j);}}}parts.push({pixels:queue,edge});}
    const main=parts.reduce((a,b)=>!a||b.pixels.length>a.pixels.length?b:a,null);let removed=0;for(const part of parts)if(part!==main&&part.edge)for(const n of part.pixels){data[n*4+3]=0;removed++;}return removed;
  }
  function alignTile(tile){const pixels=tile.getContext('2d').getImageData(0,0,144,144).data;let left=144,right=0,bottom=0;for(let y=0;y<144;y++)for(let x=0;x<144;x++)if(pixels[(y*144+x)*4+3]>120){left=Math.min(left,x);right=Math.max(right,x);bottom=Math.max(bottom,y);}const aligned=document.createElement('canvas');aligned.width=144;aligned.height=144;aligned.getContext('2d').drawImage(tile,Math.round(72-(left+right)/2),133-bottom);return aligned;}
  const cache=new Map();
  function loadBase(style){
    if(cache.has(style))return cache.get(style);
    const job=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{
      try{
        const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const src=source.getContext('2d',{willReadFrequently:true});src.drawImage(image,0,0);
        const pixels=src.getImageData(0,0,image.width,image.height).data,cell=image.width/6,groups={};
        for(const [provider,index] of [['claude',0],['codex',1],['gemini',2]]){
          const count=provider==='gemini'&&style!=='walk'?6:12,boxes=[];
          for(let frame=0;frame<count;frame++){
            const row=index*2+Math.floor(frame/6),[top,bottom]=rows[style][row],left=Math.round(frame%6*cell),right=Math.round((frame%6+1)*cell);
            if(style==='pixel'){const tileData=src.getImageData(left,top,right-left,bottom-top);cleanEdges(tileData.data,right-left,bottom-top);src.putImageData(tileData,left,top);for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)pixels[(y*image.width+x)*4+3]=tileData.data[((y-top)*(right-left)+x-left)*4+3];}
            let x1=right,y1=bottom,x2=left,y2=top;
            for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels[(y*image.width+x)*4+3]>120){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);}
            boxes.push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1,center:left+cell/2});
          }
          const scale=Math.min(62/Math.max(...boxes.map(b=>b.w)),62/Math.max(...boxes.map(b=>b.h)));
          groups[provider]=boxes.map(b=>{const tile=document.createElement('canvas');tile.width=144;tile.height=144;const ctx=tile.getContext('2d');ctx.imageSmoothingEnabled=style!=='pixel';ctx.drawImage(source,b.x,b.y,b.w,b.h,(36-b.w*scale/2)*2,(67-b.h*scale)*2,b.w*scale*2,b.h*scale*2);return style==='walk'?alignTile(tile):tile;});
        }
        resolve(groups);
      }catch(e){reject(e);}
    };image.onerror=reject;image.src=`pets/space-${style}.png`;});cache.set(style,job);return job;
  }
  const sheetCache=new Map();
  function sheet(file,rowCount,firstRow=0,count=12,columns=6){
    if(file.startsWith('pixel-'))return pixelSheet(file,rowCount,firstRow,count,columns);
    const key=file+':'+firstRow+':'+count+':'+columns;if(sheetCache.has(key))return sheetCache.get(key);
    const eating=file.endsWith('-eat.png'),alphaThreshold=eating?8:120;
    const job=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{try{
      const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,image.width,image.height).data,boxes=[];
      for(let i=0;i<count;i++){const left=Math.round(i%columns*image.width/columns),right=Math.round((i%columns+1)*image.width/columns),row=firstRow+Math.floor(i/columns),careRows=[0,213,385,594,785,994,1144,1300,1448],top=file==='space-sad-motion.png'?Math.round([0,278,540,817,1024][row]*image.height/1024):file==='space-robot-walk.png'?Math.round((row===0?0:344)*image.height/724):file==='space-care.png'?Math.round(careRows[row]*image.height/1448):Math.round(row*image.height/rowCount),bottom=file==='space-sad-motion.png'?Math.round([0,278,540,817,1024][row+1]*image.height/1024):file==='space-robot-walk.png'?Math.round((row===0?344:724)*image.height/724):file==='space-care.png'?Math.round(careRows[row+1]*image.height/1448):Math.round((row+1)*image.height/rowCount);
        if(file==='space-care.png'){const clean=ctx.getImageData(left,top,right-left,bottom-top);cleanEdges(clean.data,right-left,bottom-top);ctx.putImageData(clean,left,top);for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)data[(y*image.width+x)*4+3]=clean.data[((y-top)*(right-left)+x-left)*4+3];}let x1=right,y1=bottom,x2=left,y2=top;
        for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*image.width+x)*4+3]>alphaThreshold){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);}if(x2<x1)throw new Error('Empty pet frame');boxes.push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});}
      const extent=eating?56:62,scale=Math.min(extent/Math.max(...boxes.map(b=>b.w)),extent/Math.max(...boxes.map(b=>b.h)));resolve(boxes.map(b=>{const tile=document.createElement('canvas');tile.width=144;tile.height=144;tile.getContext('2d').drawImage(source,b.x,b.y,b.w,b.h,72-b.w*scale,134-b.h*scale*2,b.w*scale*2,b.h*scale*2);const pixels=tile.getContext('2d').getImageData(0,0,144,144).data;let left=144,right=0,bottom=0;for(let y=0;y<144;y++)for(let x=0;x<144;x++)if(pixels[(y*144+x)*4+3]>120){left=Math.min(left,x);right=Math.max(right,x);bottom=Math.max(bottom,y);}const aligned=document.createElement('canvas');aligned.width=144;aligned.height=144;aligned.getContext('2d').drawImage(tile,Math.round(72-(left+right)/2),133-bottom);if(file.startsWith('pixel-')){const small=document.createElement('canvas');small.width=48;small.height=48;const sc=small.getContext('2d');sc.imageSmoothingEnabled=false;sc.drawImage(aligned,0,0,48,48);const out=document.createElement('canvas');out.width=144;out.height=144;const oc=out.getContext('2d');oc.imageSmoothingEnabled=false;oc.drawImage(small,0,0,144,144);return out;}return aligned;}));
    }catch(error){reject(error);}};image.onerror=reject;image.src='pets/'+file;});sheetCache.set(key,job);return job;
  }
  const pixelCache=new Map(),pixelImages=new Map();
  function pixelSheet(file,rowCount,firstRow,count,columns){
    const key=[file,firstRow,count,columns].join(':');if(pixelCache.has(key))return pixelCache.get(key);
    if(!pixelImages.has(file))pixelImages.set(file,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src='pets/'+file;}));
    const job=pixelImages.get(file).then(img=>{const cuts={'pixel-cat.png':[0,190,375,565,755,900,1107,1355],'pixel-robot.png':[0,210,407,600,793,980,1162,1355],'pixel-rabbit.png':[0,198,396,597,790,994,1180,1355],'pixel-octopus.png':[0,199,387,587,771,939,1128,1355]},frames=[];
      for(let i=0;i<count;i++){const row=firstRow+Math.floor(i/columns),left=Math.round(i%columns*img.width/columns),right=Math.round((i%columns+1)*img.width/columns),bounds=cuts[file],top=Math.max(0,Math.round((bounds?bounds[row]/1355:row/rowCount)*img.height)-12),bottom=Math.min(img.height,Math.round((bounds?bounds[row+1]/1355:(row+1)/rowCount)*img.height)+12);const c=document.createElement('canvas');c.width=right-left;c.height=bottom-top;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,left,top,c.width,c.height,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height);cleanEdges(pixels.data,c.width,c.height);ctx.putImageData(pixels,0,0);let x1=c.width,y1=c.height,x2=0,y2=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels.data[(y*c.width+x)*4+3]>120){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);}if(x2<=x1||y2<=y1)throw Error('Empty pixel sprite');frames.push({c,x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});}
      const scale=Math.min(40/Math.max(...frames.map(b=>b.w)),40/Math.max(...frames.map(b=>b.h)));return frames.map(b=>{const small=document.createElement('canvas');small.width=48;small.height=48;const sc=small.getContext('2d',{willReadFrequently:true});sc.imageSmoothingEnabled=false;const w=Math.round(b.w*scale),h=Math.round(b.h*scale);sc.drawImage(b.c,b.x,b.y,b.w,b.h,Math.round(24-w/2),45-h,w,h);const px=sc.getImageData(0,0,48,48);for(let i=0;i<px.data.length;i+=4)px.data[i+3]=px.data[i+3]>120?255:0;sc.putImageData(px,0,0);const out=document.createElement('canvas');out.width=144;out.height=144;const ctx=out.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,144,144);return out;});});pixelCache.set(key,job);return job;
  }
  const combined=new Map();
  function load(style){if(style==='pixel')return loadPixelBundle().then(b=>b.greetings);if(!combined.has(style))combined.set(style,Promise.all([style==='classic'?Promise.resolve({}):loadBase(style),sheet('space-octopus-orange.png',4,style==='walk'?0:2),style==='walk'?sheet('space-robot-walk.png',2):Promise.resolve(null)]).then(([base,octopus,robot])=>({...base,octopus,...(robot?{codex:robot}:{})})));return combined.get(style);}
  let care,rest;
  function loadCare(){return care??=Promise.all(['claude','codex','gemini','octopus'].map((role,i)=>sheet('space-care.png',8,i*2).then(async frames=>[role,[...frames.slice(0,6),...await sheet('space-'+({claude:'cat',codex:'robot',gemini:'rabbit',octopus:'octopus'}[role])+'-eat.png',2,0,6,3)]]))).then(Object.fromEntries);}
  function loadRest(){return rest??=Promise.all(['claude','codex','gemini','octopus'].map((role,i)=>(role==='octopus'?sheet('space-octopus-rest.png',2):sheet('space-rescue.png',3,i,3,3)).then(frames=>[role,frames]))).then(Object.fromEntries);}
  let pixelBundle;
  function loadPixelBundle(){return pixelBundle??=Promise.all([['claude','cat'],['codex','robot'],['gemini','rabbit'],['octopus','octopus']].map(async([role,file])=>{const name='pixel-'+file+'.png';const [walk,hello,sad,sleep,careBase]=await Promise.all([sheet(name,7,0),sheet(name,7,2,6),sheet(name,7,3,6),role==='gemini'?sheet('pixel-rabbit-sleep.png',2,0,6,3):sheet(name,7,4,6),role==='gemini'?sheet(name,7,4):sheet(name,7,5)]);const care=[...careBase.slice(0,6),...await sheet('pixel-'+file+'-eat.png',2,0,6,3)];return {role,walk,greetings:[...hello,...hello],rest:[...sad,...sleep],care};})).then(entries=>Object.fromEntries(['walk','greetings','rest','care'].map(mode=>[mode,Object.fromEntries(entries.map(e=>[e.role,e[mode]]))])));}
  let sad;
  function loadSad(){return sad??=Promise.all(['claude','codex','gemini','octopus'].map((role,i)=>sheet('space-sad-motion.png',4,i,6).then(frames=>[role,frames]))).then(Object.fromEntries);}
  function sadPose(elapsed,reduced=false,pixel=false){const progress=reduced?.4:Math.max(0,Math.min(1,elapsed/4000)),phase=progress*5,frame=Math.floor(phase);return {frame,next:Math.min(5,frame+1),mix:pixel||reduced?0:phase-frame,emotion:progress<.32?'lower':progress<.68?'sigh':'recover'};}
  const api={sample,load,cleanEdges,loadCare,loadRest,loadPixelBundle,loadSad,sadPose};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPetAnimation=api;
})(globalThis);

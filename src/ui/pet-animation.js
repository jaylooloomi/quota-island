(function(root){
  const rows={smooth:[[0,242],[242,470],[470,705],[705,928],[928,1100]],pixel:[[0,274],[274,512],[512,740],[740,953],[953,1180]],walk:[[0,236],[236,450],[450,676],[676,891],[891,1079],[1079,1254]]};
  function sample(style,provider,elapsed,reduced=false){
    const duration=style==='walk'?1100:style==='pixel'?1800:2400,p=reduced?0:Math.max(0,elapsed)%duration/duration*12;
    const logical=Math.floor(p),map=i=>provider==='gemini'&&style!=='walk'?[0,1,2,3,4,5,5,4,3,2,1,0][i%12]:i%12;
    return {frame:map(logical),next:map(logical+1),mix:style!=='pixel'&&!reduced?p-logical:0};
  }
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
            let x1=right,y1=bottom,x2=left,y2=top;
            for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels[(y*image.width+x)*4+3]>120){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);}
            boxes.push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1,center:left+cell/2});
          }
          const scale=Math.min(62/Math.max(...boxes.map(b=>b.w)),62/Math.max(...boxes.map(b=>b.h)));
          groups[provider]=boxes.map(b=>{const tile=document.createElement('canvas');tile.width=144;tile.height=144;const ctx=tile.getContext('2d');ctx.imageSmoothingEnabled=style!=='pixel';ctx.drawImage(source,b.x,b.y,b.w,b.h,(36-b.w*scale/2)*2,(67-b.h*scale)*2,b.w*scale*2,b.h*scale*2);return tile;});
        }
        resolve(groups);
      }catch(e){reject(e);}
    };image.onerror=reject;image.src=`pets/space-${style}.png`;});cache.set(style,job);return job;
  }
  const sheetCache=new Map();
  function sheet(file,rowCount,firstRow=0){
    const key=file+':'+firstRow;if(sheetCache.has(key))return sheetCache.get(key);
    const job=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{try{
      const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,image.width,image.height).data,boxes=[];
      for(let i=0;i<12;i++){const left=Math.round(i%6*image.width/6),right=Math.round((i%6+1)*image.width/6),top=Math.round((firstRow+Math.floor(i/6))*image.height/rowCount),bottom=Math.round((firstRow+Math.floor(i/6)+1)*image.height/rowCount);let x1=right,y1=bottom,x2=left,y2=top;
        for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*image.width+x)*4+3]>120){x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);}if(x2<x1)throw new Error('Empty pet frame');boxes.push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});}
      const scale=Math.min(62/Math.max(...boxes.map(b=>b.w)),62/Math.max(...boxes.map(b=>b.h)));resolve(boxes.map(b=>{const tile=document.createElement('canvas');tile.width=144;tile.height=144;tile.getContext('2d').drawImage(source,b.x,b.y,b.w,b.h,72-b.w*scale,134-b.h*scale*2,b.w*scale*2,b.h*scale*2);return tile;}));
    }catch(error){reject(error);}};image.onerror=reject;image.src='pets/'+file;});sheetCache.set(key,job);return job;
  }
  const combined=new Map();
  function load(style){if(!combined.has(style))combined.set(style,Promise.all([style==='classic'?Promise.resolve({}):loadBase(style),sheet('space-octopus.png',4,style==='walk'?0:2),style==='walk'?sheet('space-rabbit-walk.png',2):Promise.resolve(null)]).then(([base,octopus,rabbit])=>({...base,octopus,...(rabbit?{gemini:rabbit}:{})})));return combined.get(style);}
  const api={sample,load};if(typeof module==='object'&&module.exports)module.exports=api;else root.QuotaPetAnimation=api;
})(globalThis);

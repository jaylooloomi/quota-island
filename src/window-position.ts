export type Rect={x:number;y:number;width:number;height:number};
export type Dock={horizontal:'left'|'right'|null;vertical:'top'|'bottom'|null};
// The UI has an 8-DIP transparent inset. Align the visible island, not that inset.
const inset=8;
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(value,Math.max(min,max)));
export function fitWindow(bounds:Rect,area:Rect,width:number,height:number,dock?:Dock):Rect{
  width=Math.min(width,area.width);height=Math.min(height,area.height);
  const left=area.x-inset,right=area.x+area.width-width+inset,top=area.y-inset,bottom=area.y+area.height-height+inset;
  return {width,height,x:Math.round(dock?.horizontal==='left'?left:dock?.horizontal==='right'?right:clamp(bounds.x,left,right)),y:Math.round(dock?.vertical==='top'?top:dock?.vertical==='bottom'?bottom:clamp(bounds.y,top,bottom))};
}
export function snapWindow(bounds:Rect,area:Rect,threshold=24):{bounds:Rect;dock:Dock}{
  const left=Math.abs(bounds.x+inset-area.x),right=Math.abs(bounds.x+bounds.width-inset-area.x-area.width);
  const top=Math.abs(bounds.y+inset-area.y),bottom=Math.abs(bounds.y+bounds.height-inset-area.y-area.height);
  const dock:Dock={horizontal:Math.min(left,right)<=threshold?(left<=right?'left':'right'):null,vertical:Math.min(top,bottom)<=threshold?(top<=bottom?'top':'bottom'):null};
  return {bounds:fitWindow(bounds,area,bounds.width,bounds.height,dock),dock};
}

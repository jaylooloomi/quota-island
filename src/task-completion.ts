import type {TaskRow} from './task-monitor';
export type TaskCompletion={id:string;turnId:string;title:string;host:string;provider:'codex';time:number};
// Explicit successful terminal evidence only. A baseline, idle, disconnect or
// assistant final message is never sufficient to announce completion.
export class CompletionTracker {
  private seen=new Map<string,{proof:string;time:number}>();private emitted=new Set<string>();
  reset(){this.seen.clear();}
  observe(row:TaskRow,turnId:string,status:string,time:number):TaskCompletion|undefined {
    if(!turnId||turnId.length>128||!Number.isFinite(time))return;
    const previous=this.seen.get(row.id);this.seen.set(row.id,{proof:turnId+':'+status,time:Date.now()});
    if(this.seen.size>300)this.seen.delete(this.seen.keys().next().value!);
    const key=row.id+':'+turnId;
    if(!previous||status!=='completed'||previous.proof===turnId+':completed'||this.emitted.has(key))return;
    // Require the same observed active turn. A different turn or a failure
    // must not turn a later idle observation into successful completion.
    if(previous.proof!==turnId+':inProgress'||Date.now()-previous.time>65000)return;
    if(Date.now()-time>120000||time>Date.now()+1000)return;
    this.emitted.add(key);if(this.emitted.size>512)this.emitted.delete(this.emitted.values().next().value!);
    return{id:row.id,turnId,title:row.title.slice(0,160),host:(row.host||'').slice(0,80),provider:'codex',time};
  }
}
export function bubbleBounds(parent:{x:number;y:number;width:number;height:number},area:{x:number;y:number;width:number;height:number},anchor:number){
  const width=Math.min(300,area.width),height=142,tip=Math.max(parent.x,Math.min(parent.x+parent.width,parent.x+anchor));
  const x=Math.round(Math.max(area.x,Math.min(area.x+area.width-width,tip-width/2)));
  const above=parent.y-height-4>=area.y;
  const y=Math.round(Math.max(area.y,Math.min(area.y+area.height-height,above?parent.y-height-4:parent.y+parent.height+4)));
  return{x,y,width,height,above,tip:Math.max(24,Math.min(width-24,tip-x))};
}

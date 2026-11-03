import type {TaskCompletion} from './task-completion';
import {NativeProviderTaskMonitor} from './native-provider-tasks';
import {homedir} from 'node:os';
import {LocalTaskMonitor} from './local-task-monitor';
import {RemoteTaskMonitor} from './remote-task-monitor';
import path from 'node:path';
import {hostname} from 'node:os';
export class CombinedTaskMonitor {
  private native?:NativeProviderTaskMonitor;private local:LocalTaskMonitor;private remote?:RemoteTaskMonitor;
  constructor(sessionsRoot:string,private changed:()=>void,remoteEnabled:boolean,completed?:(value:TaskCompletion)=>void){
    if(remoteEnabled)this.native=new NativeProviderTaskMonitor(path.join(process.env.CLAUDE_CONFIG_DIR||path.join(homedir(),'.claude'),'sessions'),changed);
    this.local=new LocalTaskMonitor(sessionsRoot,changed,Date.now,item=>completed?.({...item,host:hostname()}));
    if(remoteEnabled&&process.platform==='win32')this.remote=new RemoteTaskMonitor(path.dirname(sessionsRoot),changed,completed);
  }
  snapshot(){
    const original=this.local.snapshot(),local={...original,rows:original.rows.map(r=>({...r,host:hostname()}))},remote=this.remote?.snapshot();
    const native=this.native?.snapshot();if(!remote&&!native)return local;
    const rank={waiting:0,running:1,idle:2,unknown:3};
    const allRows=[...local.rows,...(remote?.rows??[]),...(native?.rows??[])].sort((a,b)=>rank[a.status]-rank[b.status]||(b.confirmedAt??0)-(a.confirmedAt??0));const rows=allRows.slice(0,100);
    return {...local,rows,counts:Object.fromEntries(['running','waiting','idle','unknown'].map(s=>[s,rows.filter(r=>r.status===s).length])),connection:remote?.available?'remote':local.connection,liveCoverage:local.liveCoverage||!!remote?.available||!!native?.claude.available||!!native?.antigravity.available,partial:allRows.length>100||local.partial||!!remote?.partial||!!native?.partial,remote:{connected:!!remote?.available,error:remote?.error,count:remote?.rows.length??0},native:native?{claude:native.claude,antigravity:native.antigravity}:undefined,scope:'local-and-authorized-remote',limit:100};
  }
  async start(){this.remote?.start();void this.native?.start();await this.local.start();}
  close(){this.local.close();this.remote?.close();this.native?.close();}
}

import {LocalTaskMonitor} from './local-task-monitor';
import {RemoteTaskMonitor} from './remote-task-monitor';
import path from 'node:path';
export class CombinedTaskMonitor {
  private local:LocalTaskMonitor;private remote?:RemoteTaskMonitor;
  constructor(sessionsRoot:string,private changed:()=>void,remoteEnabled:boolean){
    this.local=new LocalTaskMonitor(sessionsRoot,changed);
    if(remoteEnabled&&process.platform==='win32')this.remote=new RemoteTaskMonitor(path.dirname(sessionsRoot),changed);
  }
  snapshot(){
    const local=this.local.snapshot(),remote=this.remote?.snapshot();
    if(!remote)return local;
    const rank={waiting:0,running:1,idle:2,unknown:3};
    const rows=[...local.rows,...remote.rows].sort((a,b)=>rank[a.status]-rank[b.status]||(b.confirmedAt??0)-(a.confirmedAt??0)).slice(0,100);
    return {...local,rows,counts:Object.fromEntries(['running','waiting','idle','unknown'].map(s=>[s,rows.filter(r=>r.status===s).length])),connection:remote.available?'remote':local.connection,liveCoverage:local.liveCoverage||remote.available,partial:local.partial||remote.partial,remote:{connected:remote.available,error:remote.error,count:remote.rows.length},scope:'local-and-authorized-remote',limit:100};
  }
  async start(){this.remote?.start();await this.local.start();}
  close(){this.local.close();this.remote?.close();}
}

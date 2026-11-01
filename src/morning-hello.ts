import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {ProviderError,ProviderState} from './model';
export type HelloResult={day:string;status:'sending'|'sent'|'confirmed'|'active'|'error'|'uncertain';at:string;resetAt?:string;code?:string};
type Candidate={id:string;state:ProviderState;pending?:boolean};
export function taipeiClock(now:number){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const get=(key:string)=>parts.find(p=>p.type===key)!.value;
  return {day:`${get('year')}-${get('month')}-${get('day')}`,minute:Number(get('hour'))*60+Number(get('minute'))};
}
export class MorningHello {
  private records:Record<string,HelloResult>={};
  private busy=false;
  constructor(private file:string,private send:(id:string)=>Promise<void>,private changed:()=>void,private now=Date.now){
    try{const saved=JSON.parse(readFileSync(file,'utf8'));for(const [id,r] of Object.entries(saved) as [string,any][]){
      if(!/^(claude|claude-account-[0-9a-f-]{36})$/.test(id)||!/^\d{4}-\d\d-\d\d$/.test(r?.day)||!['sending','sent','confirmed','active','error','uncertain'].includes(r.status)||!Number.isFinite(Date.parse(r.at)))continue;
      this.records[id]={day:r.day,status:r.status==='sending'?'uncertain':r.status,at:new Date(r.at).toISOString(),...(typeof r.resetAt==='string'&&Number.isFinite(Date.parse(r.resetAt))?{resetAt:new Date(r.resetAt).toISOString()}:{}),...(['auth','network','schema','rate_limit','missing_cli','storage'].includes(r.code)?{code:r.code}:{})};
    }}catch{}
  }
  snapshot(){return structuredClone(this.records);}
  private save(){try{mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});writeFileSync(this.file+'.tmp',JSON.stringify(this.records),{mode:0o600});renameSync(this.file+'.tmp',this.file);return true;}catch{return false;}}
  async tick(enabled:boolean,time:string,candidates:Candidate[],paused=false){
    if(!enabled||paused||this.busy)return;
    const now=this.now(),clock=taipeiClock(now);
    this.busy=true;
    try{for(const {id,state,pending} of candidates){
      if(!/^(claude|claude-account-[0-9a-f-]{36})$/.test(id)||!state.enabled||pending)continue;
      if(state.status!=='ready'||state.refreshing||!state.reading||!state.updatedAt||!Number.isFinite(Date.parse(state.updatedAt))||now-Date.parse(state.updatedAt)>10*60000||state.nextPollAt>now+120000)continue;
      const session=state.reading.windows.find(w=>w.id==='five_hour');
      if(!session)continue; // Missing session data never means unused quota.
      const existing=this.records[id],reset=Date.parse(session.resetsAt??'');
      if(reset>now){
        if(existing?.status==='sent'&&Date.parse(state.updatedAt)>Date.parse(existing.at)){
          existing.status='confirmed';existing.resetAt=new Date(reset).toISOString();this.save();this.changed();
        }else if(!existing||existing.status==='active'&&existing.resetAt!==session.resetsAt){
          this.records[id]={day:clock.day,status:'active',at:new Date(now).toISOString(),resetAt:new Date(reset).toISOString()};this.save();this.changed();
        }
        continue;
      }
      if(session.usedPercent!==0||session.resetsAt&&!Number.isFinite(reset))continue;
      if(existing&&Date.parse(existing.resetAt??'')>now)continue;
      if(existing&&existing.status!=='active'&&now-Date.parse(existing.at)<5*3600000)continue;
      if(state.reading.windows.some(w=>/seven_day|weekly/.test(w.id)&&w.usedPercent>=100))continue;
      this.records[id]={day:clock.day,status:'sending',at:new Date(now).toISOString()};
      // Claim on disk BEFORE any request: restart/timeouts must never cause duplicates.
      if(!this.save()){this.records[id].status='error';this.records[id].code='storage';this.changed();continue;}
      this.changed();
      try{await this.send(id);this.records[id].status='sent';}
      catch(e){this.records[id].status='error';this.records[id].code=e instanceof ProviderError?e.code:'network';}
      this.save();this.changed();
    }}finally{this.busy=false;}
  }
}

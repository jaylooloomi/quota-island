import {appendFileSync,existsSync,mkdirSync,renameSync,rmSync,statSync} from 'node:fs';
import path from 'node:path';
export class Diagnostics {
  readonly file:string;
  private previous=new Map<string,string>();
  constructor(directory:string,private maxBytes=1024*1024){this.file=path.join(directory,'diagnostics.jsonl');}
  private write(event:Record<string,unknown>){
    try{
      mkdirSync(path.dirname(this.file),{recursive:true,mode:0o700});
      if(existsSync(this.file)&&statSync(this.file).size>=this.maxBytes){rmSync(this.file+'.1',{force:true});renameSync(this.file,this.file+'.1');}
      appendFileSync(this.file,JSON.stringify({time:new Date().toISOString(),...event})+'\n',{mode:0o600});
    }catch{/* Diagnostics must never interrupt monitoring. */}
  }
  startup(version:string,enabled:Record<string,boolean>){this.write({event:'startup',version:version.replace(/[^0-9.]/g,'').slice(0,24),enabled:{claude:enabled.claude,codex:enabled.codex,gemini:enabled.gemini}});}
  sourceToggle(provider:string,enabled:boolean){if(['claude','codex','gemini'].includes(provider))this.write({event:'source_toggle',origin:'settings',provider,enabled});}
  observe(snapshot:any){
    for(const [id,state] of Object.entries(snapshot.providers??{}) as [string,any][]){
      if(!/^(claude|codex|gemini|claude-account-[0-9a-f-]{36})$/.test(id))continue;
      const stamp=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
      // Explicit allowlist: never serialize tokens, account labels, emails, URLs,
      // exception text or raw service responses into diagnostic files.
      const summary={event:'provider_state',provider:id,enabled:state.enabled===true,status:['loading','ready','unavailable','stale','signed_out'].includes(state.status)?state.status:'unknown',refreshing:state.refreshing===true,updatedAt:stamp(state.updatedAt),nextPollAt:typeof state.nextPollAt==='number'&&Number.isFinite(state.nextPollAt)?state.nextPollAt:null,hasError:!!state.error,errorCode:['auth','network','schema','missing_cli','rate_limit'].includes(state.errorCode)?state.errorCode:null,windows:(Array.isArray(state.reading?.windows)?state.reading.windows:[]).slice(0,40).map((w:any,index:number)=>({index,kind:/five_hour|session/.test(w.id)?'session':/seven_day|weekly|每週|7\s*天/.test(`${w.id} ${w.label}`)?'weekly':'other',usedPercent:typeof w.usedPercent==='number'&&Number.isFinite(w.usedPercent)&&w.usedPercent>=0&&w.usedPercent<=100?w.usedPercent:null,resetsAt:stamp(w.resetsAt)}))};
      const serialized=JSON.stringify(summary);if(this.previous.get(id)!==serialized){this.previous.set(id,serialized);this.write(summary);}
    }
  }
}

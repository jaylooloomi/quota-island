// Explicitly selected metadata only; never serialize the full monitor snapshot.
const text=(v:unknown,n=80)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n):'';
const code=(v:unknown)=>typeof v==='string'&&/^[A-Z_0-9]{1,80}$/.test(v)?v:'';
const time=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<9e15?new Date(v).toISOString():null;
const counts=(rows:any[])=>Object.fromEntries(['running','waiting','idle','unknown'].map(s=>[s,rows.filter(r=>r?.status===s).length]));
export function taskSourceDiagnostics(tasks:any,version:string,machine:string){
  const rows:any[]=(Array.isArray(tasks?.rows)?tasks.rows:[]).slice(0,100),remote=tasks?.remote;
  return {schemaVersion:1,version:text(version,30),machine:text(machine),capturedAt:new Date().toISOString(),
    local:{available:tasks?.localSource?.available===true,checkedAt:time(tasks?.localSource?.checkedAt),counts:counts(rows.filter(r=>(r.provider??'codex')==='codex'&&r.source==='rollout'))},
    remote:{enabled:remote?.enabled===true,controllerConnected:remote?.controllerConnected===true,sourceConnected:remote?.connected===true,checking:remote?.checking===true,error:code(remote?.error),checkedAt:time(remote?.checkedAt),retryAt:time(remote?.retryAt),
      hosts:(Array.isArray(remote?.hosts)?remote.hosts:[]).slice(0,5).map((h:any)=>({name:text(h.name),online:h.online===true,state:['ready','unconfirmed','offline','error'].includes(h.state)?h.state:'unknown',error:code(h.error),checkedAt:time(h.checkedAt),counts:Object.fromEntries(['running','waiting','idle','unknown'].map(s=>[s,Number.isInteger(h.counts?.[s])&&h.counts[s]>=0&&h.counts[s]<=100?h.counts[s]:0]))}))},
    claudeRemote:{available:tasks?.claudeRemote?.available===true,count:tasks?.claudeRemote?.count??0,profiles:(tasks?.claudeRemote?.profiles||[]).slice(0,5).map((p:any)=>({label:text(p.label,24),available:p.available===true,error:code(p.error),checkedAt:time(p.checkedAt),nextPollAt:time(p.nextPollAt),count:p.count,partial:p.partial===true}))},
    note:'Metadata only. Online does not imply readable task runtime. Unknown is not zero running.'};
}

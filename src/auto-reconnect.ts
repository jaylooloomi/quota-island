import {readFileSync,writeFileSync} from 'node:fs';
type State={provider?:string;enabled:boolean;status:string;errorCode?:string};
export class AutoReconnect {
 private known=new Set<string>();private attempted=new Set<string>();private busy=false;
 constructor(private file:string,private login:(id:string)=>Promise<unknown>){try{const saved=JSON.parse(readFileSync(file,'utf8'));for(const id of saved.known??[])if(typeof id==='string')this.known.add(id);for(const id of saved.attempted??[])if(typeof id==='string')this.attempted.add(id);}catch{}}
 private save(){try{writeFileSync(this.file,JSON.stringify({known:[...this.known],attempted:[...this.attempted]}),{mode:0o600});}catch{}}
 async check(states:Record<string,State>,pending:boolean){let changed=false;for(const [id,s] of Object.entries(states)){if(s.provider!=='claude')continue;if(s.status==='ready'){if(!this.known.has(id)){this.known.add(id);changed=true;}if(this.attempted.delete(id))changed=true;}}if(changed)this.save();if(this.busy||pending)return;const found=Object.entries(states).find(([id,s])=>s.provider==='claude'&&s.enabled&&s.status==='signed_out'&&s.errorCode==='auth'&&this.known.has(id)&&!this.attempted.has(id));if(!found)return;this.busy=true;this.attempted.add(found[0]);this.save();try{await this.login(found[0]);}finally{this.busy=false;}}
}

import {createHash} from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { cliEnvironment } from './cli';
import { ProviderError, Reading, iso } from './model';
const exec = promisify(execFile);
interface Candidate { pid: number; token: string; ports: number[]; }
export function parseAntigravitySummary(data:any,plan:string|null=null):Reading {
  const groups=data?.response?.groups??data?.groups;
  if(!Array.isArray(groups))throw new ProviderError('schema','Antigravity 尚未提供完整群組配額');
  const windows=groups.flatMap((group:any,index:number)=>{
    if(typeof group?.displayName!=='string'||!Array.isArray(group.buckets))return [];
    return group.buckets.flatMap((bucket:any,bucketIndex:number)=>{
      const fraction=bucket?.remainingFraction;
      if(typeof fraction!=='number'||!Number.isFinite(fraction)||fraction<0||fraction>1||bucket.isEnabled===false||bucket.enabled===false)return [];
      const period=bucket.window==='weekly'?'每週':bucket.window==='5h'?'5 小時':typeof bucket.displayName==='string'?bucket.displayName:'配額';
      return [{id:`antigravity-group-${bucket.bucketId??`${index}-${bucketIndex}`}`,label:`${group.displayName} · ${period}`,group:group.displayName,usedPercent:Math.round((1-fraction)*10000)/100,resetsAt:iso(bucket.resetTime)}];
    });
  });
  if(!windows.length)throw new ProviderError('schema','Antigravity 尚未提供完整群組配額');
  return {provider:'gemini',plan,windows,source:'Antigravity 群組配額 · Gemini、Claude／GPT 與模型專屬限制；不是獨立 Claude Code 或 Codex 額度'};
}
export function parseAntigravity(data: any): Reading {
  const configs = data?.userStatus?.cascadeModelConfigData?.clientModelConfigs;
  if (!Array.isArray(configs)) throw new ProviderError('schema', 'Antigravity 尚未提供模型配額，稍後會自動重試');
  const windows = configs.flatMap((row: any, index: number) => {
    const label = row?.label;
    const fraction = row?.quotaInfo?.remainingFraction;
    if (typeof label !== 'string' || !/gemini/i.test(label) || typeof fraction !== 'number' || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return [];
    return [{ id: `antigravity-${label}`, label, usedPercent: Math.round((1 - fraction) * 10000) / 100, resetsAt: iso(row.quotaInfo.resetTime) }];
  });
  if (!windows.length) throw new ProviderError('schema', 'Antigravity 尚未回傳 Gemini 配額；請在 Antigravity 完成帳號登入');
  // Never allow a fully unused Flash row to hide a constrained Argon/Pro row.
  windows.sort((a: any, b: any) => b.usedPercent - a.usedPercent || a.label.localeCompare(b.label));
  const rawPlan = data.userStatus?.planStatus?.planInfo?.planName;
  return { provider:'gemini', plan:typeof rawPlan === 'string' ? rawPlan : null, windows,
    source:'Antigravity 本機服務 · Gemini 模型配額（非 Gemini 網頁版、非企業 Code Assist）' };
}
const windowsDiscovery = String.raw`
$ErrorActionPreference='Stop'
$rows=@()
$servers=@(Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -match '^language_server(?:_[\w-]+)?\.exe$' -and $_.ExecutablePath -match '(?i)[\\/]Antigravity[\\/]') -or $_.Name -in @('agy.exe','antigravity-cli.exe')
})
foreach($server in $servers){
  $m=[regex]::Match($server.CommandLine,'--csrf_token(?:=|\s+)("[^"]+"|\S+)')
  $token=''
  if($m.Success){$token=$m.Groups[1].Value.Trim('"')}
  if(-not $token -and $server.Name -notin @('agy.exe','antigravity-cli.exe')){continue}
  $ports=@(Get-NetTCPConnection -State Listen -OwningProcess $server.ProcessId -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort -Unique)
  if($ports.Count -gt 0){$rows+=@{pid=[int]$server.ProcessId;token=$token;ports=$ports}}
}
ConvertTo-Json -InputObject @($rows) -Compress -Depth 4
`;
export async function discoverAntigravity(): Promise<Candidate[]> {
  try {
    if (process.platform === 'win32') {
      const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
      const { stdout } = await exec(powershell, ['-NoProfile','-NonInteractive','-Command',windowsDiscovery], { windowsHide:true, timeout:12_000, maxBuffer:256*1024 });
      const parsed = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
      return (Array.isArray(parsed) ? parsed : [parsed]).filter(row => Number.isInteger(row?.pid) && typeof row.token === 'string' && Array.isArray(row.ports)).slice(0,4);
    }
    const { stdout } = await exec('/bin/ps', ['-axo','pid=,comm=,args='], { timeout:5000,maxBuffer:2*1024*1024 });
    const candidates: Candidate[] = [];
    for (const line of stdout.split('\n')) {
      const row = line.match(/^\s*(\d+)\s+(\S+)\s+(.+)$/); if (!row) continue;
      const pid = Number(row[1]), command = row[2]!, args = row[3]!;
      const cli = /(?:^|\/)(?:agy|antigravity-cli)$/.test(command);
      if (!cli && !(/language_server/.test(command) && /antigravity/i.test(command+' '+args))) continue;
      const token = args.match(/--csrf_token(?:=|\s+)(?:"([^"]+)"|(\S+))/);
      if (!cli && !token) continue;
      try {
        const out = await exec('lsof',['-nP','-a','-p',String(pid),'-iTCP','-sTCP:LISTEN','-Fn'],{env:cliEnvironment(),timeout:3000,maxBuffer:65536});
        const ports = [...new Set([...out.stdout.matchAll(/^n.*:(\d+)$/gm)].map(m=>Number(m[1])))];
        if (ports.length) candidates.push({pid,token:token?.[1]??token?.[2]??'',ports});
      } catch { /* This process may have exited or have no listeners. */ }
      if(candidates.length>=4)break;
    }
    return candidates;
  } catch { throw new ProviderError('network','無法偵測 Antigravity 本機服務，請確認 Antigravity 正在執行'); }
}
export function localAntigravityStatus(candidate: Candidate, port: number, method='GetUserStatus', protocol:'https'|'http'='https'): Promise<any> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.reject(new ProviderError('network','Antigravity 連接埠無法辨識'));
  return new Promise((resolve,reject) => {
    const body = JSON.stringify(method==='GetUserStatus'?{metadata:{ideName:'antigravity',extensionName:'antigravity',ideVersion:'unknown',locale:'en'}}:{});
    // The IDE creates a self-signed certificate. The exception is restricted to
    // this loopback request and a discovered process-owned port, never global.
    const req = (protocol==='http'?http:https).request({hostname:'127.0.0.1',port,method:'POST',path:`/exa.language_server_pb.LanguageServerService/${method}`,
      rejectUnauthorized:false,timeout:1800,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),'Connect-Protocol-Version':'1','X-Codeium-Csrf-Token':candidate.token}}, res => {
      let text='';
      res.on('data',chunk=>{text+=chunk.toString();if(text.length>2*1024*1024)req.destroy();});
      res.on('end',()=>{
        if(res.statusCode!==200){reject(new ProviderError('network','Antigravity 本機配額服務尚未就緒'));return;}
        try{resolve(JSON.parse(text));}catch{reject(new ProviderError('schema','Antigravity 本機配額格式無法辨識'));}
      });
      res.on('error',()=>reject(new ProviderError('network','Antigravity 本機連線中斷')));
    });
    req.on('timeout',()=>req.destroy()); req.on('error',()=>reject(new ProviderError('network','Antigravity 本機服務暫時無法連線'))); req.end(body);
  });
}
export class Antigravity {
  private identity:string|undefined;
  private switching=false;
  beginSwitch(){this.switching=true;}
  cancelSwitch(){this.switching=false;}
  get waitingForAccount(){return this.switching;}
  private acceptIdentity(value:unknown){
    const identity=typeof value==='string'?value.trim().toLowerCase():undefined;
    if(this.switching&&(!identity||identity===this.identity))throw new ProviderError('auth','等待在 Antigravity 切換帳號，完成後會自動更新配額');
    if(identity)this.identity=identity;
    this.switching=false;
  }
  constructor(private discover=discoverAntigravity,private status=localAntigravityStatus){}
  async read():Promise<Reading>{
    const candidates=await this.discover();
    if(!candidates.length)throw new ProviderError('auth','請開啟 Antigravity 並完成 Google 登入；此處會讀取 Antigravity 的 Gemini 配額');
    let error:ProviderError|undefined;
    let fallback:Reading|undefined;
    let fallbackIdentity:string|undefined;
    for(const candidate of candidates)for(const port of candidate.ports.slice(0,4)){
      for(const protocol of ['https','http'] as const){
        try{
          const reading=parseAntigravitySummary(await this.status(candidate,port,'RetrieveUserQuotaSummary',protocol));
          let metadata:any;
          try{metadata=await this.status(candidate,port,'GetUserStatus',protocol);}catch{/* Summary remains usable without plan metadata unless another source established identity. */}
          const identity=metadata?.userStatus?.email;
          if(fallbackIdentity&&(typeof identity!=='string'||identity.trim().toLowerCase()!==fallbackIdentity))continue;
          const plan=metadata?.userStatus?.planStatus?.planInfo?.planName;if(typeof plan==='string')reading.plan=plan;
          this.acceptIdentity(identity);if(this.identity)reading.identityKey=createHash('sha256').update(this.identity).digest('hex');return reading;
        }catch(e){if(e instanceof ProviderError&&e.code==='auth'&&this.switching)throw e;/* Older local services may not implement grouped summaries. */}
      }
      try{const metadata=await this.status(candidate,port);const reading=parseAntigravity(metadata);if(!fallback){fallback=reading;const identity=metadata?.userStatus?.email;if(typeof identity==='string')fallbackIdentity=identity.trim().toLowerCase();}}
      catch(e){if(e instanceof ProviderError)error=e;}
    }
    if(fallback){this.acceptIdentity(fallbackIdentity);if(this.identity)fallback.identityKey=createHash('sha256').update(this.identity).digest('hex');return fallback;}
    throw error??new ProviderError('network','Antigravity 配額服務尚未就緒，稍後會自動重試');
  }
  async connect(){
    try{await this.read();return;}catch{/* Launch the installed app only if it is not already usable. */}
    if(process.platform==='win32'){
      const executable=path.join(homedir(),'AppData/Local/Programs/Antigravity/Antigravity.exe');
      if(!existsSync(executable))throw new ProviderError('missing_cli','請先安裝並登入 Antigravity，再按連接 Antigravity');
      const child=spawn(executable,[],{detached:true,stdio:'ignore',windowsHide:false}); child.on('error',()=>{});child.unref();
    }
    for(let attempt=0;attempt<8;attempt++){
      await new Promise(resolve=>setTimeout(resolve,1500));
      try{await this.read();return;}catch{/* No inference is triggered; only read local account status. */}
    }
    throw new ProviderError('auth','請在 Antigravity 完成 Google 登入；App 會持續自動偵測配額');
  }
}

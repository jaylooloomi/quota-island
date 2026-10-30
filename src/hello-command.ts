import {execFile} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {ProviderError} from './model';
const exec=promisify(execFile);
export function helloCommand(command:{file:string;args:string[];env?:NodeJS.ProcessEnv},cwd:string){
  const env={...command.env};
  for(const key of Object.keys(env))if(key.startsWith('ANTHROPIC_')||key.startsWith('CLAUDE_CODE_USE_'))delete env[key];
  for(const key of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','ANTHROPIC_BASE_URL','CLAUDE_CODE_OAUTH_TOKEN','CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY','CLAUDECODE'])delete env[key];
  env.CLAUDE_CODE_DISABLE_AUTO_MEMORY='1';
  env.CLAUDE_CODE_SKIP_PROMPT_HISTORY='1';
  return {file:command.file,args:[...command.args,'--print','--model','haiku','--tools','','--setting-sources','','--settings',JSON.stringify({disableAllHooks:true}),'--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--system-prompt','Reply with only Hello.','--no-session-persistence','--max-turns','1','--output-format','json','Hello'],options:{cwd,env,windowsHide:true,timeout:60000,maxBuffer:128*1024}};
}
export async function sendClaudeHello(command:{file:string;args:string[];env?:NodeJS.ProcessEnv},configDir:string,cwd:string){
  let credentials:any;try{credentials=JSON.parse(await readFile(path.join(configDir,'.credentials.json'),'utf8'));}catch{}
  if(typeof credentials?.claudeAiOauth?.accessToken!=='string'||!credentials.claudeAiOauth.accessToken)throw new ProviderError('auth','Hello 需要有效的 Claude 訂閱登入');
  await mkdir(cwd,{recursive:true,mode:0o700});const spec=helloCommand(command,cwd);
  try{
    const {stdout}=await exec(spec.file,spec.args,spec.options);
    const result=JSON.parse(stdout.trim());
    if(result.type!=='result'||result.is_error||result.subtype!=='success')throw new Error('unsuccessful');
  }catch{throw new ProviderError('network','Hello 未確認成功，今日不會自動重送');}
}

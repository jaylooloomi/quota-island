import {spawn} from 'node:child_process';
import path from 'node:path';
import {findCli} from './cli';
import {installStatusline} from './claude-statusline';
export function terminalLaunch(dir:string){const cli=findCli('claude'),env={...cli.env,CLAUDE_CONFIG_DIR:dir};for(const k of ['CLAUDE_CODE_OAUTH_TOKEN','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN'])delete (env as NodeJS.ProcessEnv)[k];const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";return {file:path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),args:['-NoProfile','-NoExit','-Command','& '+[cli.file,...cli.args].map(quote).join(' ')],env};}
export async function openClaudeTerminal(dir:string){if(process.platform!=='win32')throw new Error('此版本的終端機啟動按鈕目前支援 Windows');installStatusline(dir);const command=terminalLaunch(dir);await new Promise<void>((resolve,reject)=>{const child=spawn(command.file,command.args,{env:command.env,cwd:dir,detached:true,stdio:'ignore',windowsHide:false});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});}

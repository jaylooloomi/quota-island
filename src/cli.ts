import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { ProviderError } from './model';
export function cliEnvironment(): NodeJS.ProcessEnv {
  const extra = process.platform === 'win32'
    ? [path.join(process.env.SystemRoot || 'C:\\Windows', 'System32'), process.env.SystemRoot || 'C:\\Windows', path.join(homedir(), 'AppData', 'Roaming', 'npm'), path.join(homedir(), '.local', 'bin'), 'C:\\Program Files\\nodejs']
    : [path.join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  return { ...process.env, PATH: [...extra, process.env.PATH || ''].join(path.delimiter) };
}
export function findCli(name: 'codex' | 'claude'): { file: string; args: string[]; env: NodeJS.ProcessEnv } {
  const env = cliEnvironment();
  const dirs = [...new Set((env.PATH || '').split(path.delimiter))];
  for (const dir of dirs) {
    const file = path.join(dir, name + (process.platform === 'win32' ? '.exe' : ''));
    if (existsSync(file)) return { file, args: [], env };
  }
  const npmRoots = process.platform === 'win32'
    ? [path.join(homedir(), 'AppData/Roaming/npm/node_modules'), 'C:/Program Files/nodejs/node_modules']
    : ['/opt/homebrew/lib/node_modules', '/usr/local/lib/node_modules', path.join(homedir(), '.npm-global/lib/node_modules')];
  for (const root of npmRoots) {
    const entry = path.join(root, name === 'codex' ? '@openai/codex/bin/codex.js' : '@anthropic-ai/claude-code/cli.js');
    if (existsSync(entry)) return { file: process.execPath, args: [entry], env: { ...env, ELECTRON_RUN_AS_NODE: '1' } };
  }
  throw new ProviderError('missing_cli', `找不到 ${name === 'codex' ? 'Codex' : 'Claude Code'} CLI，請先安裝官方 CLI 後重新整理`);
}

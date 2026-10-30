import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { ProviderError } from './model';
import { findCli } from './cli';
export interface LoginProgress { codeRequired?: boolean; browserUrl?: string; connecting?: boolean; message?: string; }
export function claudeLoginProgress(output: string): LoginProgress {
  const progress: LoginProgress = {};
  for (const match of output.matchAll(/https:\/\/[^\s\u001b<>"']+(?=[\s\u001b<>"'])/g)) {
    try {
      const url = new URL(match[0]);
      if (!['claude.ai', 'claude.com', 'platform.claude.com', 'console.anthropic.com'].includes(url.hostname) || !url.pathname.includes('oauth/authorize')) continue;
      progress.browserUrl = url.href;
      const redirect = url.searchParams.get('redirect_uri');
      if (redirect && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(redirect).hostname)) progress.codeRequired = true;
    } catch { /* Ignore non-URL diagnostics, never surface raw CLI output. */ }
  }
  if (/paste[^\n]*code|enter[^\n]*code/i.test(output)) progress.codeRequired = true;
  return progress;
}
export class ClaudeLogin {
  private child: ChildProcessWithoutNullStreams | null = null;
  private codeRequired = false;
  private cancel: (() => void) | null = null;
  constructor(private command = () => findCli('claude')) {}
  async start(progress: (value: LoginProgress) => void, timeoutMs = 300_000): Promise<void> {
    if (this.child) throw new ProviderError('auth', 'Claude 登入正在進行中');
    const cmd = this.command();
    return new Promise((resolve, reject) => {
      const child = spawn(cmd.file, [...cmd.args, 'auth', 'login', '--claudeai'], { env: cmd.env, windowsHide: true, stdio: 'pipe' });
      this.child = child; this.codeRequired = false;
      let settled = false, output = '', lastUrl = '';
      const finish = (error?: Error) => {
        if (settled) return; settled = true; clearTimeout(timer);
        this.child = null; this.cancel = null; this.codeRequired = false;
        child.kill(); error ? reject(error) : resolve();
      };
      this.cancel = () => finish(new ProviderError('auth', 'Claude 登入已取消'));
      const timer = setTimeout(() => finish(new ProviderError('auth', 'Claude 登入逾時，請重新連接')), timeoutMs);
      const receive = (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-65536);
        const info = claudeLoginProgress(output);
        if (info.codeRequired) this.codeRequired = true;
        if (info.browserUrl && info.browserUrl !== lastUrl) { lastUrl = info.browserUrl; progress(info); }
        else if (info.codeRequired) progress({ codeRequired: true });
      };
      child.stdout.on('data', receive); child.stderr.on('data', receive);
      child.stdin.on('error', () => finish(new ProviderError('auth', 'Claude 登入程序已結束，請重新連接')));
      child.on('error', () => finish(new ProviderError('missing_cli', '無法啟動 Claude Code，請確認已安裝官方 CLI')));
      child.on('exit', code => finish(code === 0 ? undefined : new ProviderError('auth', 'Claude 登入未完成，請使用 App 的登入入口重試')));
    });
  }
  submitCode(raw: unknown) {
    if (!this.child || !this.codeRequired) throw new ProviderError('auth', '目前沒有等待授權碼的 Claude 登入');
    if (typeof raw !== 'string' || raw.length > 4096 || !/^[A-Za-z0-9_.~#\-]+$/.test(raw.trim())) throw new ProviderError('auth', '請貼上授權頁提供的完整授權碼');
    this.child.stdin.write(raw.trim() + '\n');
  }
  close() { this.cancel?.(); }
}

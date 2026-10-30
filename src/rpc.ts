import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { ProviderError } from './model';
export class CodexRpc {
  private child: ChildProcessWithoutNullStreams | null = null;
  private seq = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private starting: Promise<void> | null = null;
  onNotification: (method: string, params: any) => void = () => {};
  constructor(private command: () => { file: string; args: string[]; env?: NodeJS.ProcessEnv }) {}
  private async ensure() {
    if (this.starting) return this.starting;
    if (this.child) return;
    this.starting = this.start().finally(() => { this.starting = null; });
    return this.starting;
  }
  private async start() {
    const cmd = this.command();
    const child = spawn(cmd.file, [...cmd.args, 'app-server'], { windowsHide: true, stdio: 'pipe', env: cmd.env ?? process.env });
    this.child = child;
    const rl = createInterface({ input: child.stdout });
    rl.on('line', line => {
      let m: any; try { m = JSON.parse(line); } catch { return; }
      if (m.id != null && this.pending.has(m.id)) {
        const p = this.pending.get(m.id)!; this.pending.delete(m.id); clearTimeout(p.timer);
        m.error ? p.reject(new ProviderError('network', 'Codex 介面拒絕請求；請確認 CLI 版本與登入狀態')) : p.resolve(m.result);
      } else if (m.method && m.id == null) this.onNotification(m.method, m.params);
      else if (m.id != null && m.method) {
        // Never grant tool execution or other server requests in this read-only client.
        child.stdin.write(JSON.stringify({ id: m.id, error: { code: -32601, message: 'Read-only quota client' } }) + '\n');
      }
    });
    child.stderr.resume(); // Drain diagnostics without persisting credentials or raw provider output.
    child.on('error', () => this.disconnected(child));
    child.on('exit', () => { rl.close(); this.disconnected(child); });
    try {
      await this.send('initialize', { clientInfo: { name: 'quota_island', title: 'Quota Island', version: '0.1.0' } });
      child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
    } catch (e) { child.kill(); throw e; }
  }
  private disconnected(child: ChildProcessWithoutNullStreams) {
    if (this.child !== child) return;
    this.child = null;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new ProviderError('missing_cli', 'Codex CLI 未安裝或已關閉，請安裝官方 Codex CLI')); }
    this.pending.clear();
  }
  private send(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new ProviderError('network', 'Codex 回應逾時')); }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      const child = this.child;
      if (!child || child.stdin.destroyed) { clearTimeout(timer); this.pending.delete(id); reject(new ProviderError('missing_cli', '找不到可使用的 Codex CLI')); return; }
      child.stdin.write(JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) }) + '\n', err => {
        if (err) { clearTimeout(timer); this.pending.delete(id); reject(new ProviderError('network', 'Codex 連線中斷')); }
      });
    });
  }
  async call(method: string, params?: any) { await this.ensure(); return this.send(method, params); }
  close() { this.child?.kill(); }
}

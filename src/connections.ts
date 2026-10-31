import { ProviderError, ProviderId } from './model';
import { Poller } from './poller';
import { LoginProgress } from './claude-login';
export interface ConnectionState {
  pending: boolean; phase: 'authorizing' | 'connecting' | 'code' | 'verifying' | 'syncing' | 'cooldown' | 'waiting' | 'ready' | 'error'; message: string;
  codeRequired?: boolean; canReopen?: boolean;
}
export class Connections {
  states: Partial<Record<ProviderId, ConnectionState>> = {};
  private urls = new Map<ProviderId, string>();
  constructor(private service: { login(id: ProviderId, open: (url: string) => Promise<void>, progress: (value: LoginProgress) => void): Promise<void>; submitCode(id: ProviderId, code: unknown): void },
    private poller: Poller, private open: (url: string) => Promise<void>, private changed: () => void, private focus: () => void) {}
  async login(id: ProviderId) {
    if (this.states[id]?.pending) return;
    this.states[id] = { pending: true, phase: 'authorizing', message: '等待瀏覽器授權，完成後會自動同步配額…' };
    this.changed();
    const progress = (info: LoginProgress) => {
      const s = this.states[id]; if (!s?.pending) return;
      if (info.connecting) s.phase = 'connecting';
      if (info.message) s.message = info.message;
      if (info.browserUrl) { this.urls.set(id, info.browserUrl); s.canReopen = true; }
      if (info.codeRequired) { s.codeRequired = true; s.phase = 'code'; s.message = '瀏覽器授權後，將頁面提供的授權碼貼在下方，App 會自動完成連接與同步。'; }
      this.changed();
    };
    try {
      await this.service.login(id, async url => { progress({ browserUrl: url }); await this.open(url); }, progress);
      this.states[id] = { pending: true, phase: 'syncing', message: '授權完成，正在自動同步配額…' };
      this.changed(); this.focus();
      await this.poller.authenticated(id);
      const s = this.poller.states[id];
      this.states[id] = s.status === 'ready'
        ? { pending: false, phase: 'ready', message: '已連接，配額已自動同步' }
        : id==='claude'&&s.errorCode==='schema'
        ? {pending:false,phase:'waiting',message:'Claude 已登入；等待本機配額資料。可按「開啟 Claude Code」啟動互動式 Hello，同步結果會自動更新。'}
        : this.poller.rateLimits()[id]
        ? { pending: false, phase: 'cooldown', message: '帳號授權已完成；配額查詢仍在冷卻，期滿後會自動同步。' }
        : { pending: false, phase: 'error', message: `授權流程已完成，但配額同步失敗：${s.error ?? '服務尚未提供配額'}。App 會自動重試。` };
    } catch (e) {
      this.states[id] = { pending: false, phase: 'error', message: e instanceof ProviderError ? e.message : '登入未完成，請重試' };
      this.focus();
    } finally { this.urls.delete(id); this.changed(); }
  }
  async reopen(id: ProviderId) { const url = this.urls.get(id); if (url && this.states[id]?.pending) await this.open(url); }
  submitCode(id: ProviderId, code: unknown) {
    try { this.service.submitCode(id, code); const s = this.states[id]; if (s) { s.codeRequired = false; s.phase = 'verifying'; s.message = '正在驗證授權碼，最多等待 60 秒；可取消後重新登入。'; } }
    catch (e) { const s = this.states[id]; if (s) s.message = e instanceof ProviderError ? e.message : '授權碼無法送出'; }
    this.changed();
  }
}

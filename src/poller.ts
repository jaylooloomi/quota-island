import { ProviderError, ProviderId, ProviderState, Reading, providerIds } from './model';
type Fetcher = (id: ProviderId) => Promise<Reading>;
export class Poller {
  states: Record<ProviderId, ProviderState>;
  private inFlight = new Map<ProviderId, Promise<void>>();
  private failures = new Map<ProviderId, number>();
  private lastRequest = new Map<ProviderId, number>();
  private rateLimitUntil = new Map<ProviderId, number>();
  constructor(private fetcher: Fetcher, private changed: () => void, private now = Date.now) {
    this.states = Object.fromEntries(providerIds.map(provider => [provider, { provider, status: 'loading', reading: null, updatedAt: null, error: null, nextPollAt: 0, enabled: true }])) as Record<ProviderId, ProviderState>;
  }
  setEnabled(id: ProviderId, enabled: boolean) { this.states[id].enabled = enabled; this.changed(); }
  restoreRateLimits(input: any) {
    for (const id of providerIds) {
      const value=input?.[id];
      if (typeof value?.until !== 'number' || !Number.isFinite(value.until) || value.until<=this.now()) continue;
      this.rateLimitUntil.set(id,value.until);
      this.states[id].nextPollAt=value.until;this.states[id].status='unavailable';
      this.states[id].error=typeof value.message==='string'?value.message:'服務暫時限制查詢頻率，冷卻後會自動恢復';
    }
  }
  rateLimits() {
    return Object.fromEntries([...this.rateLimitUntil].filter(([,until])=>until>this.now()).map(([id,until])=>[id,{until,message:this.states[id].error}]));
  }
  refresh(id: ProviderId, manual = false): Promise<void> {
    if (this.inFlight.has(id)) return this.inFlight.get(id)!;
    const s = this.states[id];
    const now = this.now();
    if (!s.enabled || now < (this.rateLimitUntil.get(id) ?? 0)) return Promise.resolve();
    if (manual ? now - (this.lastRequest.get(id) ?? -Infinity) < 5000 : now < s.nextPollAt) return Promise.resolve();
    this.lastRequest.set(id, now);
    const job = this.run(id).finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, job);
    return job;
  }
  private async run(id: ProviderId) {
    const s = this.states[id];
    if (!s.reading) s.status = 'loading';
    this.changed();
    try {
      const reading = await this.fetcher(id);
      if (!s.enabled) return;
      s.reading = reading; s.status = 'ready'; s.updatedAt = new Date(this.now()).toISOString(); s.error = null;
      this.failures.delete(id); s.nextPollAt = this.now() + 120_000;
      this.rateLimitUntil.delete(id);
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError('network', '連線失敗，將自動重試');
      const n = (this.failures.get(id) ?? 0) + 1;
      this.failures.set(id, n);
      if (err.code === 'auth') { s.reading = null; s.updatedAt = null; s.status = 'signed_out'; }
      else s.status = s.reading ? 'stale' : 'unavailable';
      s.error = err.message;
      s.nextPollAt = this.now() + Math.max(err.retryAfterMs, Math.min(30 * 60_000, 60_000 * 2 ** Math.min(n - 1, 5)));
      if (err.code === 'rate_limit') this.rateLimitUntil.set(id, s.nextPollAt);
    } finally { this.changed(); }
  }
  // Only called after explicit authentication completion, never by refresh buttons.
  async authenticated(id: ProviderId) {
    await this.inFlight.get(id);
    this.states[id].reading = null; this.states[id].updatedAt = null;
    this.states[id].nextPollAt = 0; this.failures.delete(id);
    return this.refresh(id);
  }
  tick(manual = false) { return Promise.all(providerIds.map(id => this.refresh(id, manual))); }
}

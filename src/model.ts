export const providerIds = ['claude', 'gemini', 'codex'] as const;
export type ProviderId = typeof providerIds[number];
export interface QuotaWindow {
  id: string; label: string; usedPercent: number; resetsAt: string | null;
  group?: string;
}
export interface Reading {
  provider: ProviderId; plan: string | null; windows: QuotaWindow[]; source: string;
}
export interface ProviderState {
  provider: ProviderId; status: 'loading' | 'ready' | 'unavailable' | 'stale' | 'signed_out';
  reading: Reading | null; updatedAt: string | null; error: string | null;
  nextPollAt: number; enabled: boolean;
  refreshing?: boolean;
}
export class ProviderError extends Error {
  constructor(public code: 'auth' | 'network' | 'schema' | 'missing_cli' | 'rate_limit', message: string, public retryAfterMs = 0) {
    super(message);
  }
}
export function percent(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}
export function iso(value: unknown): string | null {
  if (value == null || value === '') return null;
  const ms = typeof value === 'number' ? value * 1000 : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(ms) && Math.abs(ms) <= 8.64e15 ? new Date(ms).toISOString() : null;
}
export function parseClaude(data: any, plan: string | null = null): Reading {
  const windows: QuotaWindow[] = [];
  if (!data || typeof data !== 'object') throw new ProviderError('schema', 'Claude 回傳格式無法辨識');
  const seen=new Set<string>();
  // Current Claude usage responses expose scoped model limits only in this array.
  for(const row of Array.isArray(data.limits)?data.limits:[]){
    const usedPercent=percent(row?.percent);if(usedPercent===null)continue;
    const model=typeof row.scope?.model?.display_name==='string'?row.scope.model.display_name:null;
    const surface=typeof row.scope?.surface?.display_name==='string'?row.scope.surface.display_name:null;
    const kind=typeof row.kind==='string'?row.kind:'limit';
    const id=kind==='session'?'five_hour':kind==='weekly_all'?'seven_day':kind==='weekly_scoped'?`seven_day_${(model??surface??'scoped').toLowerCase()}${model&&surface?`:${surface}`:''}`:kind;
    if(seen.has(id))continue;seen.add(id);
    const label=kind==='session'?'本次工作階段':kind==='weekly_all'?'每週 · 所有模型':kind==='weekly_scoped'?`${[model,surface].filter(Boolean).join(' · ')||'模型專屬'} · 每週`:kind.replaceAll('_',' ');
    windows.push({id,label,usedPercent,resetsAt:iso(row.resets_at)});
  }
  for (const [key, value] of Object.entries(data)) {
    if(!/^(five_hour|seven_day(?:_.*)?)$/.test(key)||seen.has(key))continue;
    if (!value || typeof value !== 'object') continue;
    const row = value as any;
    const usedPercent = percent(row.utilization);
    if (usedPercent === null) continue;
    const labels: Record<string, string> = { five_hour: '本次工作階段', seven_day: '每週 · 所有模型', seven_day_sonnet: 'Sonnet · 每週', seven_day_opus: 'Opus · 每週' };
    windows.push({ id: key, label: labels[key] ?? key.replaceAll('_', ' '), usedPercent, resetsAt: iso(row.resets_at) });
  }
  if (!windows.length) throw new ProviderError('schema', 'Claude 尚未提供可辨識的配額窗口');
  return { provider: 'claude', plan, windows, source: 'Claude Code OAuth · 非公開用量端點' };
}
export function parseCodex(data: any, plan: string | null = null): Reading {
  const all = data?.rateLimitsByLimitId && Object.keys(data.rateLimitsByLimitId).length
    ? Object.entries(data.rateLimitsByLimitId) : data?.rateLimits ? [['codex', data.rateLimits]] : [];
  const windows: QuotaWindow[] = [];
  for (const [id, raw] of all) {
    const limit = raw as any;
    for (const key of ['primary', 'secondary']) {
      const w = limit?.[key];
      const usedPercent = percent(w?.usedPercent);
      if (usedPercent === null) continue;
      const mins = w.windowDurationMins;
      const duration = typeof mins === 'number' && mins > 0
        ? mins >= 1440 ? `${Math.round(mins / 1440 * 10) / 10} 天` : mins >= 60 ? `${Math.round(mins / 60 * 10) / 10} 小時` : `${mins} 分鐘`
        : key === 'primary' ? '主要窗口' : '次要窗口';
      const prefix = id !== 'codex' ? `${limit.limitName || id} · ` : '';
      windows.push({ id: `${id}-${key}`, label: `${prefix}${duration}`, usedPercent, resetsAt: iso(w.resetsAt) });
    }
  }
  if (!windows.length) throw new ProviderError('schema', '此 Codex 帳號未提供訂閱配額；API Key 帳號不適用');
  return { provider: 'codex', plan, windows, source: 'Codex app-server · account/rateLimits/read' };
}
export function parseGemini(data: any, plan: string | null = null): Reading {
  // Keep every model bucket. Flash and Pro do not necessarily share a quota.
  const windows: QuotaWindow[] = [];
  if (!Array.isArray(data?.buckets)) throw new ProviderError('schema', 'Gemini 配額格式無法辨識');
  for (const [index, bucket] of data.buckets.entries()) {
    if (typeof bucket?.remainingFraction !== 'number' || !Number.isFinite(bucket.remainingFraction) || bucket.remainingFraction < 0 || bucket.remainingFraction > 1) continue;
    const model = typeof bucket.modelId === 'string' ? bucket.modelId : 'Gemini';
    windows.push({ id: `${model}-${index}`, label: `${model}${bucket.tokenType ? ` · ${bucket.tokenType}` : ''}`,
      usedPercent: Math.round((1 - bucket.remainingFraction) * 10000) / 100, resetsAt: iso(bucket.resetTime) });
  }
  if (!windows.length) throw new ProviderError('schema', 'Gemini 尚未提供可辨識的模型配額');
  return { provider: 'gemini', plan, windows, source: 'Gemini CLI / Code Assist · 非 Gemini 網頁版' };
}

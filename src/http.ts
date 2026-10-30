import { ProviderError } from './model';
export function retryDelay(header: string | null, now = Date.now()) {
  if (!header) return 60_000;
  const seconds = Number(header);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  return Number.isFinite(delay) ? Math.max(60_000, delay) : 60_000;
}
export async function jsonRequest(url: string, headers: Record<string, string>, fetcher = fetch): Promise<any> {
  let response: Response;
  try { response = await fetcher(url, { headers, signal: AbortSignal.timeout(15_000), redirect: 'error' }); }
  catch { throw new ProviderError('network', '無法連線至用量服務，稍後自動重試'); }
  if (response.status === 401 || response.status === 403) throw new ProviderError('auth', '授權過期或沒有用量權限，請重新登入');
  if (response.status === 429) throw new ProviderError('rate_limit', '服務暫時限制查詢頻率，等待後將自動重試', retryDelay(response.headers.get('retry-after')));
  if (!response.ok) throw new ProviderError('network', `用量服務暫時不可用（HTTP ${response.status}）`);
  try { return await response.json(); } catch { throw new ProviderError('schema', '用量服務回傳無法辨識的格式'); }
}

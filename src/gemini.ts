import { OAuth2Client, Credentials, CodeChallengeMethod } from 'google-auth-library';
import { createServer, Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { ProviderError, parseGemini } from './model';
import { retryDelay } from './http';

// Public installed-application OAuth configuration from Google's Apache-2.0
// Gemini CLI oauth2.ts. This is not a user secret; see THIRD_PARTY_NOTICES.md.
const CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const SCOPES = ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'];
export interface CredentialVault {
  load(): Promise<Credentials | null>;
  save(credentials: Credentials): Promise<void>;
}
export interface Encryption {
  isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string;
  getSelectedStorageBackend?(): string;
}
export class GeminiVault implements CredentialVault {
  constructor(private directory: string, private encryption: Encryption, private legacy = path.join(homedir(), '.gemini/oauth_creds.json')) {}
  async load(): Promise<Credentials | null> {
    try {
      const bytes = await readFile(path.join(this.directory, 'gemini-session.bin'));
      if (!this.secure()) throw new ProviderError('auth', '系統金鑰儲存不可用，無法解密 Google 授權');
      return JSON.parse(this.encryption.decryptString(bytes));
    } catch (e: any) {
      if (e instanceof ProviderError) throw e;
      if (e?.code !== 'ENOENT') throw new ProviderError('auth', 'Google 授權無法讀取，請重新登入');
    }
    // Read older CLI credentials when available. Never modify the CLI's file.
    try {
      const legacy = JSON.parse(await readFile(this.legacy, 'utf8'));
      return typeof legacy.access_token === 'string' || typeof legacy.refresh_token === 'string' ? legacy : null;
    } catch { return null; }
  }
  private secure() { return this.encryption.isEncryptionAvailable() && this.encryption.getSelectedStorageBackend?.() !== 'basic_text'; }
  async save(credentials: Credentials) {
    if (!this.secure()) throw new ProviderError('auth', '請先啟用系統金鑰儲存（Keychain / Secret Service），再登入 Google');
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const file = path.join(this.directory, 'gemini-session.bin');
    await writeFile(file + '.tmp', this.encryption.encryptString(JSON.stringify(credentials)), { mode: 0o600 });
    await rename(file + '.tmp', file);
  }
}
export function matchingState(expected: string, actual: string | null) {
  if (!actual) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function geminiError(e: any): ProviderError {
  if (e instanceof ProviderError) return e;
  const status = e?.response?.status;
  if (status === 429) return new ProviderError('rate_limit', 'Gemini 暫時限制查詢頻率，稍後自動重試', retryDelay(e?.response?.headers?.get?.('retry-after') ?? null));
  if (status === 401 || status === 403 || e?.response?.data?.error === 'invalid_grant') return new ProviderError('auth', 'Google 授權過期或沒有 Code Assist 權限，請重新登入');
  return new ProviderError('network', 'Gemini 服務暫時無法連線，稍後自動重試');
}
export class Gemini {
  private server: Server | null = null;
  private cancelLogin: (() => void) | null = null;
  private generation = 0;
  constructor(private vault: CredentialVault, private makeClient = () => new OAuth2Client({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, transporterOptions: { timeout: 15_000 } })) {}
  async read() {
    const generation = this.generation;
    const credentials = await this.vault.load();
    if (!credentials) throw new ProviderError('auth', '請登入 Google，以讀取 Gemini CLI / Code Assist 配額');
    const previousToken = credentials.access_token;
    const client = this.makeClient(); client.setCredentials({ ...credentials });
    try {
      await client.getAccessToken();
      // Persist only our encrypted copy. Refresh tokens in CLI-owned files remain untouched.
      if (generation !== this.generation) throw new ProviderError('auth', 'Google 登入狀態已變更，等待重新讀取');
      if (client.credentials.access_token !== previousToken) await this.vault.save({ ...credentials, ...client.credentials });
      const post = async (method: string, data: unknown) => {
        const response = await client.request<any>({ url: `https://cloudcode-pa.googleapis.com/v1internal:${method}`,
          method: 'POST', data, timeout: 12_000, retry: false,
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'quota-island/0.1.0' } });
        return response.data;
      };
      const loaded = await post('loadCodeAssist', { metadata: { ideType: 'GEMINI_CLI', pluginType: 'GEMINI', platform: 'PLATFORM_UNSPECIFIED' } });
      const project = loaded.cloudaicompanionProject;
      if (typeof project !== 'string' || !project) throw new ProviderError('auth', '此 Google 帳號尚未啟用 Code Assist，請先使用 Gemini CLI 完成設定');
      const quota = await post('retrieveUserQuota', { project });
      if (generation !== this.generation) throw new ProviderError('auth', 'Google 登入狀態已變更，等待重新讀取');
      return parseGemini(quota, loaded.currentTier?.name ?? loaded.currentTier?.id ?? null);
    } catch (e) { throw geminiError(e); }
  }
  async login(openUrl: (url: string) => Promise<void>, timeoutMs = 300_000) {
    if (this.server) throw new ProviderError('auth', 'Google 登入正在進行中');
    this.generation++;
    const client = this.makeClient();
    const state = randomBytes(32).toString('hex');
    const verifier = await client.generateCodeVerifierAsync();
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let exchanging = false;
      const finish = (e?: Error) => {
        if (settled) return; settled = true;
        clearTimeout(timer); this.cancelLogin = null;
        server.close();
        if (e) server.closeAllConnections();
        else setTimeout(() => server.closeAllConnections(), 1000).unref();
        this.server = null;
        e ? reject(e) : resolve();
      };
      const server = createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (req.method !== 'GET' || url.pathname !== '/oauth2callback') { res.writeHead(404); res.end('Not found'); return; }
        if (!matchingState(state, url.searchParams.get('state'))) { res.writeHead(400); res.end('Invalid OAuth state. Please use the original login page.'); return; }
        if (url.searchParams.has('error')) { res.writeHead(400); res.end('Sign-in cancelled. Return to Quota Island.'); finish(new ProviderError('auth', 'Google 登入已取消')); return; }
        const code = url.searchParams.get('code');
        if (!code || exchanging) { res.writeHead(400); res.end('Missing code or request already in progress.'); return; }
        exchanging = true;
        try {
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('No callback');
          const { tokens } = await client.getToken({ code, codeVerifier: verifier.codeVerifier, redirect_uri: `http://127.0.0.1:${address.port}/oauth2callback` });
          if (!tokens.access_token) throw new ProviderError('auth', 'Google 未提供存取授權，請重試');
          if (settled) { res.end('Sign-in expired. Please try again.'); return; }
          await this.vault.save(tokens);
          res.end('Google 授權完成。Quota Island 正在自動同步配額，無需手動重新整理。');
          // Authentication completion must not depend on the browser keeping its
          // callback tab/socket open until the response has flushed.
          finish();
        } catch (e) { res.writeHead(400); res.end('Sign-in could not be completed. Return to Quota Island and try again.'); finish(geminiError(e)); }
      });
      this.server = server; this.cancelLogin = () => finish(new ProviderError('auth', 'Google 登入已取消'));
      const timer = setTimeout(() => finish(new ProviderError('auth', 'Google 登入逾時，請重試')), timeoutMs);
      server.on('error', () => finish(new ProviderError('auth', '無法啟動 Google 登入回呼，請重試')));
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') return;
        const url = client.generateAuthUrl({ redirect_uri: `http://127.0.0.1:${address.port}/oauth2callback`, access_type: 'offline', scope: SCOPES, state,
          code_challenge: verifier.codeChallenge, code_challenge_method: CodeChallengeMethod.S256, prompt: 'select_account consent' });
        void openUrl(url).catch(() => finish(new ProviderError('auth', '無法開啟瀏覽器，請重試')));
      });
    });
  }
  close() { this.cancelLogin?.(); }
}

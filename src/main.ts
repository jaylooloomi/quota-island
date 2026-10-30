import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, shell, Tray, globalShortcut, powerMonitor, Notification, safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { Poller } from './poller';
import { Providers } from './providers';
import { Gemini, GeminiVault } from './gemini';
import { Connections } from './connections';
import { CredentialWatch } from './credential-watch';
import { homedir } from 'node:os';
import { ProviderError, ProviderId, providerIds, Reading } from './model';
const demo = process.argv.includes('--demo');
const testing = process.argv.includes('--test-mode');
if (testing) {
  const testData = process.env.QUOTA_TEST_DATA;
  if (!testData) throw new Error('QUOTA_TEST_DATA required');
  app.setPath('userData', testData);
}
type Settings = { remaining: boolean; alwaysOnTop: boolean; notifications: boolean; enabled: Record<ProviderId, boolean>; order: ProviderId[]; googleSource: 'antigravity' | 'code_assist'; presentationVersion:2; x?: number; y?: number };
let settings: Settings = { remaining: true, alwaysOnTop: true, notifications: false, enabled: { claude: true, gemini: true, codex: true }, order: [...providerIds], googleSource:'antigravity', presentationVersion:2 };
function validOrder(raw: unknown): raw is ProviderId[] {
  return Array.isArray(raw) && raw.length === providerIds.length && new Set(raw).size === providerIds.length && raw.every(id => providerIds.includes(id));
}
let win: BrowserWindow;
let tray: Tray;
let expanded = false;
let quitting = false;
let paused = false;
let providers: Providers;
let poller: Poller;
let interval: NodeJS.Timeout;
let saveTimer: NodeJS.Timeout;
let connections: Connections;
let credentialWatch: CredentialWatch;
const warned = new Map<string, string>();
let savedRateLimits='';
function persistRateLimits(){
  if(!poller||demo)return;
  const serialized=JSON.stringify(poller.rateLimits());if(serialized===savedRateLimits)return;
  try{const file=path.join(app.getPath('userData'),'provider-cooldowns.json');mkdirSync(app.getPath('userData'),{recursive:true});writeFileSync(file+'.tmp',serialized,{mode:0o600});renameSync(file+'.tmp',file);savedRateLimits=serialized;}catch{/* A cache write must never stop quota updates. */}
}
function saveSettings() {
  if (demo && !testing) return;
  try {
    const dir = app.getPath('userData'); mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'preferences.json');
    writeFileSync(file + '.tmp', JSON.stringify(settings), { mode: 0o600 }); renameSync(file + '.tmp', file);
  } catch { /* Preferences must never prevent the monitoring window from working. */ }
}
function readSettings() {
  if (demo && !testing) return;
  try {
    const s = JSON.parse(readFileSync(path.join(app.getPath('userData'), 'preferences.json'), 'utf8'));
    if (validOrder(s.order)) settings.order = [...s.order];
    if (s.googleSource === 'antigravity' || s.googleSource === 'code_assist') settings.googleSource=s.googleSource;
    for (const key of ['remaining', 'alwaysOnTop', 'notifications'] as const) if (typeof s[key] === 'boolean' && (key!=='remaining'||s.presentationVersion===2)) settings[key] = s[key];
    for (const id of providerIds) if (typeof s.enabled?.[id] === 'boolean') settings.enabled[id] = s.enabled[id];
    if (Number.isFinite(s.x) && Number.isFinite(s.y)) { settings.x = s.x; settings.y = s.y; }
  } catch { /* First run or invalid preferences: use defaults. */ }
}
function snapshot() { return { providers: poller.states, settings, auth: connections?.states ?? {}, expanded, paused, demo, version: app.getVersion(), platform: process.platform }; }
function publish() {
  persistRateLimits();
  if (!win?.isDestroyed() && !win?.webContents.isDestroyed()) win?.webContents.send('state', snapshot());
  if (settings.notifications && !demo && !testing && Notification.isSupported()) {
    for (const s of Object.values(poller.states)) {
      if (!s.enabled || s.status !== 'ready') continue;
      for (const w of s.reading?.windows ?? []) {
        const key = `${s.provider}:${w.id}`;
        const reset = w.resetsAt ?? 'unknown';
        if (w.usedPercent < 85) warned.delete(key);
        if (w.usedPercent >= 90 && warned.get(key) !== reset) {
          warned.set(key, reset);
          new Notification({ title: `${s.provider} 配額即將用完`, body: `${w.label} 已使用 ${Math.round(w.usedPercent)}%` }).show();
        }
      }
    }
  }
}
function reposition() {
  const bounds = win.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const width = Math.min(expanded ? 584 : 624, area.width);
  const height = Math.min(expanded ? 744 : 92, area.height);
  win.setBounds({ width, height, x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height)) });
}
function setExpanded(value: boolean) { expanded = value; reposition(); publish(); }
const external: Record<string, string> = {
  claude: 'https://claude.ai/settings/usage', codex: 'https://chatgpt.com/codex/settings/usage',
  gemini: 'https://antigravity.google/docs/cli/commands/usage',
  'install-claude': 'https://code.claude.com/docs/en/setup', 'install-codex': 'https://developers.openai.com/codex/cli',
};
async function openAuthUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !['auth.openai.com', 'auth0.openai.com', 'chatgpt.com', 'accounts.google.com', 'claude.ai', 'claude.com', 'platform.claude.com', 'console.anthropic.com'].includes(url.hostname)) throw new ProviderError('auth', '登入服務提供的網址無法辨識');
  await shell.openExternal(url.href);
}
function validateId(raw: unknown): ProviderId {
  if (!providerIds.includes(raw as ProviderId)) throw new Error('Unknown provider');
  return raw as ProviderId;
}
function demoReading(id: ProviderId): Reading {
  const later = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
  const base = { provider: id, plan: id === 'claude' ? 'Max' : 'Pro', source: '展示資料 · 非真實帳號用量' };
  return { ...base, windows: id === 'gemini'
    ? [{ id: 'pro', label: 'Gemini Pro', usedPercent: 38, resetsAt: later(11) }, { id: 'flash', label: 'Gemini Flash', usedPercent: 12, resetsAt: later(11) }]
    : id === 'claude' ? [{ id: 'session', label: '5 小時', usedPercent:64, resetsAt: later(2.4) }, { id: 'weekly', label: '每週', usedPercent:43, resetsAt: later(72) }]
    : [{ id:'weekly', label:'7 天', usedPercent:88, resetsAt:'2026-11-04T11:22:00.000Z' }] };
}
function installHandlers() {
  // Only our trusted local renderer may call IPC. No arbitrary URLs, commands or paths.
  for (const [channel, handler] of Object.entries({
    'get-state': () => snapshot(),
    'expand': (_event: any, value: unknown) => { if (typeof value === 'boolean') setExpanded(value); },
    'refresh': async () => { if (!paused) await poller.tick(true); return snapshot(); },
    'hide': () => win.hide(),
    'quit': () => { quitting = true; app.quit(); },
    'open-provider': async (_event: any, id: unknown) => { if (typeof id === 'string' && external[id]) await shell.openExternal(external[id]!); },
    'settings': (_event: any, patch: any) => {
      if (!patch || typeof patch !== 'object') return;
      if (validOrder(patch.order)) settings.order = [...patch.order];
      const sourceChanged = !connections.states.gemini?.pending && (patch.googleSource === 'antigravity' || patch.googleSource === 'code_assist') && patch.googleSource !== settings.googleSource;
      if (sourceChanged) { settings.googleSource=patch.googleSource; delete connections.states.gemini; }
      for (const key of ['remaining', 'alwaysOnTop', 'notifications'] as const) if (typeof patch[key] === 'boolean') settings[key] = patch[key];
      if (patch.enabled && typeof patch.enabled === 'object') for (const id of providerIds) if (typeof patch.enabled[id] === 'boolean') {
        settings.enabled[id] = patch.enabled[id]; poller.setEnabled(id, patch.enabled[id]);
      }
      win.setAlwaysOnTop(settings.alwaysOnTop, 'floating'); saveSettings(); publish();
      if (sourceChanged) void poller.authenticated('gemini');
      if (!paused) void poller.tick();
    },
    'login': (_event: any, raw: unknown) => {
      const id = validateId(raw);
      if (demo) { connections.states[id] = { pending: false, phase: 'error', message: '展示模式不會啟動登入；正常啟動即可連接帳號' }; publish(); return; }
      void connections.login(id);
    },
    'reopen-login': (_event: any, raw: unknown) => connections.reopen(validateId(raw)),
    'submit-code': (_event: any, raw: unknown, code: unknown) => connections.submitCode(validateId(raw), code),
  })) {
    ipcMain.handle(channel, (event, ...args) => {
      if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Untrusted sender');
      return (handler as (...args: any[]) => unknown)(event, ...args);
    });
  }
}
function makeTray() {
  const pixels = Buffer.alloc(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const offset = (y * 32 + x) * 4;
    const inside = (x - 16) ** 2 + (y - 16) ** 2 < 13 ** 2 && (x - 16) ** 2 + (y - 16) ** 2 > 7 ** 2;
    if (inside) { pixels[offset] = 221; pixels[offset + 1] = 210; pixels[offset + 2] = 130; pixels[offset + 3] = 255; }
  }
  tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 32, height: 32 }));
  tray.setToolTip('Quota Island · Claude / Gemini / Codex');
  const updateMenu = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: '顯示動態島', click: () => { win.show(); win.focus(); } },
    { label: '展開配額面板', click: () => { setExpanded(true); win.show(); win.focus(); } },
    { label: paused ? '繼續更新' : '暫停更新', click: () => { paused = !paused; updateMenu(); publish(); if (!paused) void poller.tick(); } },
    { type: 'separator' }, { label: '結束 Quota Island', click: () => { quitting = true; app.quit(); } }
  ]));
  updateMenu(); tray.on('click', () => { win.show(); win.focus(); });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    readSettings(); providers = new Providers(new Gemini(new GeminiVault(app.getPath('userData'), safeStorage)), () => settings.googleSource);
    poller = new Poller(id => demo ? Promise.resolve(demoReading(id)) : providers.read(id), publish);
    if(!demo){try{poller.restoreRateLimits(JSON.parse(readFileSync(path.join(app.getPath('userData'),'provider-cooldowns.json'),'utf8')));}catch{/* No prior cooldowns. */}}
    connections = new Connections(providers, poller, openAuthUrl, publish, () => {
      if (!quitting && win && !win.isDestroyed()) { setExpanded(true); win.show(); win.focus(); }
    });
    credentialWatch = new CredentialWatch({
      claude: [path.join(process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'), '.credentials.json')],
      gemini: [path.join(app.getPath('userData'), 'gemini-session.bin'), path.join(homedir(), '.gemini', 'oauth_creds.json')],
    }, async (id, modifiedAt) => {
      if (!poller.states[id].enabled || connections.states[id]?.pending) return;
      const state = poller.states[id];
      if (state.status === 'ready' && state.updatedAt && Date.parse(state.updatedAt) >= modifiedAt) return;
      await poller.authenticated(id);
      if (poller.states[id].status === 'ready') { connections.states[id] = { pending: false, phase: 'ready', message: '已偵測到登入更新，配額已自動同步' }; publish(); }
    });
    for (const id of providerIds) poller.states[id].enabled = settings.enabled[id];
    const area = screen.getPrimaryDisplay().workArea;
    win = new BrowserWindow({ width: 624, height: 92, x: settings.x ?? Math.round(area.x + (area.width - 624) / 2), y: settings.y ?? area.y + 12,
      frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false, hasShadow: false,
      alwaysOnTop: settings.alwaysOnTop, skipTaskbar: true, show: false, title: 'Quota Island',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
    });
    win.setMenu(null); reposition();
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    win.on('close', event => { if (!quitting) { event.preventDefault(); win.hide(); } });
    win.on('moved', () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { const b = win.getBounds(); settings.x = b.x; settings.y = b.y; saveSettings(); }, 500); });
    screen.on('display-metrics-changed', reposition);
    screen.on('display-removed', reposition);
    installHandlers(); makeTray();
    globalShortcut.register('CommandOrControl+Alt+Q', () => { win.isVisible() ? win.hide() : win.show(); });
    powerMonitor.on('suspend', () => { paused = true; publish(); });
    powerMonitor.on('resume', () => { paused = false; publish(); void poller.tick(); });
    await win.loadFile(path.join(__dirname, 'ui/index.html'));
    win.show();
    if (!demo) await credentialWatch.scan();
    void poller.tick();
    interval = setInterval(() => { if (!paused) { if (!demo) void credentialWatch.scan(); void poller.tick(); } }, 5000);
  });
  app.on('before-quit', () => { quitting = true; clearInterval(interval); clearTimeout(saveTimer); providers?.close(); globalShortcut.unregisterAll(); saveSettings(); });
  app.on('window-all-closed', () => { if (quitting) app.quit(); });
}

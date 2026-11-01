import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('quota', {
  getState: () => ipcRenderer.invoke('get-state'),
  addAccount: (label:string) => ipcRenderer.invoke('account-add',label),
  renameAccount: (id:string,label:string) => ipcRenderer.invoke('account-rename',id,label),
  removeAccount: (id:string) => ipcRenderer.invoke('account-remove',id),
  expand: (value: boolean) => ipcRenderer.invoke('expand', value),
  antigravityAccount: (action: 'switch'|'disconnect') => ipcRenderer.invoke('antigravity-account',action),
  panelHeight: (value: number) => ipcRenderer.invoke('panel-height', value),
  petHeight: (value: number) => ipcRenderer.invoke('pet-height',value),
  onPetSuspend: (listener:(reason?:string)=>void)=>{const handler=(_event:unknown,reason?:string)=>listener(reason);ipcRenderer.on('pet-suspend',handler);return ()=>ipcRenderer.removeListener('pet-suspend',handler);},
  refresh: () => ipcRenderer.invoke('refresh'),
  login: (id: string) => ipcRenderer.invoke('login', id),
  continueClaudeLogin: (id:string)=>ipcRenderer.invoke('continue-claude-login',id),
  cancelLogin: (id: string) => ipcRenderer.invoke('cancel-login', id),
  logout: (id: string) => ipcRenderer.invoke('logout', id),
  openAntigravity: () => ipcRenderer.invoke('open-antigravity'),
  reopenLogin: (id: string) => ipcRenderer.invoke('reopen-login', id),
  submitCode: (id: string, code: string) => ipcRenderer.invoke('submit-code', id, code),
  openProvider: (id: string) => ipcRenderer.invoke('open-provider', id),
  settings: (patch: unknown) => ipcRenderer.invoke('settings', patch),
  hide: () => ipcRenderer.invoke('hide'),
  quit: () => ipcRenderer.invoke('quit'),
  subscribe: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown) => callback(state);
    ipcRenderer.on('state', listener);
    return () => ipcRenderer.removeListener('state', listener);
  }
});

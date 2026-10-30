import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('quota', {
  getState: () => ipcRenderer.invoke('get-state'),
  expand: (value: boolean) => ipcRenderer.invoke('expand', value),
  refresh: () => ipcRenderer.invoke('refresh'),
  login: (id: string) => ipcRenderer.invoke('login', id),
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

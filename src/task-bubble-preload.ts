import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('bubble',{
  close:()=>ipcRenderer.send('task-bubble-action','close'),
  view:()=>ipcRenderer.send('task-bubble-action','view'),
  hover:(value:boolean)=>ipcRenderer.send('task-bubble-hover',value),
  listen:(fn:(value:unknown)=>void)=>ipcRenderer.on('task-bubble-state',(_event,value)=>fn(value))
});

import {BrowserWindow,ipcMain,screen} from 'electron';
import path from 'node:path';
import {bubbleBounds,TaskCompletion} from './task-completion';
import type {TaskIdle} from './task-idle';
type Notice=TaskCompletion|TaskIdle;
export class TaskBubble {
  private window?:BrowserWindow;private queue:Notice[]=[];private current?:Notice;
  private timer?:NodeJS.Timeout;private remaining=12000;private started=0;private hovered=false;private ready=false;
  private anchor=280;private anchors:Record<string,number>={};private closed=false;private locale='zh-TW';
  constructor(private parent:BrowserWindow,private view:(id:string)=>void){
    ipcMain.on('task-bubble-action',this.action);ipcMain.on('task-bubble-hover',this.hover);
    parent.on('move',this.position);parent.on('resize',this.position);parent.on('show',this.position);
    parent.on('hide',this.clear);
  }
  private action=(event:Electron.IpcMainEvent,value:unknown)=>{if(event.sender!==this.window?.webContents)return;if(value==='view'&&this.current){const id=this.current.id;this.clear();this.view(id);}else if(value==='close')this.next();};
  private hover=(event:Electron.IpcMainEvent,value:unknown)=>{if(event.sender!==this.window?.webContents||typeof value!=='boolean'||this.hovered===value)return;this.hovered=value;if(value){clearTimeout(this.timer);this.remaining=Math.max(0,this.remaining-(Date.now()-this.started));}else this.arm();};
  setAnchor(x:unknown){const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=this.parent.getBounds().width;if(valid(x))this.anchor=x;else if(x&&typeof x==='object'){this.anchors={};for(const id of ['codex','claude','antigravity']){const value=(x as Record<string,unknown>)[id];if(valid(value))this.anchors[id]=value;}}this.position();}
  configure(locale:string,enabled:boolean){this.locale=locale;if(!enabled)this.clear();else this.position();}
  enqueue(item:Notice){if(this.closed||!this.parent.isVisible())return;
    if(item.kind==='idle'&&[this.current,...this.queue].some(c=>c?.id===item.id&&c.kind!=='idle'))return;
    if([this.current,...this.queue].some(c=>c?.id===item.id&&c.turnId===item.turnId))return;
    const replacesIdle=item.kind!=='idle'&&this.current?.id===item.id&&this.current.kind==='idle';
    this.queue=this.queue.filter(c=>c.id!==item.id);if(replacesIdle)this.queue.unshift(item);else this.queue.push(item);if(this.queue.length>5){if(replacesIdle)this.queue.pop();else this.queue.shift();}
    if(!this.current||replacesIdle)this.next();}
  private arm(){clearTimeout(this.timer);if(!this.current||this.hovered||!this.ready)return;this.started=Date.now();this.timer=setTimeout(()=>this.next(),this.remaining);}
  private next(){clearTimeout(this.timer);this.current=this.queue.shift();this.hovered=false;this.remaining=12000;if(!this.current){this.window?.hide();return;}if(!this.window){
    this.window=new BrowserWindow({width:300,height:142,parent:this.parent,frame:false,transparent:true,resizable:false,show:false,focusable:false,skipTaskbar:true,hasShadow:false,alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'task-bubble-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    this.window.setMenu(null);this.window.webContents.on('will-navigate',e=>e.preventDefault());this.window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    this.window.webContents.once('did-finish-load',()=>{if(this.closed)return;this.ready=true;this.position();this.arm();});void this.window.loadFile(path.join(__dirname,'ui/task-bubble.html'));
  }this.position();this.arm();}
  private position=()=>{if(!this.current||!this.ready||!this.window||this.parent.isDestroyed())return;const p=this.parent.getBounds(),b=bubbleBounds(p,screen.getDisplayMatching(p).workArea,this.anchors[this.current.provider]??this.anchor,this.current.kind==='idle'?166:142);this.window.setBounds({x:b.x,y:b.y,width:b.width,height:b.height});this.window.webContents.send('task-bubble-state',{...this.current,locale:this.locale,above:b.above,tip:b.tip});this.window.showInactive();};
  private clear=()=>{clearTimeout(this.timer);this.queue=[];this.current=undefined;this.window?.hide();};
  close(){this.closed=true;this.clear();ipcMain.removeListener('task-bubble-action',this.action);ipcMain.removeListener('task-bubble-hover',this.hover);this.window?.destroy();}
}

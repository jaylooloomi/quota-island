import type {App} from 'electron';
export function syncLoginStartup(native:Pick<App,'setLoginItemSettings'|'getLoginItemSettings'>,enabled:boolean,context:{platform:string;packaged:boolean;demo:boolean;testing:boolean;executable:string}){
  if(context.demo||context.testing)return enabled;
  if(!context.packaged||!['win32','darwin'].includes(context.platform))return false;
  const options={openAtLogin:enabled,enabled,path:context.executable,args:['--autostart'],name:'Quota Pebble'};
  native.setLoginItemSettings(options);
  const status=native.getLoginItemSettings({path:context.executable,args:options.args});
  // Windows openAtLogin checks Electron's default value name; our stable custom name is in launchItems.
  if(context.platform==='win32'&&status.launchItems)return status.launchItems.some(item=>item.name===options.name&&item.enabled);
  return status.openAtLogin;
}

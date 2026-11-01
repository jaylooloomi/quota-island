// Test entry point only. Separate CLI config directories, real child stdin/IPC,
// fixture OAuth responses; never reads or alters a real provider account.
if(!process.argv.includes('--test-mode')||!process.env.QUOTA_TEST_DATA)throw Error('Isolation required');
const path=require('node:path'),{shell}=require('electron');
require('electron').app.getVersion=()=>require('../package.json').version;
shell.openExternal=async()=>{};
const cli=require('../dist/cli');cli.findCli=()=>({file:process.execPath,args:[path.join(__dirname,'../test/fixtures/claude-multi-auth.cjs')],env:{...process.env,ELECTRON_RUN_AS_NODE:'1',ANTHROPIC_API_KEY:'TEST-IGNORE',CLAUDE_CODE_OAUTH_TOKEN:'TEST-IGNORE'}});
const http=require('../dist/http'),tokens=new Map();
http.jsonRequest=async(_url,headers)=>{const token=headers.Authorization;if(!/^Bearer TEST-claude-account-/.test(token))throw Error('Unexpected fixture credential');if(!tokens.has(token))tokens.set(token,tokens.size);return {seven_day:{utilization:tokens.get(token)===0?10:40,resets_at:new Date(Date.now()+4*86400000).toISOString()}};};
const {Providers}=require('../dist/providers'),{ProviderError}=require('../dist/model'),read=Providers.prototype.read;
Providers.prototype.read=function(id){if(id==='claude'&&this.claudeConfigDir)return read.call(this,id);return Promise.reject(new ProviderError('auth','Fixture signed out'));};
require('../dist/main');

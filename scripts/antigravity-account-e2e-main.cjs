// Isolated local-service fixture. No real provider credentials or applications.
const {shell}=require('electron');
require('electron').app.getVersion=()=>require('../package.json').version;
const {Providers}=require('../dist/providers');
const {ProviderError}=require('../dist/model');
if(!process.argv.includes('--test-mode')||!process.env.QUOTA_TEST_DATA)throw Error('Isolation required');
globalThis.__AG_ACCOUNT='first@example.invalid';
globalThis.__AG_OPENED=0;
shell.openPath=async()=>{globalThis.__AG_OPENED++;return '';};
const read=Providers.prototype.read;
Providers.prototype.read=function(id){
  if(id!=='gemini')return Promise.reject(new ProviderError('auth','Fixture signed out'));
  this.antigravity.discover=async()=>[{pid:1,token:'TEST-ONLY',ports:[1234]}];
  this.antigravity.status=async(_candidate,_port,method)=>method==='RetrieveUserQuotaSummary'?{response:{groups:[{displayName:'Gemini Models',buckets:[{bucketId:'weekly',window:'weekly',remainingFraction:globalThis.__AG_ACCOUNT.startsWith('first')?.25:.75}]}]}}:{userStatus:{email:globalThis.__AG_ACCOUNT,planStatus:{planInfo:{planName:'Pro'}}}};
  return read.call(this,id);
};
require('../dist/main');

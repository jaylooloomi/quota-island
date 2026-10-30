const fs=require('node:fs'),path=require('node:path');
const dir=process.env.CLAUDE_CONFIG_DIR;
if(!dir||!path.basename(dir).startsWith('claude-account-')||['CLAUDE_CODE_OAUTH_TOKEN','ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN'].some(k=>process.env[k]))process.exit(2);
if(process.argv.includes('logout')){fs.rmSync(path.join(dir,'.credentials.json'),{force:true});process.exit(0);}
process.stdout.write('https://claude.com/cai/oauth/authorize?redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&state=TEST\nPaste code here:\n');
require('node:readline').createInterface({input:process.stdin}).on('line',code=>{
  if(code!=='MULTI-TEST-CODE')process.exit(1);
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'.credentials.json'),JSON.stringify({claudeAiOauth:{accessToken:`TEST-${path.basename(dir)}`,subscriptionType:'Pro',expiresAt:Date.now()+3600000}}));process.exit(0);
});

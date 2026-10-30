const fs = require('node:fs');
const path = require('node:path');
const { createInterface } = require('node:readline');
process.stdout.write('https://claude.com/cai/oauth/authorize?redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&state=TEST\nPaste code here:\n');
createInterface({ input:process.stdin }).on('line', code => {
  if (code !== 'TEST-AUTH-CODE') process.exit(1);
  const dir = process.env.CLAUDE_CONFIG_DIR;
  fs.mkdirSync(dir, { recursive:true });
  fs.writeFileSync(path.join(dir,'.credentials.json'), JSON.stringify({ claudeAiOauth:{ accessToken:'TEST-NOT-A-REAL-TOKEN', expiresAt:Date.now()+3600000 } }));
  process.exit(0);
});

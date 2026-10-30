const { createInterface } = require('node:readline');
let initialized = false, notified = false;
createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line);
  if (m.method === 'initialized') { notified = true; return; }
  let result;
  if (m.method === 'initialize') { initialized = true; result = { userAgent: 'fixture' }; }
  else if (!initialized || !notified) { process.stdout.write(JSON.stringify({ id: m.id, error: { message: 'missing handshake' } }) + '\n'); return; }
  else if (m.method === 'account/read') result = { account: { type: 'chatgpt', planType: 'plus' } };
  else if (m.method === 'account/rateLimits/read') result = { rateLimits: { primary: { usedPercent: 23 } } };
  else { process.stdout.write(JSON.stringify({ id: m.id, error: { message: 'TEST-SECRET' } }) + '\n'); return; }
  setTimeout(() => process.stdout.write(JSON.stringify({ id: m.id, result }) + '\n'), m.method === 'account/read' ? 20 : 0);
});

const { _electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
(async () => {
  const compiled = await fs.readFile('dist/main.js', 'utf8');
  const initial = compiled.match(/let settings = ([^;]+);/)[1];
  const defaults = vm.runInNewContext('(' + initial + ')', {demo:false});
  for (const key of ['compactTaskSummary','autoStart','alwaysOnTop','notifications','petIdle','petAlerts','petRoam','morningHelloEnabled']) assert.equal(defaults[key], true, key);
  assert.equal(defaults.petPlacement, 'stage');
  assert.equal(defaults.petBackground, 'meteor');
  assert.equal(defaults.petCharacter, 'claude');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pebble-defaults-'));
  const env = {...process.env, QUOTA_TEST_DATA:dir}; delete env.ELECTRON_RUN_AS_NODE;
  let app;
  async function launch() { app = await _electron.launch({args:['.','--demo','--test-mode'],env}); const p=await app.firstWindow(); await p.waitForFunction(() => !!window.quota); return p; }
  try {
    let p = await launch();
    let state = await p.evaluate(() => quota.getState());
    assert.equal(state.settings.petPlacement, 'stage');
    assert.equal(state.settings.autoStart, true);
    await p.locator('#toggle').click();await p.locator('#tab-tasks').click();assert.equal(await p.locator('.task-summary-setting input').isChecked(),true,'fresh task summary checkbox is checked');
    assert.equal(state.settings.notifications, true);
    await p.evaluate(() => quota.settings({compactTaskSummary:false,autoStart:false,notifications:false,alwaysOnTop:false,petIdle:false,petAlerts:false,petRoam:false,morningHelloEnabled:false,petPlacement:'title'}));
    await app.close(); app=null;
    p=await launch(); state=await p.evaluate(() => quota.getState());
    for (const key of ['compactTaskSummary','autoStart','alwaysOnTop','notifications','petIdle','petAlerts','petRoam','morningHelloEnabled']) assert.equal(state.settings[key],false,key+' persisted');
    assert.equal(state.settings.petPlacement,'title');
    await p.locator('#toggle').click();await p.locator('#tab-tasks').click();assert.equal(await p.locator('.task-summary-setting input').isChecked(),false,'existing opt-out stays unchecked');await p.locator('.task-summary-setting input').check();await app.close();app=null;p=await launch();assert.equal((await p.evaluate(()=>quota.getState())).settings.compactTaskSummary,true,'explicit opt-in persists too');
    console.log('PASS: fresh-install defaults and existing preferences preserved across restart; no live calls or OS startup changes');
  } finally {if(app) await app.close(); await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e => { console.error(e); process.exitCode=1; });

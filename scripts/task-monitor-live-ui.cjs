// Opt-in real Codex inference. Quota providers use demo data; task events are REAL.
const {_electron}=require('playwright'),{spawn}=require('node:child_process'),{createInterface}=require('node:readline'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {findCli}=require('../dist/cli');
(async()=>{
  if(!process.argv.includes('--probe-turn'))throw Error('Pass --probe-turn to authorize one tiny real inference.');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pebble-live-ui-')),output='test-results/task-monitor-live';await fs.mkdir(output,{recursive:true});let app,child;
  try{
    const env={...process.env,QUOTA_TEST_DATA:dir,QUOTA_TASK_BRIDGE_HOME:os.homedir()};delete env.ELECTRON_RUN_AS_NODE;
    app=await _electron.launch({...(process.env.QUOTA_PACKAGED_EXE?{executablePath:process.env.QUOTA_PACKAGED_EXE}:{}),args:[...(process.env.QUOTA_PACKAGED_EXE?[]:['.']),'--demo','--test-mode'],env});const page=await app.firstWindow();await page.waitForFunction(()=>window.quota&&document.querySelector('#mini-codex').textContent.includes('%'));await page.locator('#toggle').click();await page.locator('#tab-tasks').click();await page.locator('.task-filters button').nth(1).click();
    const cli=findCli('codex');let sessionId,finished=false,exit;const lifecycle=[];
    child=spawn(cli.file,[...cli.args,'exec','--json','--ephemeral','--skip-git-repo-check','Reply exactly PEBBLE_MONITOR_OK. Do not use tools.'],{cwd:dir,env:cli.env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stderr.resume();
    createInterface({input:child.stdout}).on('line',line=>{try{const e=JSON.parse(line);if(e.type==='thread.started')sessionId=e.thread_id;if(['thread.started','turn.started','turn.completed'].includes(e.type))lifecycle.push(e.type);}catch{}});
    const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>{exit=code;finished=true;resolve();});});
    const deadline=Date.now()+45000;let seen=false;
    while(Date.now()<deadline&&!seen){if(sessionId){const row=page.locator(`.task-row[data-session-id="${sessionId}"][data-status="running"]`);if(await row.count()){seen=true;await page.screenshot({path:output+'/running.png'});}}if(finished&&!seen)break;await page.waitForTimeout(100);}
    await done;assert.equal(exit,0);assert.equal(seen,true,'actual running session must appear in real Electron renderer');assert.ok(lifecycle.includes('turn.completed'));
    await page.waitForTimeout(2200);await page.locator('.task-filters button').first().click();const task=(await page.evaluate(()=>quota.getState())).tasks.rows.find(r=>r.id===sessionId);assert.equal(task.status,'idle');
    const proof={version:'1.18.0',sessionId,lifecycle,realHookObserved:true,realRendererObserved:true,finalStatus:task.status,quotaData:'demo; no provider queries',desktopExistingSessions:'not verified'};await fs.writeFile(output+'/proof.json',JSON.stringify(proof,null,2));console.log(proof);
  }finally{if(child?.exitCode===null)child.kill();if(app)await app.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
})().catch(e=>{console.error(e);process.exitCode=1;});

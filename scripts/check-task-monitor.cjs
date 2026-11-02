// Default: passive observation only. --probe-turn explicitly starts one tiny real turn.
const {TaskMonitor}=require('../dist/task-monitor'),{CodexRpc}=require('../dist/rpc'),{findCli}=require('../dist/cli');
const {spawn}=require('node:child_process'),{createInterface}=require('node:readline'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
  const monitor=new TaskMonitor(path.join(os.homedir(),'.quota-pebble/task-events'),new CodexRpc(()=>findCli('codex')),new CodexRpc(()=>findCli('codex'),'proxy'),()=>{});
  let child,dir,interval;const proof={time:new Date().toISOString(),probeTurn:process.argv.includes('--probe-turn'),sawRunning:false,turnStarted:false,turnCompleted:false,matchedSession:false};
  try{
    await monitor.start();proof.connection=monitor.snapshot().connection;
    if(proof.probeTurn){
      dir=fs.mkdtempSync(path.join(os.tmpdir(),'pebble-task-proof-'));const cli=findCli('codex');
      await new Promise((resolve,reject)=>{
        child=spawn(cli.file,[...cli.args,'exec','--json','--ephemeral','--skip-git-repo-check','Reply exactly PEBBLE_MONITOR_OK. Do not use tools.'],{cwd:dir,env:cli.env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stderr.resume();
        createInterface({input:child.stdout}).on('line',line=>{try{const e=JSON.parse(line);if(e.type==='thread.started')proof.sessionId=e.thread_id;if(e.type==='turn.started')proof.turnStarted=true;if(e.type==='turn.completed')proof.turnCompleted=true;}catch{}});
        interval=setInterval(()=>{const row=monitor.snapshot().rows.find(r=>r.id===proof.sessionId);if(row){proof.matchedSession=true;if(row.status==='running')proof.sawRunning=true;}},100);
        const timeout=setTimeout(()=>{child.kill();reject(Error('Real probe timed out'));},60000);
        child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);proof.exit=code;resolve();});
      });
      proof.finalStatus=monitor.snapshot().rows.find(r=>r.id===proof.sessionId)?.status;
    }else{
      const snapshot=monitor.snapshot();proof.counts=snapshot.counts;proof.rows=snapshot.rows.map(({id,status,source})=>({id,status,source}));
    }
    fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/task-monitor-live.json',JSON.stringify(proof,null,2));console.log(proof);
    if(proof.probeTurn&&(!proof.sawRunning||!proof.matchedSession||!proof.turnCompleted||proof.exit!==0))process.exitCode=1;
  }finally{clearInterval(interval);monitor.close();if(dir)fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

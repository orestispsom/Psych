import {readFile,readdir,mkdir,writeFile,open,unlink,copyFile,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root,addon,hash,lua} from './common.mjs';
import {parseSavedVariables} from './saved-variables.mjs';
const clients=[
 {name:'Classic Era',root:'C:/Program Files (x86)/World of Warcraft/_classic_era_',forever:false},
 {name:'Forever beta',root:'C:/Program Files (x86)/World of Warcraft/_classic_beta_',forever:true},
];
const output=path.join(root,'exports/wow');await mkdir(output,{recursive:true});
const lockPath=path.join(output,'desktop-sync.lock');
let lock;
try {lock=await open(lockPath,'wx');await lock.writeFile(JSON.stringify({pid:process.pid}));}
catch(e){if(e.code==='EEXIST')throw new Error('Another sync is running, or a previous run was interrupted. Close it; if no sync is running, ask Codex to inspect '+lockPath);throw e;}
const report={startedAt:new Date().toISOString(),status:'RUNNING',backups:[],exports:[],uploads:[]};
function run(script,args=[]){return execFileSync(process.execPath,[path.join(root,'scripts/wow',script),...args],{cwd:root,encoding:'utf8',env:process.env,timeout:300000,maxBuffer:8*1024*1024});}
try {
 console.log('PsychQuiz Sync — Orestis only\nRun /reload in WoW before syncing. No game keys are sent.');
 const saves=[];
 for(const client of clients){
  const accountRoot=path.join(client.root,'WTF/Account'),candidates=[];
  for(const account of await readdir(accountRoot,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
    if(!account.isDirectory())continue;
    const file=path.join(accountRoot,account.name,'SavedVariables/PsychQuiz.lua');
    try{await stat(file);candidates.push(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  if(candidates.length>1)throw new Error('Multiple WoW accounts in '+client.name+' have PsychQuiz data. Nothing was uploaded.');
  if(candidates.length===1)saves.push({...client,source:candidates[0]});
 }
 for(const save of saves){
   const {source}=save,first=await readFile(source,'utf8'),second=await readFile(source,'utf8');
   if(first!==second)throw new Error('WoW is currently saving. Wait for /reload to finish and run Sync again.');
   const db=parseSavedVariables(first);
   if(db.profileId!=='orestis'||db.schemaVersion!==1)throw new Error('SavedVariables profile/schema mismatch');
   const backup=path.join(output,'SavedVariables-'+(save.forever?'forever':'era')+'-'+Date.now()+'-'+hash(first).slice(0,12)+'.lua');
   await writeFile(backup,first,{flag:'wx'});report.backups.push({client:save.name,path:backup});
   const exported=JSON.parse(run('export.mjs',[backup]));report.exports.push({client:save.name,...exported});
   console.log(save.name+': backed up and validated '+exported.events+' answer events.');
   const upload=JSON.parse(run('sync.mjs',[exported.destination,'--apply']));report.uploads.push({client:save.name,...upload});
   console.log(save.name+': uploaded '+upload.inserted+' new answers; '+upload.duplicates+' already synchronized.');
   if(save.forever){
     const installedSeed=path.join(save.root,'Interface/AddOns/PsychQuiz/SavedVariablesSeed.lua');
     await stat(path.join(path.dirname(installedSeed),'PsychQuiz.toc'));
     await writeFile(installedSeed,'-- GENERATED FROM VALIDATED FOREVER SAVEDVARIABLES.\nPsychQuizSeedDB = '+lua(db)+'\n','utf8');
     report.foreverSeed=installedSeed;
   }
 }
 if(!saves.length)console.log('No saved addon data yet. Nothing to upload; downloading your current progress.');
 report.download=JSON.parse(run('pull.mjs'));
 for(const client of clients){
  const installed=path.join(client.root,'Interface/AddOns/PsychQuiz/ProfileImport.lua');
  try{await stat(path.join(path.dirname(installed),'PsychQuiz.toc'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
  await copyFile(installed,path.join(output,'ProfileImport-'+(client.forever?'forever':'era')+'-backup-'+Date.now()+'.lua'));
  const temporary=installed+'.sync-'+process.pid+'.tmp';
  await copyFile(path.join(addon,'ProfileImport.lua'),temporary);await rename(temporary,installed);
 }
 report.status='SUCCESS';
 console.log('Updated addon baseline. Type /reload in WoW to load it.\nRefresh the Psych web app to display the latest server progress.');
} catch(e){report.status='FAILED';report.error=e.message;console.error('Sync stopped: '+e.message+'\nBackups and any unsynced answers are preserved. Retrying cannot double-count accepted events.');process.exitCode=1;}
finally {report.finishedAt=new Date().toISOString();await writeFile(path.join(output,'sync-report-'+Date.now()+'.json'),JSON.stringify(report,null,2));await lock.close();await unlink(lockPath);}

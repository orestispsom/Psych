import {readFile} from 'node:fs/promises';
import {loadBank,hash,rpc} from './common.mjs';
import {validateEvents,validateCompletedExams} from './validate.mjs';
const source=process.argv[2],apply=process.argv.includes('--apply');
if(!source)throw new Error('Usage: node --env-file=.env scripts/wow/sync.mjs <export.json> [--apply]. Default: dry run.');
const {payloadHash,exportedAt,...payload}=JSON.parse(await readFile(source,'utf8'));
if(payload.schemaVersion!==1||payload.profileId!=='orestis'||payload.source!=='wow'||hash(payload)!==payloadHash||!Number.isFinite(Date.parse(exportedAt)))throw new Error('Invalid export identity or checksum');
const bank=await loadBank();
validateEvents(payload.events,bank);
const completedExams=validateCompletedExams(payload.completedExams||[],bank);
const batches=[];for(let i=0;i<payload.events.length;i+=500)batches.push(payload.events.slice(i,i+500));
// Preflight every batch before any write. Each apply batch is atomic and retry-safe.
const plans=[];for(const events of batches)plans.push(await rpc('psychquiz_sync',{events,dry_run:true}));
// Exam markers are committed only after their constituent answer events.
const examPlans=[];
for(const exam of completedExams)
  examPlans.push(await rpc('psychquiz_complete_exam',{p_session_id:exam.sessionId,
    p_question_ids:exam.questionIds,p_completed_at:exam.completedAt,dry_run:true}));
const results=[];
if(apply)for(const events of batches)results.push(await rpc('psychquiz_sync',{events,dry_run:false}));
const examResults=[];
if(apply)for(const exam of completedExams)
  examResults.push(await rpc('psychquiz_complete_exam',{p_session_id:exam.sessionId,
    p_question_ids:exam.questionIds,p_completed_at:exam.completedAt,dry_run:false}));
console.log(JSON.stringify({profileId:'orestis',status:apply?'SYNCED':'DRY_RUN',events:payload.events.length,
  inserted:results.reduce((n,r)=>n+r.inserted,0),wouldInsert:plans.reduce((n,r)=>n+r.wouldInsert,0),
  duplicates:plans.reduce((n,r)=>n+r.duplicates,0),completedExams:completedExams.length,examsApplied:examResults.filter(r=>r.synced).length,batches:batches.length},null,2));

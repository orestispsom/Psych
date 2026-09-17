import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root,addon,loadBank,writeLua,remoteClient,rpc,hash} from './common.mjs';
const get=remoteClient();
const profiles=await get('study_profiles',{select:'id,name',id:'eq.orestis'});
if(profiles.length!==1||profiles[0].id!=='orestis'||profiles[0].name.toLowerCase()!=='orestis') throw new Error('Orestis profile identity could not be verified');
const [bank,remote]=await Promise.all([loadBank(),rpc('psychquiz_snapshot',{})]);
if(remote.profileId!=='orestis'||!Array.isArray(remote.questions)||!remote.includedEventIds)throw new Error('Invalid atomic snapshot');
const rows=remote.questions;
const ids=new Set(bank.questions.map(q=>String(q.id))),questions={},unknown=[];
const epoch=v=>v?Math.floor(Date.parse(v)/1000):null;
for(const r of rows) {
  if(!ids.has(String(r.question_id))) { unknown.push(r.question_id); continue; }
  questions[String(r.question_id)]={seenCount:r.seen_count,correctCount:r.correct_count,wrongCount:r.wrong_count,
    consecutiveCorrect:r.consecutive_correct,consecutiveWrong:r.consecutive_wrong,masteryLevel:r.mastery_level,
    lastAnsweredAt:epoch(r.last_answered_at),nextReviewAt:epoch(r.next_review_at),lastSelected:r.last_selected,lastCorrect:r.last_answer_correct};
}
const includedEventIds=remote.includedEventIds;
const snapshot={schemaVersion:1,profileId:'orestis',generatedAt:remote.generatedAt,bankVersion:bank.bankVersion,
  snapshotId:hash({questions,includedEventIds}),questions,includedEventIds};
const report={profileId:'orestis',totalRows:rows.length,importedRows:Object.keys(questions).length,unmatchedIds:unknown,
  currentQuestionsWithoutState:bank.questions.filter(q=>!questions[String(q.id)]).map(q=>q.id),snapshotId:snapshot.snapshotId,
  note:'Atomic event/aggregate snapshot. Unmatched historical rows remain untouched in Supabase.'};
const folder=path.join(root,'exports/wow'); await mkdir(folder,{recursive:true});
await writeFile(path.join(folder,'baseline-report-'+Date.now()+'.json'),JSON.stringify(report,null,2),'utf8');
await writeLua(path.join(addon,'ProfileImport.lua'),'import',snapshot);
console.log(JSON.stringify({...report,unmatchedIds:unknown.length,currentQuestionsWithoutState:report.currentQuestionsWithoutState.length},null,2));

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=await readFile(new URL('../../../supabase/migrations/20260916144129_psychquiz_atomic_events.sql',import.meta.url),'utf8');
const origin=await readFile(new URL('../../../supabase/migrations/20260910151501_normalize_mcq_persistence.sql',import.meta.url),'utf8');
test('Postgres: event transaction, replay order, retries, stale app writes, sixth choice and rollback',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create table public.study_profiles(id text primary key,mcq_progress jsonb default '{}',updated_at timestamptz default now()); insert into public.study_profiles(id) values ('orestis'),('other');`);
  await db.exec(origin.split('insert into public.profile_mcq_state')[0]);
  await db.exec(`insert into user_question_state(profile_id,question_id,correct_count,seen_count,mastery_level,last_answered_at) values ('orestis',1,7,7,2,'2020-01-01');`);
  await db.exec('begin;'+migration+'commit;');
  const event=(id,time,correct=true)=>({schemaVersion:1,eventId:'wow:db-test:'+id,profileId:'orestis',questionId:1,questionHash:'a'.repeat(64),bankVersion:'b'.repeat(64),answeredAt:time,selectedIndex:5,correctIndex:correct?5:0,isCorrect:correct,sessionId:'wow-session:test:1',mode:'quick',source:'wow',confidence:3});
  const run=async(es,dry=false)=>(await db.query('select psychquiz_sync($1::jsonb,$2) as result',[JSON.stringify(es),dry])).rows[0].result;
  const state=async()=>(await db.query("select * from user_question_state where profile_id='orestis' and question_id=1")).rows[0];
  const e=event(1,1700000010);
  assert.equal((await run([e],true)).wouldInsert,1);assert.equal((await state()).correct_count,7);
  assert.equal((await run([e])).inserted,1);assert.equal((await state()).correct_count,8);
  assert.equal((await run([e])).duplicates,1);assert.equal((await state()).correct_count,8);
  await assert.rejects(run([{...e,mode:'exam'}]),/Conflicting/);
  assert.equal((await state()).last_selected,5);
  // A late (but post-baseline) answer is replayed chronologically, not at arrival time.
  await run([event(2,1700000000,false)]);
  assert.equal((await state()).last_answer_correct,true);assert.equal((await state()).consecutive_correct,1);
  await db.exec("update user_question_state set correct_count=999,wrong_count=999,mastery_level=5 where profile_id='orestis' and question_id=1");
  assert.equal((await state()).correct_count,8);assert.equal((await state()).wrong_count,1);
  // The old app's ordinary event insertion participates in the same transaction/reducer.
  await db.exec("insert into question_attempts(profile_id,question_id,client_attempt_id,mode,selected_index,selected_option,is_correct,confidence,attempted_at) values ('orestis',1,'app-test-1','random',0,'A',true,3,'2024-01-01')");
  assert.equal((await state()).correct_count,9);
  const before=await state();
  await assert.rejects(run([event(3,1700000020),{...event(4,1700000030),profileId:'other'}]));
  assert.deepEqual(await state(),before);
  await assert.rejects(run([event(5,1000000000)]),/baseline/);
  await assert.rejects(run([event(6,1700000040),event(6,1700000040)]),/Duplicate/);
  await db.exec("insert into user_question_state(profile_id,question_id,correct_count) values ('other',1,3); update user_question_state set correct_count=4 where profile_id='other'");
  assert.equal((await db.query("select correct_count from user_question_state where profile_id='other'")).rows[0].correct_count,4);
  await db.exec('set role anon');
  assert.equal((await run([e])).duplicates,1);
  const snapshot=(await db.query('select psychquiz_snapshot() as snapshot')).rows[0].snapshot;
  assert.equal(snapshot.profileId,'orestis');assert.equal(snapshot.includedEventIds[e.eventId],true);
  assert.equal(snapshot.questions.find(q=>q.question_id===1).correct_count,9);
  await db.exec('reset role');
 } finally {await db.close();}
});

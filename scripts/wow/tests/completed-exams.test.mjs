import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCompletedExams} from '../validate.mjs';

const bank={questions:Array.from({length:100},(_,i)=>({id:i+1}))};
const marker=()=>({
  schemaVersion:1,profileId:'orestis',
  sessionId:'wow-session:1790275791-574090680:3',
  startedAt:1790275791,completedAt:1790275891,
  questionIds:Array.from({length:100},(_,i)=>i+1),
});

test('valid completed 100-question marker passes',()=>{
  assert.equal(validateCompletedExams([marker()],bank).length,1);
});
test('repeated session IDs are rejected',()=>{
  const exam=marker();
  assert.throws(()=>validateCompletedExams([exam,exam],bank),/duplicate/);
});
test('duplicate question IDs or missing questions are rejected',()=>{
  const duplicate=marker();
  duplicate.questionIds[99]=duplicate.questionIds[0];
  assert.throws(()=>validateCompletedExams([duplicate],bank),/100-question/);
  const missing=marker();
  missing.questionIds[99]=999999;
  assert.throws(()=>validateCompletedExams([missing],bank),/100-question/);
});
test('incorrect profile and reversed times are rejected',()=>{
  const wrongProfile=marker();
  wrongProfile.profileId='someone-else';
  assert.throws(()=>validateCompletedExams([wrongProfile],bank),/Malformed/);
  const wrongTimes=marker();
  wrongTimes.completedAt=wrongTimes.startedAt-1;
  assert.throws(()=>validateCompletedExams([wrongTimes],bank),/timestamps/);
});
test('no completed sessions remains a valid legacy export',()=>{
  assert.deepEqual(validateCompletedExams([],bank),[]);
});

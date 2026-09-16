import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSavedVariables,tableArray} from '../saved-variables.mjs';
import {lua,loadBank,hash,stable} from '../common.mjs';
import {validateEvents} from '../validate.mjs';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('full bank has stable unique IDs, Greek content and dynamic answers',async()=>{
  const bank=await loadBank(); assert.equal(bank.questions.length,2081);
  assert.equal(new Set(bank.questions.map(q=>q.id)).size,2081);
  assert.ok(bank.questions.some(q=>q.options.length===6));
  assert.equal((await loadBank()).bankVersion,bank.bankVersion);
  const reordered=[...bank.questions].reverse().sort((a,b)=>a.id-b.id).map(({contentHash,...q})=>q);
  assert.equal(hash(reordered),bank.bankVersion);
});
test('Lua serializer round trips Unicode, newlines, escapes, booleans and numbers',()=>{
  const object={schemaVersion:1,profileId:'orestis',text:'Ψυχοπαθολογία\n"λόγος"\\test',flag:false,number:0};
  assert.deepEqual(JSON.parse(JSON.stringify(parseSavedVariables('PsychQuizDB = '+lua(object)))),object);
});
test('SavedVariables parser rejects executable input and ambiguous data',()=>{
  for(const s of ['PsychQuizDB = os.execute("x")','PsychQuizDB = {}\nprint("x")','PsychQuizDB = {a=1,a=2}','PsychQuizDB = {x=function() end}'])assert.throws(()=>parseSavedVariables(s));
  assert.throws(()=>tableArray({1:'x',3:'y'}));
});
test('SavedVariables handles actual WoW table syntax and comments',()=>{
  const db=parseSavedVariables('PsychQuizDB = {\n["events"] = { { ["eventId"] = "wow:abc:1", ["isCorrect"] = true, }, -- [1]\n}, ["schemaVersion"]=1, }');
  assert.equal(tableArray(db.events)[0].eventId,'wow:abc:1');
});
test('canonical hashes ignore object field order',()=>assert.equal(hash({a:1,b:2}),hash({b:2,a:1})));
test('export validates events, preserves sixth choices, and re-export is byte-identical',async()=>{
  const bank=await loadBank(),q=bank.questions.find(q=>q.options.length===6);
  const e={schemaVersion:1,profileId:'orestis',source:'wow',eventId:'wow:test-install:1',questionId:q.id,questionHash:q.contentHash,bankVersion:bank.bankVersion,selectedIndex:5,correctIndex:q.correct,isCorrect:q.correct===5,answeredAt:1700000000,sessionId:'wow-session:test:1',mode:'quick',confidence:3};
  validateEvents([e],bank);
  assert.throws(()=>validateEvents([e,e],bank));
  assert.throws(()=>validateEvents([{...e,questionId:99999999}],bank));
  assert.throws(()=>validateEvents([{...e,questionHash:'changed'}],bank));
  assert.throws(()=>validateEvents([{...e,selectedIndex:6}],bank));
  assert.throws(()=>validateEvents([{...e,profileId:'someone-else'}],bank));
  const folder=await mkdtemp(path.join(tmpdir(),'psychquiz-export-test-'));
  const source=path.join(folder,'PsychQuiz.lua');
  await writeFile(source,'PsychQuizDB = '+lua({schemaVersion:1,profileId:'orestis',events:[e]}));
  const run=()=>JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('../export.mjs',import.meta.url)),source],{encoding:'utf8'}));
  const first=run(),bytes=await readFile(first.destination,'utf8');
  const second=run();assert.equal(first.destination,second.destination);assert.equal(await readFile(second.destination,'utf8'),bytes);
  assert.equal(JSON.parse(bytes).events[0].selectedIndex,5);
  assert.ok(JSON.parse(bytes).exportedAt);
});

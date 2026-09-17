import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {parseSavedVariables,tableArray} from './saved-variables.mjs';
import {loadBank,root,hash,stable} from './common.mjs';
import {validateEvents} from './validate.mjs';
const source=process.argv[2];
if(!source)throw new Error('Usage: node scripts/wow/export.mjs <PsychQuiz.lua SavedVariables path>. Run /reload or exit WoW first.');
const db=parseSavedVariables(await readFile(source,'utf8'));
if(db.schemaVersion!==1||db.profileId!=='orestis')throw new Error('Unsupported schema or profile');
const bank=await loadBank();
const events=validateEvents(tableArray(db.events),bank);
events.sort((a,b)=>a.answeredAt-b.answeredAt||a.eventId.localeCompare(b.eventId));
const payload={schemaVersion:1,profileId:'orestis',bankVersion:bank.bankVersion,source:'wow',events};
const payloadHash=hash(payload);
const out=path.join(root,'exports/wow');await mkdir(out,{recursive:true});
const destination=path.join(out,'progress-'+payloadHash.slice(0,20)+'.json');
// Stable payload; creation time is not part of identity. Re-export is a no-op.
try{await writeFile(destination,stable({...payload,payloadHash,exportedAt:new Date().toISOString()})+'\n',{flag:'wx'});}catch(e){
  if(e.code!=='EEXIST')throw e;
  const existing=JSON.parse(await readFile(destination,'utf8'));
  const {payloadHash:existingHash,exportedAt,...body}=existing;
  if(existingHash!==payloadHash||hash(body)!==payloadHash)throw new Error('Existing export does not match its content identity; preserve it and investigate: '+destination);
}
console.log(JSON.stringify({events:events.length,sessions:new Set(events.map(e=>e.sessionId)).size,payloadHash,destination},null,2));

import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root,remoteClient,allPages} from './common.mjs';
const get=remoteClient(),snapshot={exportedAt:new Date().toISOString(),profileId:'orestis'};
for(const table of ['study_profiles','user_question_state','question_attempts','profile_mcq_state'])snapshot[table]=await allPages(get,table,{select:'*',[table==='study_profiles'?'id':'profile_id']:'eq.orestis',order:table==='user_question_state'?'question_id.asc':table==='profile_mcq_state'?'profile_id.asc':'id.asc'});
const dir=path.join(root,'exports/wow');await mkdir(dir,{recursive:true});
const destination=path.join(dir,'remote-backup-'+Date.now()+'.json');
await writeFile(destination,JSON.stringify(snapshot,null,2),{flag:'wx'});
console.log(JSON.stringify({destination,questions:snapshot.user_question_state.length,attempts:snapshot.question_attempts.length}));

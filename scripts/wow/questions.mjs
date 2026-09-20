import {access} from 'node:fs/promises';
import path from 'node:path';
import {loadBank,writeLua,addon} from './common.mjs';
const bank=await loadBank();
await writeLua(path.join(addon,'Questions.lua'),'bank',bank);
try { await access(path.join(addon,'ProfileImport.lua')); }
catch { await writeLua(path.join(addon,'ProfileImport.lua'),'import',{schemaVersion:1,profileId:'orestis',snapshotId:'empty',questions:{},includedEventIds:{}}); }
console.log(JSON.stringify({questions:bank.questions.length,topics:new Set(bank.questions.map(q=>q.topic)).size,bankVersion:bank.bankVersion,malformed:0,duplicates:0,skipped:0},null,2));

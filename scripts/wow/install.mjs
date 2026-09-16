import {cp,stat,readFile} from 'node:fs/promises';
import path from 'node:path';
import {addon} from './common.mjs';
const client=process.argv[2];
if(!client)throw new Error('Usage: node scripts/wow/install.mjs <absolute Classic Era client folder>');
if(!path.isAbsolute(client)||path.basename(client)!=='_classic_era_')throw new Error('An explicit _classic_era_ path is required');
await stat(path.join(client,'WowClassic.exe'));
for(const file of ['Questions.lua','ProfileImport.lua','Media/FiraSans-Regular.ttf','Media/NotoSansSymbols2-Regular.ttf'])await stat(path.join(addon,file));
const destination=path.join(client,'Interface','AddOns','PsychQuiz');
let exists=false;try{await stat(destination);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
if(exists){
  const toc=await readFile(path.join(destination,'PsychQuiz.toc'),'utf8');
  if(!toc.includes('## Title: PsychQuiz'))throw new Error('Destination is not a recognized PsychQuiz addon');
  const backup=destination+'.backup-'+Date.now();await cp(destination,backup,{recursive:true,errorOnExist:true,force:false});
  console.log('Previous addon files backed up: '+backup);
}
await cp(addon,destination,{recursive:true});
console.log('Installed '+destination+'\nSavedVariables were not touched. Open Classic Era and type /psych.');

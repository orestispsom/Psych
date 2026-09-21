import {cp,stat,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {addon} from './common.mjs';
const client=process.argv[2];
if(!client)throw new Error('Usage: node scripts/wow/install.mjs <absolute Classic Era client folder>');
if(!path.isAbsolute(client)||!['_classic_era_','_classic_beta_'].includes(path.basename(client)))throw new Error('An explicit _classic_era_ or _classic_beta_ path is required');
const forever=path.basename(client)==='_classic_beta_';
await stat(path.join(client,forever?'WowB.exe':'WowClassic.exe'));
for(const file of ['Questions.lua','ProfileImport.lua','Media/FiraSans-Regular.ttf','Media/NotoSansSymbols2-Regular.ttf'])await stat(path.join(addon,file));
const destination=path.join(client,'Interface','AddOns','PsychQuiz');
await mkdir(path.dirname(destination),{recursive:true});
let exists=false;try{await stat(destination);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
let preservedSeed=null;
if(exists){
  const toc=await readFile(path.join(destination,'PsychQuiz.toc'),'utf8');
  if(!toc.includes('## Title: PsychQuiz'))throw new Error('Destination is not a recognized PsychQuiz addon');
  const backup=destination+'.backup-'+Date.now();await cp(destination,backup,{recursive:true,errorOnExist:true,force:false});
  if(forever)try{preservedSeed=await readFile(path.join(destination,'SavedVariablesSeed.lua'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  console.log('Previous addon files backed up: '+backup);
}
await cp(addon,destination,{recursive:true});
if(preservedSeed&&preservedSeed.includes('PsychQuizSeedDB = {'))await writeFile(path.join(destination,'SavedVariablesSeed.lua'),preservedSeed,'utf8');
console.log('Installed '+destination+'\nSavedVariables were not touched. Open '+(forever?'Forever beta':'Classic Era')+' and type /psych.');

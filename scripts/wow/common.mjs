import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const addon=path.join(root,'addons/PsychQuiz');
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
export function stable(value) {
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function lua(value) {
  if(value===null || value===undefined) return 'nil';
  if(typeof value==='string') return '"'+value.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\r/g,'\\r').replace(/\n/g,'\\n').replace(/\t/g,'\\t').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,c=>'\\'+c.charCodeAt(0).toString().padStart(3,'0'))+'"';
  if(typeof value==='boolean') return String(value);
  if(typeof value==='number' && Number.isFinite(value)) return String(value);
  if(Array.isArray(value)) return '{'+value.map(lua).join(',')+'}';
  if(typeof value==='object') return '{'+Object.keys(value).sort().map(k=>'['+lua(k)+']='+lua(value[k])).join(',')+'}';
  throw new Error('Unsupported Lua value');
}
export async function loadBank() {
  const raw=await readFile(path.join(root,'src/data/questions.js'),'utf8');
  const questions=(await import('data:text/javascript;base64,'+Buffer.from(raw).toString('base64'))).default;
  const ids=new Set();
  for(const q of questions) {
    if(!Number.isSafeInteger(q.id)||q.id<1||ids.has(q.id)) throw new Error('Missing/duplicate question ID: '+q.id);
    ids.add(q.id);
    for(const f of ['stem','topic','explanation']) if(typeof q[f]!=='string'||!q[f].trim()) throw new Error(`Question ${q.id}: missing ${f}`);
    if(!Array.isArray(q.options)||q.options.length<2||q.options.some(x=>typeof x!=='string'||!x.trim())) throw new Error('Malformed choices: '+q.id);
    if(!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length) throw new Error('Invalid correct answer: '+q.id);
  }
  const sorted=[...questions].sort((a,b)=>a.id-b.id);
  return {schemaVersion:1,bankVersion:hash(sorted),questions:sorted.map(q=>({...q,contentHash:hash(q)}))};
}
export async function writeLua(file,field,value) {
  await mkdir(path.dirname(file),{recursive:true});
  await writeFile(file,'-- GENERATED / DO NOT EDIT. Regenerate with scripts/wow.\nlocal _, P = ...\nP.'+field+' = '+lua(value)+'\n','utf8');
}
export function remoteClient() {
  const base=process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key=process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if(!base||!key) throw new Error('Load the existing local environment using node --env-file=<path>. No secrets belong in addon files.');
  return async function get(table,params) {
    const url=new URL(base.replace(/\/$/,'')+'/rest/v1/'+table);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
    const res=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key}});
    if(!res.ok) throw new Error('Read failed: '+table+' HTTP '+res.status);
    return res.json();
  };
}
export async function allPages(get,table,params) {
  const rows=[];
  for(let offset=0;;offset+=1000) {
    const page=await get(table,{...params,limit:'1000',offset:String(offset)});
    if(!Array.isArray(page)) throw new Error('Unexpected database response');
    rows.push(...page); if(page.length<1000) return rows;
  }
}
export async function rpc(name,body) {
  const base=process.env.VITE_SUPABASE_URL||process.env.SUPABASE_URL;
  const key=process.env.VITE_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY;
  if(!base||!key)throw new Error('Missing local Supabase environment');
  if(new URL(base).hostname!=='mgmigrmcdlxbzzpuzzzp.supabase.co')throw new Error('Unexpected Supabase project; refusing sync');
  const response=await fetch(base.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  const result=await response.json();
  if(!response.ok)throw new Error('Supabase '+name+': '+(result.message||response.status));
  return result;
}

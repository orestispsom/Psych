const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

(async () => {
  const root = path.resolve(__dirname, '../dist');
  const list = async (folder, prefix) => {
    const files = [];
    for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) files.push(...await list(path.join(folder, entry.name), url));
      else files.push(url);
    }
    return files;
  };
  const urls = ['/index.html', ...await list(path.join(root, 'assets'), '/assets'), ...await list(path.join(root, 'study'), '/study')].sort();
  const curriculum = JSON.parse(await fs.readFile(path.join(root, 'study/runtime-content.el.json'), 'utf8'));
  if (curriculum.chunks.length !== 455 || curriculum.chunks.reduce((n, c) => n + c.questions.length, 0) !== 1849)
    throw new Error('The complete Greek study curriculum is required for offline use.');
  const hash = createHash('sha256');
  for (const url of urls) hash.update(await fs.readFile(path.join(root, url.slice(1))));
  const cache = `psych-study-${hash.digest('hex').slice(0, 16)}`;
  await fs.writeFile(path.join(root, 'study-sw.js'), `
const CACHE=${JSON.stringify(cache)},URLS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{await cache.addAll(URLS.map(url=>new Request(url,{cache:'reload'})));}
 catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const key=event.request.mode==='navigate'?'/index.html':url.pathname;
 if(!URLS.includes(key))return;
 event.respondWith((async()=>{
  const response=await(await caches.open(CACHE)).match(key);
  return response||fetch(event.request);
 })());
});
`);
  console.log(`Study offline cache: ${urls.length} static files; profile data remains in IndexedDB/Supabase.`);
})().catch(error => { console.error(error); process.exitCode = 1; });

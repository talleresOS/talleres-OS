// Exercise the actual standalone server from a source copy with no .git, secrets or dependencies.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,copyFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {root,out} from './harness.mjs';
await mkdir(out,{recursive:true});
const folder=await mkdtemp(path.join(out,'runtime-source-'));
const manifest=JSON.parse(await readFile(path.join(root,'dist/release-manifest.json'),'utf8'));
for(const name of [...Object.keys(manifest.files),'prepare-release.mjs','scripts/dev.mjs','api/assistant.mjs','server/server.mjs','server/openai-provider.mjs','server/errors.mjs']){
 const dest=path.join(folder,name);await mkdir(path.dirname(dest),{recursive:true});await copyFile(path.join(root,name),dest);
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const child=spawn(process.execPath,['scripts/dev.mjs'],{cwd:folder,env:{...process.env,DEV_PORT:String(port),OPENAI_API_KEY:'',ASSISTANT_ACCESS_CODE:'',ASSISTANT_ENABLED:'false'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
const closed=new Promise(r=>child.once('exit',r));
try{
 const deadline=Date.now()+15000;while(!log.includes('TallerOS local:')){if(child.exitCode!==null||Date.now()>deadline)throw Error('Standalone runtime did not start: '+log);await new Promise(r=>setTimeout(r,50));}
 const base='http://127.0.0.1:'+port;
 assert.equal((await fetch(base)).status,200);
 for(const name of Object.keys(manifest.files))assert.equal((await fetch(base+'/'+name)).status,200,name);
 for(const name of ['server/.env.local','.env','server/server.mjs','api/assistant.mjs','package.json','local-backups/test.json','scripts/dev.mjs','.git/config'])assert.equal((await fetch(base+'/'+name)).status,404,name);
 const request=await fetch(base+'/api/assistant/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{"code":"unused"}'});
 assert.equal(request.status,503);assert.equal(request.headers.get('access-control-allow-origin'),base);assert.equal((await request.json()).code,'not_configured');
 const version=await (await fetch(base+'/version.json')).json();assert.equal(version.version,'3.0.0');
 console.log('PASS Runtime independiente: copia sin Git, sin node_modules y sin secretos; 30 recursos, API opcional 503 y rutas privadas inaccesibles.');
}finally{child.kill();await closed;}

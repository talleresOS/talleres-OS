import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import api from '../api/assistant.mjs';
const nativeFetch=fetch;let calls=0;
process.env.OPENAI_API_KEY='synthetic-test-key';process.env.ASSISTANT_ACCESS_CODE='synthetic-test-owner';process.env.VERCEL_URL='synthetic-preview.vercel.app';process.env.ASSISTANT_ALLOWED_ORIGINS='https://talleresos.github.io';
globalThis.fetch=async(url,options)=>{
 if(url==='https://api.openai.com/v1/responses'){calls++;return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{"action":"order.balance","order":"Toyota"}'}]}]})};}
 return nativeFetch(url,options);
};
const server=createServer(async(req,res)=>{const chunks=[];for await(const c of req)chunks.push(c);req.body=JSON.parse(Buffer.concat(chunks));await api(req,res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const post=(action,body,token)=>nativeFetch(base+'/api/assistant?action='+action,{method:'POST',headers:{Origin:'https://synthetic-preview.vercel.app','Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
try{
 const session=await (await post('session',{code:'synthetic-test-owner'})).json();assert.ok(session.token);
 const r=await post('interpret',{message:'Cuánto debe Toyota',history:[]},session.token);assert.equal(r.status,200);assert.equal((await r.json()).intent.action,'order.balance');assert.equal(calls,1);
 assert.equal((await post('secret',{},session.token)).status,404);
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));assert.equal(config.outputDirectory,'dist');assert.ok(config.functions['api/assistant.mjs'].excludeFiles.includes('server/.env*'));
 const manifest=JSON.parse(await readFile(new URL('../dist/release-manifest.json',import.meta.url)));
 assert.equal(Object.keys(manifest.files).length,29);for(const name of Object.keys(manifest.files))assert.ok(!/server|api\/|\.env|test|backup/.test(name));
 console.log('PASS Adaptador Vercel: req.body procesado, origen de preview, sesión, interpretación, secretos excluidos y 29 archivos públicos. Despliegue remoto aún no verificado.');
}finally{globalThis.fetch=nativeFetch;server.closeAllConnections();await new Promise(r=>server.close(r));}

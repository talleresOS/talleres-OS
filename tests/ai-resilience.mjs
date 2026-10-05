import assert from 'node:assert/strict';
import {createAssistantServer} from '../server/server.mjs';
import {openAIProvider} from '../server/openai-provider.mjs';
import {createAssistantProvider} from '../assistant-provider.mjs';
import {start} from './harness.mjs';
const origin='https://talleresos.github.io';
const listen=async server=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};
const stop=async server=>{server.closeAllConnections();await new Promise(r=>server.close(r));};
const post=(base,route,body,token)=>fetch(base+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
let calls=0,release;
const server=createAssistantServer({origins:[origin],accessCode:'synthetic-resilience-code',provider:async()=>{calls++;await new Promise(r=>release=r);return {intent:{action:'orders.list'}};}}),base=await listen(server);
try{
 const {token}=await (await post(base,'/session',{code:'synthetic-resilience-code'})).json();
 const payload={message:'Pendientes',history:[],requestId:'synthetic-request-0001'};
 const first=post(base,'/interpret',payload,token),second=post(base,'/interpret',payload,token);while(!release)await new Promise(r=>setTimeout(r,5));release();assert.equal((await first).status,200);assert.equal((await second).status,200);assert.equal(calls,1);
 assert.equal((await post(base,'/interpret',payload,token)).status,200);assert.equal(calls,1);assert.equal((await post(base,'/interpret',{...payload,message:'otro'},token)).status,409);
 assert.equal((await post(base,'/interpret',{message:'x'.repeat(1501),history:[]},token)).status,400);assert.equal(calls,1);
 const down=createAssistantServer({origins:[origin],enabled:false});const downUrl=await listen(down);
 try{const r=await post(downUrl,'/session',{code:'unused'});assert.equal(r.status,503);assert.equal(r.headers.get('access-control-allow-origin'),origin);}finally{await stop(down);}
 for(const [scenario,stub,code] of [
  ['no key',null,'not_configured'],['offline',async()=>{throw Error('private detail');},'network'],['timeout',async()=>{throw new DOMException('private detail','TimeoutError');},'timeout'],
  ['bad credential',async()=>({ok:false,status:401,json:async()=>({error:{message:'NEVER DISPLAY SECRET'}})}),'provider_auth'],
  ['no funds',async()=>({ok:false,status:429,json:async()=>({error:{type:'insufficient_quota'}})}),'quota'],
  ['rate limit',async()=>({ok:false,status:429,json:async()=>({error:{type:'rate_limit_error'}})}),'rate_limit'],
  ['bad JSON',async()=>({ok:true,json:async()=>{throw Error('html response');}}),'invalid_response'],
  ['bad intent',async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:'{"action":"delete.database"}'}]}]})}),'invalid_response']
 ]){const provider=openAIProvider({apiKey:scenario==='no key'?'':'test-only-key',fetchImpl:stub});await assert.rejects(()=>provider({message:'x'}),e=>e.code===code&&!e.message.includes('NEVER DISPLAY SECRET'));}
 let networkCalls=0,finish;const client=createAssistantProvider({fetchImpl:async(url)=>{networkCalls++;if(url.endsWith('/session'))return {ok:true,json:async()=>({token:'synthetic-session'})};await new Promise(r=>finish=r);return {ok:true,json:async()=>({intent:{action:'orders.list'}})};}});
 await client.connect('https://example.test/api/assistant','synthetic-code');await assert.rejects(()=>client.interpret('x'.repeat(1501)),/1,500/);assert.equal(networkCalls,1);
 const inflight=client.interpret('Pendientes');await assert.rejects(()=>client.interpret('Pendientes'),/Espera/);finish();await inflight;assert.equal(networkCalls,2);
 const h=await start();try{
  await h.page.goto(h.origin);await h.page.locator('.top').waitFor();await h.page.getByRole('button',{name:'Abrir mi asistente',exact:true}).click();await h.page.getByLabel('Mensaje para mi asistente',{exact:true}).fill('Consulta sin servidor');await h.page.getByRole('button',{name:'Enviar',exact:true}).click();await h.page.getByText(/Conecta el servidor privado. Las consultas rápidas/).waitFor();await h.page.getByRole('button',{name:'Vehículos pendientes',exact:true}).click();await h.page.getByText('No hay órdenes que coincidan.',{exact:true}).waitFor();await h.page.getByRole('button',{name:'Cerrar asistente',exact:true}).click();
  await h.page.goto(h.origin+'/#clients');await h.page.getByRole('button',{name:'Nuevo cliente',exact:true}).click();await h.page.getByLabel('Nombre completo',{exact:true}).fill('Operación sin IA');await h.page.getByLabel('Teléfono',{exact:true}).fill('8095550101');await h.page.getByRole('button',{name:'Guardar cliente',exact:true}).click();await h.page.getByRole('heading',{name:'Operación sin IA',exact:true}).waitFor();await h.page.reload();await h.page.getByRole('heading',{name:'Operación sin IA',exact:true}).waitFor();assert.deepEqual(h.errors,[]);
 }finally{await h.stop();}
 console.log('PASS Resiliencia IA: sin clave, caída, timeout, cuota, autenticación, límites, JSON/intención inválidos, deduplicación concurrente, bloqueo de envíos y operación normal sin IA.');
}finally{await stop(server);}

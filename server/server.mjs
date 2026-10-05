// API only. This process NEVER serves workspace files or reads/writes workshop data.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual,createHmac,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openAIProvider} from './openai-provider.mjs';
import {publicAssistantError} from './errors.mjs';
import {validateIntent} from '../assistant-contract.mjs';
const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);};
export const configuredLimit=(value,fallback,max=1000000)=>value!==undefined&&value!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=max?Number(value):fallback;
export function createAssistantHandler({provider,origins=[],accessCode,enabled=true,limitPerDay=250,limitPerMinute=12,maxConcurrent=2,now=()=>Date.now()}={}){
  const configured=enabled&&typeof provider==='function'&&typeof accessCode==='string'&&accessCode.length>=12;
  // Signed short-lived sessions survive serverless cold starts. Rotating the code revokes them.
  const sign=data=>createHmac('sha256',accessCode).update(data).digest('base64url');
  const validToken=(token,origin,time)=>{
    try{const [data,signature,...extra]=token.split('.');if(extra.length||!signature||!equal(signature,sign(data)))return false;const value=JSON.parse(Buffer.from(data,'base64url').toString());return value.origin===origin&&Number.isFinite(value.expiry)&&value.expiry>time&&value.expiry<=time+12*3600000;}catch{return false;}
  };
  let failures=[],requests=[],busy=0;const cache=new Map();
  const send=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(value));};
  return async(req,res)=>{
    const origin=req.headers.origin;
    if(!origins.includes(origin)){send(res,403,{error:'Origen no autorizado.'});return;}
    res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');
    if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'600'});res.end();return;}
    if(req.method!=='POST'||!['/session','/interpret'].includes(req.url)){send(res,404,{error:'Ruta no disponible.'});return;}
    if(!configured){send(res,503,{error:'El asistente no está configurado o está desactivado. Puedes seguir usando TallerOS sin IA.',code:'not_configured'});return;}
    if(!req.headers['content-type']?.startsWith('application/json')){send(res,415,{error:'Formato no permitido.'});return;}
    try{
      let body;
      try{
        if(req.body!==undefined){if(Buffer.byteLength(JSON.stringify(req.body))>24000){send(res,413,{error:'La conversación es demasiado larga.'});return;}body=typeof req.body==='string'?JSON.parse(req.body):req.body;}
        else{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>24000){send(res,413,{error:'La conversación es demasiado larga.'});return;}chunks.push(c);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
        if(!body||typeof body!=='object'||Array.isArray(body))throw Error('body');
      }catch{send(res,400,{error:'Solicitud inválida.'});return;}
      const time=now();
      if(req.url==='/session'){
        failures=failures.filter(t=>time-t<900000);if(failures.length>=8){send(res,429,{error:'Espera 15 minutos antes de intentar conectar nuevamente.'});return;}
        if(!equal(body.code,accessCode)){failures.push(time);send(res,401,{error:'Código de conexión incorrecto.'});return;}
        const data=Buffer.from(JSON.stringify({origin,expiry:time+12*3600000,nonce:randomBytes(16).toString('base64url')})).toString('base64url');send(res,200,{token:data+'.'+sign(data),expiresIn:43200});return;
      }
      const token=String(req.headers.authorization||'').replace(/^Bearer /,'');if(!validToken(token,origin,time)){send(res,401,{error:'Vuelve a conectar tu sesión con el asistente.'});return;}
      if(typeof body.message!=='string'||!body.message.trim()||body.message.length>1500||!Array.isArray(body.history)||body.history.length>12){send(res,400,{error:'Mensaje inválido o demasiado largo.'});return;}
      if(body.history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>1600)){send(res,400,{error:'Contexto inválido.'});return;}
      if(body.requestId!==undefined&&(typeof body.requestId!=='string'||! /^[A-Za-z0-9_-]{16,80}$/.test(body.requestId))){send(res,400,{error:'Identificador de solicitud inválido.'});return;}
      let draft=null;try{if(body.draft)draft=validateIntent(body.draft);}catch{send(res,400,{error:'Intención pendiente inválida.'});return;}
      const payload={message:body.message,history:body.history.map(m=>({role:m.role,text:m.text})),today:/^\d{4}-\d{2}-\d{2}$/.test(body.today)?body.today:null,draft};
      for(const [key,entry] of cache)if(entry.expiresAt<=time)cache.delete(key);
      const key=body.requestId?createHash('sha256').update(token).digest('hex')+':'+body.requestId:null;
      const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex'),previous=key&&cache.get(key);
      if(previous){if(previous.digest!==digest){send(res,409,{error:'La solicitud ya existe con otro contenido.'});return;}const reply=await previous.promise;send(res,reply.status,reply.body);return;}
      requests=requests.filter(t=>time-t<86400000);
      if(requests.length>=limitPerDay||requests.filter(t=>time-t<60000).length>=limitPerMinute||busy>=maxConcurrent){send(res,429,{error:'Límite de uso del asistente alcanzado. Intenta más tarde.',code:'local_limit'});return;}
      requests.push(time);busy++;
      const promise=(async()=>{try{return {status:200,body:await provider(payload)};}catch(error){return publicAssistantError(error);}finally{busy--;}})();
      if(key){if(cache.size>=1000)cache.delete(cache.keys().next().value);cache.set(key,{digest,promise,expiresAt:time+5*60000});}
      const reply=await promise;send(res,reply.status,reply.body);
    }catch{send(res,400,{error:'Solicitud inválida. No se guardó ningún cambio.'});}
  };
}
export const createAssistantServer=options=>createServer(createAssistantHandler(options));
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.loadEnvFile(fileURLToPath(new URL('.env.local',import.meta.url)));}catch(e){if(e.code!=='ENOENT')throw e;}
  const code=process.env.ASSISTANT_ACCESS_CODE;
  const origins=(process.env.ASSISTANT_ALLOWED_ORIGINS||'https://talleresos.github.io').split(',').map(s=>s.trim());
  const app=createAssistantServer({provider:openAIProvider({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-4.1-mini'}),origins,accessCode:code,enabled:!!process.env.OPENAI_API_KEY&&process.env.ASSISTANT_ENABLED!=='false',limitPerDay:configuredLimit(process.env.ASSISTANT_DAILY_LIMIT,250),limitPerMinute:configuredLimit(process.env.ASSISTANT_MINUTE_LIMIT,12,120),maxConcurrent:configuredLimit(process.env.ASSISTANT_MAX_CONCURRENT,2,10)});
  app.listen(Number(process.env.PORT)||8787,process.env.HOST||'127.0.0.1',()=>{
    console.log('Servidor privado de TallerOS activo. No sirve archivos ni datos del taller.');
    if(!code||!process.env.OPENAI_API_KEY)console.log('IA sin configurar. Las funciones locales del taller no necesitan esta API.');
  });
}

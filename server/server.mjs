// API only. This process NEVER serves workspace files or reads/writes workshop data.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openAIProvider} from './openai-provider.mjs';
const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);};
export function createAssistantHandler({provider,origins=[],accessCode,limitPerDay=250,now=()=>Date.now()}={}){
  if(!provider||!accessCode||accessCode.length<12)throw Error('Configura proveedor y código privado de acceso (mínimo 12 caracteres).');
  // Signed short-lived sessions survive serverless cold starts. Rotating the code revokes them.
  const sign=data=>createHmac('sha256',accessCode).update(data).digest('base64url');
  const validToken=(token,origin,time)=>{
    try{const [data,signature,...extra]=token.split('.');if(extra.length||!signature||!equal(signature,sign(data)))return false;const value=JSON.parse(Buffer.from(data,'base64url').toString());return value.origin===origin&&Number.isFinite(value.expiry)&&value.expiry>time&&value.expiry<=time+12*3600000;}catch{return false;}
  };
  let failures=[],requests=[],busy=0;
  const send=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});res.end(JSON.stringify(value));};
  return async(req,res)=>{
    const origin=req.headers.origin;
    if(!origins.includes(origin)){send(res,403,{error:'Origen no autorizado.'});return;}
    res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');
    if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'600'});res.end();return;}
    if(req.method!=='POST'||!['/session','/interpret'].includes(req.url)){send(res,404,{error:'Ruta no disponible.'});return;}
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
      requests=requests.filter(t=>time-t<86400000);
      if(requests.length>=limitPerDay||requests.filter(t=>time-t<60000).length>=12||busy>=2){send(res,429,{error:'Límite de uso del asistente alcanzado. Intenta más tarde.'});return;}
      if(typeof body.message!=='string'||!body.message.trim()||body.message.length>1500||!Array.isArray(body.history)||body.history.length>12){send(res,400,{error:'Mensaje inválido o demasiado largo.'});return;}
      if(body.history.some(m=>!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>1600)){send(res,400,{error:'Contexto inválido.'});return;}
      const payload={message:body.message,history:body.history,today:/^\d{4}-\d{2}-\d{2}$/.test(body.today)?body.today:null,draft:body.draft||null};
      requests.push(time);busy++;
      try{send(res,200,await provider(payload));}finally{busy--;}
    }catch(error){send(res,502,{error:error.name==='TimeoutError'?'La IA tardó demasiado. Puedes volver a intentarlo; no se guardó nada.':error.message?.startsWith('La ')||error.message?.startsWith('El ')||error.message?.startsWith('Falta ')?error.message:'No se pudo interpretar la solicitud. No se guardó ningún cambio.'});}
  };
}
export const createAssistantServer=options=>createServer(createAssistantHandler(options));
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.loadEnvFile(fileURLToPath(new URL('.env.local',import.meta.url)));}catch(e){if(e.code!=='ENOENT')throw e;}
  const code=process.env.ASSISTANT_ACCESS_CODE||randomBytes(18).toString('base64url');
  const origins=(process.env.ASSISTANT_ALLOWED_ORIGINS||'https://talleresos.github.io').split(',').map(s=>s.trim());
  const app=createAssistantServer({provider:openAIProvider({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-4.1-mini'}),origins,accessCode:code,limitPerDay:Number(process.env.ASSISTANT_DAILY_LIMIT)||250});
  app.listen(Number(process.env.PORT)||8787,process.env.HOST||'127.0.0.1',()=>{
    console.log('Servidor privado de TallerOS activo. No sirve archivos ni datos del taller.');
    if(!process.env.ASSISTANT_ACCESS_CODE)console.log('Código de conexión temporal (solo para el propietario): '+code);
  });
}

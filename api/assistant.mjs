import {createAssistantHandler} from '../server/server.mjs';
import {openAIProvider} from '../server/openai-provider.mjs';
let handler;
export default async function assistant(req,res){
  if(!process.env.OPENAI_API_KEY||!process.env.ASSISTANT_ACCESS_CODE||process.env.ASSISTANT_ACCESS_CODE.length<12){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'El servidor del asistente todavía no está configurado.'}));return;}
  if(!handler){
    const origins=new Set((process.env.ASSISTANT_ALLOWED_ORIGINS||'https://talleresos.github.io').split(',').map(s=>s.trim()).filter(Boolean));
    for(const host of [process.env.VERCEL_URL,process.env.VERCEL_PROJECT_PRODUCTION_URL])if(host)origins.add('https://'+host);
    handler=createAssistantHandler({provider:openAIProvider({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-4.1-mini'}),accessCode:process.env.ASSISTANT_ACCESS_CODE,origins:[...origins],limitPerDay:Number(process.env.ASSISTANT_DAILY_LIMIT)||250});
  }
  const url=new URL(req.url,'https://localhost'),action=url.searchParams.get('action');
  req.url=action==='session'?'/session':action==='interpret'?'/interpret':'/not-found';
  return handler(req,res);
}

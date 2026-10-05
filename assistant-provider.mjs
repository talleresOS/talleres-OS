import {today} from './domain.mjs';
import {validateIntent} from './assistant-contract.mjs';
// Session tokens live only in memory. Never put an OpenAI key in this client.
export function createAssistantProvider({fetchImpl=fetch,timeoutMs=40000}={}){
  let endpoint='',token='',busy=false;
  async function request(route,body){
    if(!endpoint)throw Error('Conecta el servidor privado del asistente para usar IA.');
    let response;
    try{response=await fetchImpl(endpoint+route,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(timeoutMs),credentials:'omit',cache:'no-store'});}catch(error){throw Error(error.name==='TimeoutError'||error.name==='AbortError'?'La IA tardó demasiado. No se guardó ningún cambio; puedes intentarlo de nuevo.':'No pude conectar con la IA. Revisa Internet y la dirección del servidor. Tus datos siguen guardados.');}
    let result;try{result=await response.json();}catch{throw Error('El servidor devolvió una respuesta inválida. Puedes seguir usando TallerOS sin IA.');}
    if(!response.ok){if(response.status===401)token='';throw Error(typeof result?.error==='string'&&result.error.length<600?result.error:'El asistente no está disponible.');}return result;
  }
  return {
    get connected(){return !!token;},
    async connect(url,code){if(busy)throw Error('Espera a que termine la solicitud actual.');busy=true;try{const u=new URL(url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Utiliza HTTPS para el servidor.');if(u.username||u.password||u.search||u.hash)throw Error('Dirección inválida.');endpoint=u.origin+u.pathname.replace(/\/$/,'');token='';const r=await request('/session',{code});if(typeof r?.token!=='string'||!r.token||r.token.length>4096)throw Error('El servidor no devolvió una sesión válida.');token=r.token;}finally{busy=false;}},
    disconnect(){token='';},
    async interpret(message,history=[],draft=null){
      if(busy)throw Error('Espera a que termine la solicitud actual.');
      if(typeof message!=='string'||!message.trim()||message.length>1500)throw Error('Escribe un mensaje de hasta 1,500 caracteres.');
      if(!token)throw Error('Conecta el servidor privado. Las consultas rápidas y el taller funcionan sin IA.');
      busy=true;try{const r=await request('/interpret',{requestId:crypto.randomUUID(),message,history:history.slice(-12).map(m=>({role:m.role,text:m.text.slice(0,1600)})),draft,today:today()});return validateIntent(r.intent);}finally{busy=false;}
    }
  };
}

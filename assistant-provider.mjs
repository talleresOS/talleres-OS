import {today} from './domain.mjs';
import {validateIntent} from './assistant-contract.mjs';
// Session tokens live only in memory. Never put an OpenAI key in this client.
export function createAssistantProvider(){
  let endpoint='',token='';
  async function request(route,body){
    if(!endpoint)throw Error('Conecta el servidor privado del asistente para usar IA.');
    let response;
    try{response=await fetch(endpoint+route,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(40000),credentials:'omit',cache:'no-store'});}catch{throw Error('No pude conectar con la IA. Revisa Internet y la dirección del servidor. Tus datos siguen guardados.');}
    const result=await response.json();if(!response.ok){if(response.status===401)token='';throw Error(result.error||'El asistente no está disponible.');}return result;
  }
  return {
    get connected(){return !!token;},
    async connect(url,code){const u=new URL(url);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Utiliza HTTPS para el servidor.');if(u.username||u.password||u.search||u.hash)throw Error('Dirección inválida.');endpoint=u.origin+u.pathname.replace(/\/$/,'');token='';const r=await request('/session',{code});token=r.token;},
    disconnect(){token='';},
    async interpret(message,history,draft){const r=await request('/interpret',{message,history:history.slice(-12).map(m=>({role:m.role,text:m.text.slice(0,1600)})),draft,today:today()});return validateIntent(r.intent);}
  };
}

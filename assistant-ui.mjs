import {createAssistantProvider} from './assistant-provider.mjs';
import {createVoiceAdapter} from './assistant-voice.mjs';
import {prepareIntent} from './assistant-core.mjs';
export function createAssistantUI({service,render,esc,toast,onOrderCreated}){
  const provider=createAssistantProvider();let context={},draft=null,pending=null,busy=false,listening=false,previousFocus,messages=[];
  const root=document.createElement('div');root.id='assistant-root';
  root.innerHTML='<button type="button" class="assistant-launch" aria-label="Abrir mi asistente" title="Mi asistente"><span aria-hidden="true">✦</span> <span>Mi asistente</span></button><dialog id="assistant-panel" aria-labelledby="assistant-title"><header class="assistant-header"><div><span class="eyebrow">TallerOS</span><h2 id="assistant-title">Mi asistente</h2><small id="assistant-status">A tu lado en el taller</small></div><button type="button" class="btn quiet" data-ai="close" aria-label="Cerrar asistente">✕</button></header><div class="assistant-feed" role="log" aria-live="polite" aria-relevant="additions"><div class="assistant-welcome"><span class="assistant-orb" aria-hidden="true">✦</span><h3>¿Qué resolvemos hoy?</h3><p>Consulta el taller o prepara un cambio.<br>Tú confirmas antes de guardarlo.</p><div class="assistant-suggestions"><button type="button" class="btn" data-query="orders.list">Vehículos pendientes</button><button type="button" class="btn" data-query="reports.month">Este mes</button><button type="button" class="btn" data-query="inventory.low">Materiales bajos</button></div><p class="help">Las consultas rápidas funcionan sin IA. Para conversar, conecta tu servidor privado.</p></div></div><div class="assistant-tools"><button type="button" class="btn quiet" data-ai="connection">Conexión</button><button type="button" class="btn quiet" data-ai="activity">Actividad</button><button type="button" class="btn quiet" data-ai="new">Nueva conversación</button></div><form class="assistant-compose"><label class="sr-only" for="assistant-message">Mensaje para mi asistente</label><textarea id="assistant-message" rows="2" maxlength="1500" placeholder="¿Cuánto me debe el Toyota?"></textarea><div><button type="button" class="btn assistant-mic" data-ai="mic" aria-label="Dictar mensaje" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg></button><button class="btn primary" type="submit">Enviar</button></div></form></dialog>';
  document.body.append(root);
  const panel=root.querySelector('dialog'),feed=root.querySelector('.assistant-feed'),input=root.querySelector('textarea'),status=root.querySelector('#assistant-status');
  const voice=createVoiceAdapter({onText:text=>{input.value=text;input.focus();status.textContent='Revisa el dictado y toca Enviar.';},onStatus:value=>{listening=value;root.querySelector('[data-ai="mic"]').setAttribute('aria-pressed',String(value));status.textContent=value?'Escuchando…':'A tu lado en el taller';},onError:text=>message('assistant',text)});
  function message(role,text,cards=[]){
    const item=document.createElement('article');item.className='assistant-message '+role;
    item.innerHTML='<p>'+esc(text)+'</p>'+cards.map(c=>'<section class="assistant-card"><h3>'+esc(c.title)+'</h3>'+c.rows.map(([k,v])=>'<div class="row"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('')+(c.href&&/^(order|product|employee|client)\/[\w-]+$|^monthly$/.test(c.href)?'<a class="btn quiet" href="#'+esc(c.href)+'">Ver detalle →</a>':'')+'</section>').join('');
    feed.append(item);while(feed.children.length>65)feed.children[1]?.remove();
    messages.push({role,text});messages=messages.slice(-30);feed.scrollTop=feed.scrollHeight;return item;
  }
  function invalidate(){pending=null;root.querySelectorAll('.assistant-confirm,.assistant-options').forEach(el=>el.remove());}
  async function present(intent){
    invalidate();const result=prepareIntent(await service.state(),intent,context);context={...context,...result.context};
    const item=message('assistant',result.text,result.cards);
    if(result.kind==='question'){
      draft=result.intent;if(draft.order&&/^\d+$/.test(draft.order))context.orderId=Number(draft.order);
      if(result.options.length){const box=document.createElement('div');box.className='assistant-options';for(const option of result.options){const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=option.label;b.onclick=()=>run(async()=>{message('user',option.label);await present({...result.intent,[result.field]:option.value});});box.append(b);}item.append(box);}
    }else if(result.kind==='proposal'){
      draft=null;pending=result;
      const controls=document.createElement('div');controls.className='assistant-confirm';controls.innerHTML='<p>Revisa los datos antes de guardar.</p><div><button type="button" class="btn" data-ai="cancel">Cancelar</button><button type="button" class="btn primary" data-ai="confirm">Confirmar</button></div>';item.append(controls);
    }else draft=null;
    feed.scrollTop=feed.scrollHeight;
  }
  async function run(fn){if(busy)return;busy=true;root.querySelectorAll('button:not([data-ai="close"])').forEach(b=>b.disabled=true);status.textContent='Revisando…';try{await fn();}catch(e){message('assistant',e.message);}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false);status.textContent=provider.connected?'IA conectada · cambios con confirmación':'Consultas locales · IA sin conectar';}}
  async function connection(){
    const d=await service.state(),item=message('assistant','Conecta el servidor privado del taller. El código de conexión no es una API key. Tus mensajes se envían al servidor y a OpenAI; las consultas y cálculos usan los datos de este navegador.');
    const form=document.createElement('form');form.className='assistant-connection';form.innerHTML='<label class="field"><span>Dirección del servidor</span><input name="endpoint" type="url" required placeholder="https://asistente.tutaller.com" value="'+esc(d.settings[0].assistant?.endpoint||(location.hostname.endsWith('.vercel.app')?location.origin+'/api/assistant':''))+'"></label><label class="field"><span>Código de conexión del propietario</span><input name="code" type="password" required autocomplete="off" minlength="12"></label><button class="btn primary">Conectar asistente</button>';
    form.onsubmit=e=>{e.preventDefault();const values=new FormData(form);run(async()=>{await provider.connect(values.get('endpoint'),values.get('code'));await service.assistantSettings(values.get('endpoint'));form.remove();message('assistant','Asistente conectado. Puedes escribir o dictar.');});};item.append(form);feed.scrollTop=feed.scrollHeight;
  }
  root.querySelector('.assistant-launch').onclick=()=>{previousFocus=document.activeElement;if(!messages.length){const m=location.hash.match(/^#order\/(\d+)$/);if(m)context.orderId=Number(m[1]);}panel.showModal();};
  panel.addEventListener('close',()=>{voice.stop();previousFocus?.isConnected&&previousFocus.focus();});
  root.addEventListener('click',event=>{
    if(event.target.closest('a[href]'))panel.close();
    const quick=event.target.closest('[data-query]');if(quick){run(()=>present({action:quick.dataset.query}));return;}
    const action=event.target.closest('[data-ai]')?.dataset.ai;
    if(action==='close'){panel.close();return;}
    if(action==='mic'){listening?voice.stop():voice.start();return;}
    if(action==='cancel'){invalidate();message('assistant','Cancelado. No se guardó ningún cambio.');return;}
    if(action==='new'){invalidate();context={};draft=null;messages=[];feed.querySelectorAll('.assistant-message').forEach(el=>el.remove());input.value='';return;}
    if(action==='connection'){if(!busy)connection();return;}
    if(action==='activity')run(async()=>{const d=await service.state(),items=d.events.filter(e=>e.source==='assistant').slice(-20).reverse();message('assistant',items.length?'Últimas acciones confirmadas':'Todavía no hay acciones guardadas por el asistente.',items.map(e=>({title:new Date(e.at).toLocaleString('es-DO')+' · '+e.detail,rows:e.summary||[]})));});
    if(action==='confirm'&&pending)run(async()=>{const proposal=pending,event=await service.executeAssistant(proposal);context=event.context||context;invalidate();await render();const messages={'client.create':'Cliente registrado.','vehicle.create':'Vehículo registrado.','order.create':'Orden creada correctamente. Comprobante generado.','payment.add':'Pago registrado.','work.finish':'Trabajo terminado.','work.start':'Trabajo iniciado.'};message('assistant',messages[proposal.intent.action]||'Cambio guardado correctamente.');toast('Acción del asistente guardada.');if(proposal.intent.action==='order.create'&&onOrderCreated){panel.close();await onOrderCreated(context.orderId);}});
  });
  root.querySelector('.assistant-compose').onsubmit=e=>{e.preventDefault();const text=input.value.trim();if(!text)return;run(async()=>{invalidate();const history=messages.slice(-12);message('user',text);input.value='';const intent=await provider.interpret(text,history,draft);await present(intent);});};
  globalThis.visualViewport?.addEventListener('resize',()=>{panel.style.setProperty('--assistant-height',globalThis.visualViewport.height+'px');});
  return {open:()=>root.querySelector('.assistant-launch').click(),provider};
}

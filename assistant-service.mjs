import {prepareIntent,stateFingerprint} from './assistant-core.mjs';
const allowed=new Set(['payment','cost','inventoryMove','assignWorkSelection','workSelectionState','saveClient','saveVehicle','saveOrder','addOrderWork']);
export const assistantMethods={
  async executeAssistant(proposal){
    if(!proposal||proposal.kind!=='proposal'||typeof proposal.requestId!=='string'||!Number.isFinite(proposal.createdAt))throw Error('No hay una propuesta válida para confirmar.');
    const current=await this.state(),previous=current.events.find(e=>e.source==='assistant'&&e.requestId===proposal.requestId);
    if(previous)return previous;
    if(Date.now()-proposal.createdAt>10*60*1000)throw Error('La propuesta venció. Pídemela nuevamente para revisar los datos actuales.');
    if(stateFingerprint(current)!==proposal.fingerprint)throw Error('Los datos cambiaron. Revisa una nueva propuesta antes de confirmar.');
    // Rebuild the command from the validated intent: ignore caller/model supplied commands.
    const fresh=prepareIntent(current,proposal.intent,proposal.context);
    if(fresh.kind!=='proposal')throw Error('La operación necesita revisión antes de guardarse.');
    const reducers=[],capture=Object.create(this);
    capture.change=action=>{reducers.push(action);};
    const {method,args}=fresh.command;
    if(allowed.has(method))await capture[method](...args);
    else if(method==='assistantFinishWorks')for(const id of args[0])await capture.workState(id,'Terminado');
    else if(method==='assistantNewProduct'){
      const v=args[0];await capture.saveProduct({...v,quantity:0});
      const create=reducers.pop();reducers.push(d=>{const p=create(d);this.moveInventory(d,p,{kind:'entry',quantity:v.quantity,unitCost:v.unitCost,date:v.date,note:'Compra registrada mediante asistente'});return p;});
    }else throw Error('Acción no autorizada.');
    return this.change(d=>{
      const duplicate=d.events.find(e=>e.source==='assistant'&&e.requestId===proposal.requestId);if(duplicate)return duplicate;
      if(stateFingerprint(d)!==proposal.fingerprint)throw Error('Los datos cambiaron. Revisa una nueva propuesta antes de confirmar.');
      let result;for(const reducer of reducers)result=reducer(d);
      const context={...fresh.context};
      if(fresh.intent.action==='client.create'){context.clientId=result.id;delete context.vehicleId;delete context.orderId;}
      if(fresh.intent.action==='vehicle.create'){context.clientId=result.clientId;context.vehicleId=result.id;delete context.orderId;}
      if(fresh.intent.action==='order.create'){context.orderId=result.id;context.clientId=result.clientId;context.vehicleId=result.vehicleId;}
      this.event(d,'assistant-action',context.orderId||null,fresh.text,{source:'assistant',requestId:proposal.requestId,action:fresh.intent.action,summary:fresh.cards[0].rows,context});
      return d.events.at(-1);
    });
  },
  async assistantSettings(value){
    let endpoint=String(value||'').trim();
    if(endpoint){const u=new URL(endpoint);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('El servidor del asistente debe usar HTTPS.');if(u.username||u.password||u.search||u.hash)throw Error('La dirección no debe contener credenciales ni parámetros.');endpoint=u.origin+u.pathname.replace(/\/$/,'');}
    return this.change(d=>{d.settings[0].assistant={endpoint};});
  }
};

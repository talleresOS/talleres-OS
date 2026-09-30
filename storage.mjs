import {MAIN,STORES,normalize,uid,VERSION} from './domain.mjs';
const req = r => new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done = tx => new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('No se guardaron los cambios.'));tx.onabort=()=>reject(tx.error||Error('Operación cancelada.'));});
export class Storage {
  constructor(name='talleros2',ledgerName='talleros2-ledger'){this.name=name;this.ledgerName=ledgerName;}
  async open(){
    if(this.connection)return this.connection;
    this.connection=await new Promise((resolve,reject)=>{
      const r=indexedDB.open(this.name,2);
      r.onupgradeneeded=()=>{for(const s of STORES)if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id',autoIncrement:MAIN.includes(s)});};
      r.onerror=()=>reject(r.error);
      r.onblocked=()=>globalThis.dispatchEvent?.(new Event('talleros-blocked'));
      r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();globalThis.dispatchEvent?.(new Event('talleros-versionchange'));};resolve(r.result);};
    });
    return this.connection;
  }
  async legacy(){
    if(indexedDB.databases && !(await indexedDB.databases()).some(x=>x.name===this.ledgerName))return {};
    const database=await new Promise((resolve,reject)=>{const r=indexedDB.open(this.ledgerName);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    try{
      const names=['accounts','accruals','payments','snapshots'].filter(s=>database.objectStoreNames.contains(s));
      if(!names.length)return {};
      const tx=database.transaction(names,'readonly'),completed=done(tx),out={};
      await Promise.all(names.map(async s=>{out[s]=await req(tx.objectStore(s).getAll());}));await completed;return out;
    }finally{database.close();}
  }
  async read(){
    const database=await this.open(),tx=database.transaction(STORES,'readonly'),completed=done(tx),out={};
    await Promise.all(STORES.map(async s=>{out[s]=await req(tx.objectStore(s).getAll());}));
    await completed;return out;
  }
  async transact(change){
    const database=await this.open(),tx=database.transaction(STORES,'readwrite'),completed=done(tx),d={};
    try{
      await Promise.all(STORES.map(async s=>{d[s]=await req(tx.objectStore(s).getAll());}));
      const before=Object.fromEntries(STORES.map(s=>[s,new Map(d[s].map(x=>[x.id,JSON.stringify(x)]))]));
      // Synchronous reducers keep the IDB transaction active; all writes commit or roll back together.
      const result=change(d);
      if(result?.then)throw Error('La operación debe ser sincrónica dentro de la transacción.');
      for(const s of STORES){
        const os=tx.objectStore(s),after=new Set();
        for(const item of d[s]){after.add(item.id);if(before[s].get(item.id)!==JSON.stringify(item))os.put(item);}
        for(const id of before[s].keys())if(!after.has(id))os.delete(id);
      }
      await completed;return result;
    }catch(e){try{tx.abort();}catch{}await completed.catch(()=>{});throw e;}
  }
  async migrate(){
    const legacy=await this.legacy();
    return this.transact(d=>{
      if(d.meta.some(x=>x.id==='phase2'))return false;
      const before={main:Object.fromEntries(MAIN.map(s=>[s,structuredClone(d[s])])),ledger:structuredClone(legacy)};
      d.snapshots.push({id:'before-phase2',workshopId:1,createdAt:new Date().toISOString(),reason:'Recuperación anterior a Fase 2',payload:before});
      normalize(d,legacy);
      return true;
    });
  }
  async export(){
    const d=await this.read();
    return {format:'TallerOS-backup',version:2,appVersion:VERSION,workshopId:1,exportedAt:new Date().toISOString(),main:Object.fromEntries(MAIN.map(s=>[s,d[s]])),ledger:{accounts:d.ledgerAccounts,accruals:d.ledgerAccruals,payments:d.ledgerPayments},phase2:Object.fromEntries(STORES.filter(s=>!MAIN.includes(s)&&!s.startsWith('ledger')).map(s=>[s,d[s]]))};
  }
  validate(payload){
    if(payload?.format!=='TallerOS-backup'||![1,2].includes(Number(payload.version)))throw Error('Copia de TallerOS incompatible.');
    const out={};
    for(const s of MAIN)out[s]=payload.main?.[s];
    out.ledgerAccounts=payload.ledger?.accounts;out.ledgerAccruals=payload.ledger?.accruals;out.ledgerPayments=payload.ledger?.payments;
    for(const s of STORES.filter(s=>!MAIN.includes(s)&&!s.startsWith('ledger')))out[s]=payload.version===2?payload.phase2?.[s]:[];
    for(const s of STORES){
      if(!Array.isArray(out[s]))throw Error('Falta la colección '+s+'.');
      const seen=new Set();
      for(const row of out[s]){
        if(!row||row.id===undefined||Number(row.workshopId)!==1||seen.has(row.id))throw Error('Registro inválido o repetido en '+s+'.');
        if(MAIN.includes(s)&&(!Number.isSafeInteger(row.id)||row.id<=0))throw Error('Clave inválida en '+s+'.');
        seen.add(row.id);
      }
    }
    for(const invoice of out.invoices)if(!invoice.orderId||!invoice.number)throw Error('Comprobante inválido.');
    return structuredClone(out);
  }
  async import(payload){
    const input=this.validate(payload);
    return this.transact(d=>{
      if(payload.version===1&&['invoices','inventory','inventoryMoves','monthlyClosures'].some(s=>d[s].length))throw Error('Esta copia antigua no contiene los módulos de Fase 2. Expórtalos antes y usa una instalación vacía para importar la copia antigua.');
      const before=structuredClone(Object.fromEntries(STORES.filter(s=>s!=='snapshots').map(s=>[s,d[s]])));
      const protectedSequence=Math.max(...d.settings.map(s=>Number(s.orderSequence)||0),0);
      const protectedInvoices=Math.max(...d.settings.map(s=>Number(s.invoiceSequence)||0),...d.invoices.map(i=>Number(String(i.number).match(/(\d+)$/)?.[1]||0)),0);
      const snapshots=d.snapshots;
      for(const s of STORES)if(s!=='snapshots')d[s]=input[s];
      const allSnapshots=[...snapshots,...input.snapshots];d.snapshots=[...new Map(allSnapshots.map(x=>[x.id,x])).values()];
      d.snapshots.push({id:'before-import-'+uid(),workshopId:1,createdAt:new Date().toISOString(),payload:before});
      normalize(d,{});
      const setting=d.settings.find(x=>x.workshopId===1);
      setting.orderSequence=Math.max(Number(setting.orderSequence)||0,protectedSequence,...d.orders.map(o=>Number(String(o.number).match(/(\d+)$/)?.[1]||0)));
      setting.invoiceSequence=Math.max(Number(setting.invoiceSequence)||0,protectedInvoices,...d.invoices.map(i=>Number(String(i.number).match(/(\d+)$/)?.[1]||0)));
    });
  }
  close(){this.connection?.close();this.connection=null;}
}

import {n,round,uid,today,find,belongs,paid,refreshAccounts,customerQuote} from './domain.mjs';
import {PROCESSES,WORK_STATES,catalog,workFrozen,worksFor} from './work-model.mjs';
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const text=v=>String(v??'').trim();
const amount=v=>{const x=Number(v);assert(Number.isFinite(x)&&x>=0,'Indica una tarifa válida.');return round(x);};
const at=()=>new Date().toISOString();
export const workMethods={
  async saveOrderPieces(orderId,selection,customNames=[]){
    return this.change(d=>{
      const o=this.order(d,orderId),s=d.settings[0],all=catalog(s);
      assert(Array.isArray(selection)&&Array.isArray(customNames),'Selección de piezas inválida.');
      const wanted=[...new Set(selection)];
      assert(wanted.every(id=>all.some(p=>p.id===id)),'Una pieza no pertenece al catálogo.');
      for(const raw of customNames){
        const name=text(raw);if(!name)continue;assert(name.length<=100,'Nombre de pieza demasiado largo.');
        let item=all.find(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase());
        if(!item){item={id:'custom-'+uid(),name};(s.customPieces ||= []).push(item);all.push(item);}
        if(!wanted.includes(item.id))wanted.push(item.id);
      }
      const existing=d.vehiclePieces.filter(p=>belongs(p,o.id));
      for(const p of existing){
        if(!wanted.includes(p.catalogId)&&!p.retired){
          assert(!worksFor(d,o.id).some(w=>w.selectedPieceIds.includes(p.id)),'Retira esta pieza de sus trabajos activos antes de quitarla de la orden: '+p.name);
          p.retired=true;p.retiredAt=at();
        }
      }
      for(const catalogId of wanted){
        const old=existing.find(p=>p.catalogId===catalogId);
        if(old){old.retired=false;old.retiredAt=null;}
        else this.add(d,'vehiclePieces',{orderId:o.id,catalogId,name:all.find(p=>p.id===catalogId).name,retired:false,createdAt:at()});
      }
      o.workModelVersion=3;this.syncWork(d,o);this.event(d,'pieces-selected',o.id,wanted.length+' piezas físicas activas.');
      return d.vehiclePieces.filter(p=>belongs(p,o.id)&&!p.retired);
    });
  },
  async saveWork(orderId,v,id){
    return this.change(d=>{
      const o=this.order(d,orderId),old=id?find(d,'workAssignments',id):null;
      assert(!id||old&&belongs(old,o.id),'Trabajo no encontrado en esta orden.');
      const process=text(v.process);
      assert(PROCESSES.includes(process)||old&&process===old.process,'Selecciona el proceso.');
      const selected=[...new Set(v.selectedPieceIds||[])];
      assert(selected.every(id=>d.vehiclePieces.some(p=>p.id===id&&belongs(p,o.id)&&!p.retired)),'Selecciona piezas activas de esta orden.');
      const unspecified=selected.length?0:n(old?.unspecifiedQuantity);
      assert(selected.length||unspecified>0,'Selecciona al menos una pieza.');
      const quantity=selected.length||unspecified,employeeId=v.employeeId?Number(v.employeeId):null,e=employeeId?find(d,'employees',employeeId):null;
      assert(!employeeId||e&&(e.active!==false||old?.employeeId===employeeId),'Selecciona un empleado activo.');
      const mode=v.mode==='Monto fijo'?'Monto fijo':'Por pieza',rate=amount(v.rate||0);
      assert(!employeeId||rate>0||old&&workFrozen(old),'Indica una tarifa mayor que cero para el empleado.');
      if(old&&workFrozen(old)){
        assert(employeeId===old.employeeId&&mode===old.mode&&rate===n(old.rate)&&quantity===n(old.quantity),'Este trabajo tiene costos o devengos históricos: se pueden identificar sus piezas, pero no cambiar empleado, cantidad, tarifa ni importe.');
      }
      const total=old&&workFrozen(old)?n(old.total):employeeId?round(mode==='Por pieza'?quantity*rate:rate):0;
      const fields={process,employeeId,selectedPieceIds:selected,unspecifiedQuantity:unspecified,quantity,mode,rate,total,role:e?.role||old?.role||'',notes:text(v.notes)};
      const w=old?Object.assign(old,fields,{updatedAt:at()}):this.add(d,'workAssignments',{...fields,orderId:o.id,sourceAssignmentId:uid(),status:'Pendiente',ledgerState:employeeId?'pending':'unassigned',cancelled:false,createdAt:at()});
      if(!workFrozen(w))w.ledgerState=employeeId?'pending':'unassigned';
      // Assigning an employee never finishes their process implicitly.
      if(old?.status==='Terminado'&&!workFrozen(w)){w.status='Pendiente';w.completedAt=null;}
      o.workModelVersion=3;this.syncWork(d,o);this.event(d,'work-assigned',o.id,process+' · '+quantity+' piezas · '+(e?.name||'Sin asignar'),{workId:w.id});
      return w;
    });
  },
  accrueWork(d,w,o){
    if(w.ledgerState==='legacy'||w.ledgerState==='invalid'||!w.employeeId)return;
    const existing=d.ledgerAccruals.find(a=>a.sourceAssignmentId===w.sourceAssignmentId);
    if(existing){w.ledgerState='generated';w.accrualId=existing.id;return;}
    assert(find(d,'employees',w.employeeId),'Empleado no encontrado.');
    assert(n(w.quantity)>0&&n(w.total)>=0,'Revisa la cantidad e importe del trabajo.');
    let account=d.ledgerAccounts.find(a=>Number(a.employeeId)===Number(w.employeeId)&&a.status==='ABIERTA');
    if(!account)account=this.add(d,'ledgerAccounts',{employeeId:w.employeeId,number:Math.max(0,...d.ledgerAccounts.filter(a=>Number(a.employeeId)===Number(w.employeeId)).map(a=>n(a.number)))+1,status:'ABIERTA',createdAt:at(),closedAt:null});
    const a=this.add(d,'ledgerAccruals',{accountId:account.id,sourceAssignmentId:w.sourceAssignmentId,workId:w.id,employeeId:w.employeeId,orderId:o.id,vehicleId:o.vehicleId,partId:w.legacyPartId||null,costOrigin:w.legacyPartId?'legacy-part':'assignment-v3',process:w.process,selectedPieceIds:[...w.selectedPieceIds],role:w.role,work:w.process,quantity:w.quantity,rate:w.rate,paymentMode:w.mode,total:w.total,date:today(),generatedAt:at()});
    w.ledgerState='generated';w.accrualId=a.id;
    if(w.legacyPartId&&!w.ledgerCostAlreadyCounted){
      const p=find(d,'parts',w.legacyPartId);assert(p,'Falta la pieza histórica que conserva este costo.');
      p.laborCost=round(n(p.laborCost)+n(w.total));
    }
    refreshAccounts(d);
  },
  async workState(id,status){
    return this.change(d=>{
      const w=find(d,'workAssignments',id);assert(w&&!w.cancelled,'Restaura primero este trabajo.');const o=this.order(d,w.orderId);
      assert(WORK_STATES.includes(status),'Estado de trabajo inválido.');
      if(w.status===status)return w;
      if(status==='Terminado'){
        assert(w.employeeId||w.migrated,'Asigna el empleado antes de terminar este trabajo.');
        assert(w.ledgerState!=='invalid','Revisa la asignación histórica antes de terminarla.');
        this.accrueWork(d,w,o);w.completedAt ||= at();
      }
      w.status=status;this.syncWork(d,o);
      this.event(d,'work-state',o.id,w.process+': '+status,{workId:w.id});return w;
    });
  },
  async cancelWork(id,restore=false){
    return this.change(d=>{
      const w=find(d,'workAssignments',id);assert(w,'Trabajo no encontrado.');const o=this.order(d,w.orderId);
      if(restore)assert(w.selectedPieceIds.every(id=>d.vehiclePieces.some(p=>p.id===id&&!p.retired)),'Restaura sus piezas en la orden antes de restaurar el trabajo.');
      if(w.cancelled===!restore)return;
      w.cancelled=!restore;w[restore?'restoredAt':'cancelledAt']=at();
      this.syncWork(d,o);this.event(d,'work-cancel',o.id,(restore?'Restaurado: ':'Retirado: ')+w.process+'. Los devengos y pagos se conservan.',{workId:w.id});
    });
  },
  recordPrice(d,o,total,reason){
    if(n(o.total)===n(total))return;
    (o.priceHistory ||= []).push({id:uid(),from:n(o.total),to:n(total),at:at(),reason,previousAgreement:structuredClone(o.agreement||null)});
    o.agreementStale=!!o.agreement;o.total=total;
  },
  async createQuote(orderId,conditions,price){
    return this.change(d=>{
      const o=this.order(d,orderId),s=d.settings[0];
      s.quoteSequence=Math.max(n(s.quoteSequence),...d.quotations.map(q=>Number(String(q.number).match(/(\d+)$/)?.[1]||0)))+1;
      const prefix=text(s.prefix||'ORD').toUpperCase().replace(/[^A-Z0-9-]/g,'')||'ORD';
      const q=customerQuote(d,{...o,total:price===undefined?o.total:amount(price)},prefix+'-COT-'+String(s.quoteSequence).padStart(6,'0'),conditions??s.quoteConditions);
      d.quotations.push(q);this.event(d,'quote-created',o.id,'Cotización '+q.number+' · '+q.total);return q;
    });
  },
  async confirmQuote(id){
    return this.change(d=>{
      const q=find(d,'quotations',id);assert(q,'Cotización no encontrada.');const o=this.order(d,q.orderId);
      if(o.agreement?.quoteId===q.id)return q;
      assert(!q.confirmedAt,'Esta cotización ya tuvo una confirmación. Genera una versión nueva para cambiar el acuerdo.');
      assert(q.total>=paid(d,o.id),'La cotización es menor que lo ya cobrado. Genera una versión actualizada.');
      this.recordPrice(d,o,q.total,'Confirmación '+q.number);
      q.confirmedAt=at();
      (o.agreementHistory ||= []).push({quoteId:q.id,quoteNumber:q.number,price:q.total,confirmedAt:q.confirmedAt,warranty:structuredClone(q.warranty),conditions:q.conditions});
      o.agreement=structuredClone(o.agreementHistory.at(-1));o.warranty=structuredClone(q.warranty);o.agreementStale=false;
      this.event(d,'price-agreed',o.id,'Precio confirmado: '+q.total+' · '+q.number);return q;
    });
  }
};

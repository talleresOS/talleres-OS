import {resolveWarranty,normalizeWarranty,parseDuration,deliveryWarranty,documentPresentation} from './document-policy.mjs';
import {Storage} from './storage.mjs';
import {assistantMethods} from './assistant-service.mjs';
import {workMethods} from './work-service.mjs';
import {catalog,worksFor,PROCESSES} from './work-model.mjs';
import {customerReception} from './domain.mjs';
import {STORES,MAIN,n,round,sum,uid,today,validDate,find,belongs,active,closed,cancelled,trashed,finished,balance,paid,financial,customerInvoice,refreshAccounts,monthly,suffix,METHODS,STAGES,audit} from './domain.mjs';
const assert=(test,message)=>{if(!test)throw Error(message);};
const amount=(value,zero=false)=>{const v=Number(value);assert(Number.isFinite(v)&&(zero?v>=0:v>0),'Indica un monto válido.');return round(v);};
const text=(v)=>String(v||'').trim();
export class TallerService {
  constructor(storage=new Storage()){this.storage=storage;}
  async init(){await this.storage.open();await this.storage.migrate();return this.state();}
  async state(){const d=await this.storage.read();return Object.fromEntries(STORES.map(s=>[s,d[s].filter(x=>Number(x.workshopId)===1)]));}
  async change(action){
    return this.storage.transact(all=>{
      const d=Object.fromEntries(STORES.map(s=>[s,all[s].filter(x=>Number(x.workshopId)===1)]));
      let counters=find(d,'meta','counters');
      if(!counters){counters={id:'counters',workshopId:1};d.meta.push(counters);}
      for(const s of MAIN)counters[s]=Math.max(n(counters[s]),...all[s].map(x=>typeof x.id==='number'?x.id:0),0);
      const result=action(d);
      for(const s of STORES)all[s]=[...all[s].filter(x=>Number(x.workshopId)!==1),...d[s]];
      return result;
    });
  }
  add(d,store,row){
    const counter=find(d,'meta','counters');
    const id=MAIN.includes(store)?++counter[store]:uid();
    const item={...row,id,workshopId:1};d[store].push(item);return item;
  }
  event(d,type,orderId,detail,extra={}){this.add(d,'events',{type,orderId,detail,at:new Date().toISOString(),...extra});}
  order(d,id,edit=true){const o=find(d,'orders',id);assert(o,'No se encontró la orden.');if(edit)assert(active(o),'La orden está cerrada, cancelada o archivada. Debes reabrirla antes de modificarla.');return o;}
  date(value){assert(validDate(value),'Selecciona una fecha válida.');return value;}
  async saveClient(v,id){
    return this.change(d=>{
      assert(text(v.name)&&text(v.phone),'Nombre y teléfono son obligatorios.');
      const fields={name:text(v.name),phone:text(v.phone),whatsapp:text(v.whatsapp),document:text(v.document),address:text(v.address),notes:text(v.notes)};
      if(v.email!==undefined)fields.email=text(v.email);
      const old=id?find(d,'clients',id):null;assert(!id||old,'Cliente no encontrado.');
      return old?Object.assign(old,fields):this.add(d,'clients',fields);
    });
  }
  async saveVehicle(v,id){
    return this.change(d=>{
      const client=find(d,'clients',v.clientId);assert(client&&!client.archived,'Selecciona un cliente activo.');
      assert(text(v.brand)&&text(v.model),'Marca y modelo son obligatorios.');
      const old=id?find(d,'vehicles',id):null;assert(!id||old,'Vehículo no encontrado.');
      if(old&&d.orders.some(o=>Number(o.vehicleId)===Number(id)))assert(Number(v.clientId)===Number(old.clientId),'Un vehículo con historial debe conservar su propietario.');
      const fields={clientId:Number(v.clientId),brand:text(v.brand),model:text(v.model),year:text(v.year),plate:text(v.plate),color:text(v.color),vin:text(v.vin),notes:text(v.notes)};
      return old?Object.assign(old,fields):this.add(d,'vehicles',fields);
    });
  }
  async saveEmployee(v,id){
    return this.change(d=>{
      assert(text(v.name),'Indica el nombre del empleado.');
      const old=id?find(d,'employees',id):null;assert(!id||old,'Empleado no encontrado.');
      const fields={name:text(v.name),phone:text(v.phone),role:text(v.role)||'Otro',pieceRate:amount(v.pieceRate||0,true),fixedPay:amount(v.fixedPay||0,true),active:v.active!=='false'&&v.active!==false};
      const setting=d.settings[0];setting.customRoles=[...new Set([...(setting.customRoles||[]),fields.role])];
      return old?Object.assign(old,fields):this.add(d,'employees',fields);
    });
  }
  async saveOrder(v,id){
    return this.change(d=>{
      if(!id&&v.creationToken){const existing=d.orders.find(o=>o.creationToken===v.creationToken);if(existing)return existing;}
      const client=find(d,'clients',v.clientId),vehicle=find(d,'vehicles',v.vehicleId);
      assert(client&&vehicle&&Number(vehicle.clientId)===Number(client.id),'Selecciona un cliente y su vehículo.');
      assert(!client.archived&&!vehicle.archived||!!id,'El cliente o vehículo está archivado.');
      const old=id?this.order(d,id):null;
      const total=amount(v.total||0,true);if(old)assert(total>=paid(d,old.id),'El precio no puede ser menor que lo ya cobrado.');
      const fields={clientId:Number(v.clientId),vehicleId:Number(v.vehicleId),entryDate:this.date(v.entryDate),dueDate:v.dueDate?this.date(v.dueDate):'',total,notes:text(v.notes),customerNotes:text(v.customerNotes)};
      for(const key of ['workConditions','receptionNotes'])if(v[key]!==undefined)fields[key]=text(v[key]);
      if(v.createReception)assert(fields.dueDate,'Selecciona la fecha estimada de entrega.');
      if(fields.dueDate&&(!old||fields.dueDate!==old.dueDate||fields.entryDate!==old.entryDate))assert(fields.dueDate>=fields.entryDate,'La entrega prevista no puede ser anterior a la recepción.');
      if(old){this.recordPrice(d,old,total,'Edición del precio de la orden');Object.assign(old,fields);this.event(d,'order-edited',old.id,'Datos de la orden actualizados.');return old;}
      const s=d.settings[0],sequence=Math.max(n(s.orderSequence),...d.orders.map(o=>suffix(o.number)))+1;
      assert(Number.isSafeInteger(sequence),'No se pudo reservar el número de orden.');
      s.orderSequence=sequence;
      const prefix=text(s.prefix||'REV').toUpperCase().replace(/[^A-Z0-9-]/g,'')||'REV';
      const row=this.add(d,'orders',{...fields,workModelVersion:3,priceHistory:[],agreementHistory:[],number:prefix+'-'+String(sequence).padStart(4,'0'),status:'Activa',lifecycle:'active',createdAt:new Date().toISOString()});
      if(v.creationToken)row.creationToken=text(v.creationToken);
      if(v.createReception){
        assert(Array.isArray(v.receptionPieces),'Revisa las piezas y procesos.');
        this.addReceptionWorks(d,row,v.receptionPieces);
        const initial=amount(v.initialAmount||0,true);assert(initial<=total,'El abono inicial supera el precio acordado.');
        if(initial){
          assert(METHODS.includes(v.initialMethod),'Selecciona el método del abono.');
          const payment=this.add(d,'payments',{orderId:row.id,amount:initial,date:this.date(v.initialDate||fields.entryDate),method:v.initialMethod,note:'Abono inicial',kind:'initial',voided:false,createdAt:row.createdAt});
          row.initialPaymentId=payment.id;this.event(d,'client-payment',row.id,'Abono inicial: '+initial,{paymentId:payment.id});
        }
        row.initialReceipt=customerReception(d,row);
      }
      this.event(d,'order-created',row.id,'Orden creada.');return row;
    });
  }
  syncWork(d,o){
    if(finished(d,o)){o.lifecycle='finished';o.workCompletedAt ||= new Date().toISOString();}
    else {o.lifecycle='production';o.workCompletedAt=null;}
  }
  finalize(d,p,o){
    if(p.status!=='Terminada')return;
    p.completedAt ||= new Date().toISOString();
    for(const a of p.laborAssignments||[]){
      if(a.ledgerState==='legacy'||a.ledgerState==='invalid')continue;
      const existing=d.ledgerAccruals.find(x=>x.sourceAssignmentId===a.sourceAssignmentId);
      if(existing){a.ledgerState='generated';a.accrualId=existing.id;continue;}
      assert(find(d,'employees',a.employeeId),'La asignación referencia un empleado no encontrado.');
      assert(n(a.quantity)>0&&n(a.total)>=0,'La asignación de mano de obra no es válida.');
      let account=d.ledgerAccounts.find(x=>Number(x.employeeId)===Number(a.employeeId)&&x.status==='ABIERTA');
      if(!account)account=this.add(d,'ledgerAccounts',{employeeId:Number(a.employeeId),number:Math.max(0,...d.ledgerAccounts.filter(x=>Number(x.employeeId)===Number(a.employeeId)).map(x=>n(x.number)))+1,status:'ABIERTA',createdAt:new Date().toISOString(),closedAt:null});
      const accrual=this.add(d,'ledgerAccruals',{accountId:account.id,sourceAssignmentId:a.sourceAssignmentId,employeeId:Number(a.employeeId),orderId:o.id,vehicleId:o.vehicleId,partId:p.id,role:a.role,work:a.work||p.description,quantity:n(a.quantity),rate:n(a.rate),paymentMode:a.mode,total:n(a.total),date:today(),generatedAt:new Date().toISOString()});
      a.ledgerState='generated';a.accrualId=accrual.id;a.generatedAt=accrual.generatedAt;
      if(!a.ledgerCostAlreadyCounted)p.laborCost=round(n(p.laborCost)+n(a.total));
    }
    refreshAccounts(d);
  }
  async savePart(v,id){
    return this.change(d=>{
      const old=id?find(d,'parts',id):null;assert(!id||old,'Pieza no encontrada.');
      const o=this.order(d,old?.orderId||v.orderId);assert(!old?.archived,'Restaura esta pieza antes de editarla.');
      assert(text(v.description),'Describe la pieza o trabajo.');assert(STAGES.includes(v.status),'Selecciona un proceso válido.');
      const fields={description:text(v.description),status:v.status,price:amount(v.price||0,true),employeeId:v.employeeId?Number(v.employeeId):null};
      if(fields.employeeId)assert(find(d,'employees',fields.employeeId),'Empleado no encontrado.');
      const p=old?Object.assign(old,fields):this.add(d,'parts',{...fields,orderId:o.id,materialCost:0,laborCost:0,otherCost:0,laborAssignments:[]});
      this.finalize(d,p,o);this.syncWork(d,o);this.event(d,'part-updated',o.id,p.description+' · '+p.status,{partId:p.id});return p;
    });
  }
  async assign(partId,v){
    return this.change(d=>{
      const p=find(d,'parts',partId);assert(p&&!p.archived,'Pieza no disponible.');const o=this.order(d,p.orderId);
      const e=find(d,'employees',v.employeeId);assert(e&&e.active!==false,'Selecciona un empleado activo.');
      assert(!(p.laborAssignments||[]).some(a=>Number(a.employeeId)===Number(e.id)&&a.ledgerState!=='invalid'),'El empleado ya está asignado a esta pieza.');
      const quantity=amount(v.quantity),rate=amount(v.rate),mode=v.mode==='Monto fijo'?'Monto fijo':'Por pieza';
      (p.laborAssignments ||= []).push({sourceAssignmentId:uid(),employeeId:e.id,role:e.role,quantity,rate,mode,total:round(mode==='Por pieza'?quantity*rate:rate),work:text(v.work)||p.description,date:today(),ledgerState:'pending'});
      this.finalize(d,p,o);this.event(d,'assignment',o.id,e.name+' asignado a '+p.description,{partId:p.id});
    });
  }
  async finishPart(id){
    return this.change(d=>{
      const p=find(d,'parts',id);assert(p&&!p.archived,'Pieza no disponible.');const o=this.order(d,p.orderId);
      if(p.status==='Terminada')return p;
      p.status='Terminada';this.finalize(d,p,o);this.syncWork(d,o);this.event(d,'part-finished',o.id,p.description+' terminada. Mano de obra devengada, pendiente de pago.',{partId:p.id});return p;
    });
  }
  async markFinished(id){
    return this.change(d=>{const o=this.order(d,id);assert(worksFor(d,id).every(w=>w.status==='Terminado')&&d.parts.filter(p=>belongs(p,id)&&!p.archived&&!d.workAssignments.some(w=>w.legacyPartId===p.id)).every(p=>p.status==='Terminada'),'Todavía hay trabajos pendientes.');o.lifecycle='finished';o.workCompletedAt ||= new Date().toISOString();this.event(d,'work-finished',o.id,'Trabajo terminado; la entrega sigue pendiente.');});
  }
  async payment(orderId,v,id){
    return this.change(d=>{
      const o=this.order(d,orderId),old=id?find(d,'payments',id):null;
      assert(!id||old&&belongs(old,o.id),'Pago no encontrado en esta orden.');
      const received=amount(v.amount),other=sum(d.payments.filter(x=>belongs(x,o.id)&&!x.voided&&x.id!==old?.id),x=>x.amount);
      assert(round(other+received)<=n(o.total),'El pago supera el saldo pendiente.');
      assert(METHODS.includes(v.method),'Selecciona un método de pago.');
      const fields={orderId:o.id,amount:received,date:this.date(v.date),method:v.method,note:text(v.note),voided:false};
      const p=old?Object.assign(old,fields,{updatedAt:new Date().toISOString()}):this.add(d,'payments',{...fields,createdAt:new Date().toISOString()});
      this.event(d,'client-payment',o.id,(old?'Cobro corregido':'Cobro registrado')+': '+received+' · '+v.method,{paymentId:p.id});return p;
    });
  }
  async cost(orderId,v,id){
    return this.change(d=>{
      const o=this.order(d,orderId),old=id?find(d,'costs',id):null;
      assert(!id||old&&belongs(old,o.id),'Costo no encontrado.');
      assert(['Materiales','Otros costos',...(old?.type==='Mano de obra'?['Mano de obra']:[])].includes(v.type),'La mano de obra nueva se genera desde las piezas.');
      assert(text(v.description),'Describe el costo.');
      const fields={orderId:o.id,type:v.type,description:text(v.description),amount:amount(v.amount),quantity:amount(v.quantity||1),date:this.date(v.date),voided:false};
      const c=old?Object.assign(old,fields):this.add(d,'costs',fields);
      this.event(d,'cost',o.id,'Costo registrado: '+fields.description,{costId:c.id});return c;
    });
  }
  async voidMovement(store,id,restore=false){
    assert(['payments','costs','ledgerPayments'].includes(store),'Movimiento inválido.');
    return this.change(d=>{
      const p=find(d,store,id);assert(p,'Movimiento no encontrado.');
      if(store==='ledgerPayments'){
        const account=find(d,'ledgerAccounts',p.accountId);assert(account&&account.status!=='CERRADA','La cuenta está cerrada.');
        p.voided=!restore;refreshAccounts(d);
      }else{
        const o=this.order(d,p.orderId);
        if(restore&&store==='payments')assert(round(paid(d,o.id)+n(p.amount))<=n(o.total),'Restaurar este abono superaría el precio.');
        p.voided=!restore;this.event(d,'movement-void',o.id,(restore?'Restaurado':'Anulado')+' '+(store==='payments'?'cobro':'costo'),{recordId:p.id});
      }
      p[restore?'restoredAt':'voidedAt']=new Date().toISOString();
    });
  }
  async closeOrder(id,details){
    return this.change(d=>{
      const existing=this.order(d,id,false);
      if(closed(existing))return find(d,'invoices',existing.invoiceId);
      const o=this.order(d,id);
      assert(finished(d,o),'Termina los trabajos antes de entregar.');
      assert(balance(d,o)===0,'Todavía hay saldo pendiente.');
      assert(!o.agreementStale,'Confirma una nueva cotización con el precio actual antes de entregar.');
      assert(paid(d,o.id)<=n(o.total)+0.005,'Revisa el exceso de pago antes de cerrar.');
      o.warranty=resolveWarranty(d.settings[0],o);
      if(details){
        assert(['yes','no'].includes(details.hasWarranty),'Indica si el trabajo tiene garantía.');
        const has=details.hasWarranty==='yes';
        if(has){
          assert(text(details.warrantyDuration),'Indica la duración de la garantía.');
          const start=details.warrantyStart?this.date(details.warrantyStart):today(),end=details.warrantyEnd?this.date(details.warrantyEnd):'';
          if(end)assert(end>=start,'El vencimiento no puede ser anterior al inicio.');
          const duration=parseDuration(details.warrantyDuration,details.warrantyUnit||'months');
          assert(duration||end,'Indica el vencimiento de la garantía personalizada.');
          o.warranty=normalizeWarranty({kind:'custom',label:text(details.warrantyDuration),...duration,startDate:start,endDate:end,conditions:text(details.warrantyConditions)});
        }else o.warranty={kind:'none'};
        o.customerNotes=text(details.finalNotes);o.warrantyReviewedAt=new Date().toISOString();
      }
      o.warranty=deliveryWarranty(o.warranty,today());
      if(o.warranty.kind!=='none')assert(o.warranty.endDate,'Revisa el vencimiento de la garantía personalizada antes de entregar.');
      if(o.warranty.kind!=='none'&&o.warranty.endDate)assert(o.warranty.endDate>=today(),'El vencimiento no puede ser anterior a la entrega.');
      const at=new Date().toISOString(),setting=d.settings[0];
      setting.invoiceSequence=n(setting.invoiceSequence)+1;
      const invoice=customerInvoice(d,o,(text(setting.prefix||'ORD').toUpperCase().replace(/[^A-Z0-9-]/g,'')||'ORD')+'-C-'+String(setting.invoiceSequence).padStart(6,'0'),at);
      d.invoices.push(invoice);o.lifecycle='closed';o.status='Cerrada / Entregada';o.closedAt=at;o.invoiceId=invoice.id;o.deliveryDate=today();o.closureFinancial=financial(d,o);
      this.event(d,'order-closed',o.id,'Orden finalizada y entregada. Comprobante '+invoice.number);return invoice;
    });
  }
  async reopen(id){
    return this.change(d=>{
      const o=this.order(d,id,false);assert(closed(o)||cancelled(o)||o.archived,'La orden ya está activa.');
      this.event(d,'order-reopened',o.id,'Orden reabierta. El comprobante anterior queda conservado.',{previousClosedAt:o.closedAt,previousInvoiceId:o.invoiceId});
      const invoice=find(d,'invoices',o.invoiceId);if(invoice)invoice.supersededAt=new Date().toISOString();
      o.reopenedAt=new Date().toISOString();o.lifecycle='active';o.status='Activa';o.closedAt=null;o.archived=false;o.invoiceId=null;this.syncWork(d,o);
    });
  }
  async cancel(id){return this.change(d=>{const o=this.order(d,id);o.lifecycle='cancelled';o.status='Cancelada';o.cancelledAt=new Date().toISOString();this.event(d,'order-cancelled',o.id,'Orden cancelada. Cobros y costos conservados.');});}
  async trash(id){
    return this.change(d=>{
      const o=this.order(d,id);
      assert(!d.payments.some(x=>belongs(x,id))&&!d.costs.some(x=>belongs(x,id))&&!d.parts.some(x=>belongs(x,id))&&!d.invoices.some(x=>belongs(x,id))&&!d.workAssignments.some(x=>belongs(x,id))&&!d.vehiclePieces.some(x=>belongs(x,id))&&!d.quotations.some(x=>belongs(x,id)),'Esta orden tiene historial. Puedes cancelarla para conservarlo.');
      o.deleted=true;o.deletedAt=new Date().toISOString();o.deletedPreviousStatus=o.status;this.event(d,'order-trashed',o.id,'Orden vacía enviada a papelera.');
    });
  }
  async restoreOrder(id){return this.change(d=>{const o=this.order(d,id,false);assert(trashed(o),'La orden no está en papelera.');o.deleted=false;o.deletedAt=null;o.status=o.deletedPreviousStatus||o.status;this.event(d,'order-restored',o.id,'Orden restaurada de papelera.');});}
  async archive(store,id,restore=false){
    assert(['clients','vehicles','parts'].includes(store),'Registro inválido.');
    return this.change(d=>{const row=find(d,store,id);assert(row,'Registro no encontrado.');if(store==='parts'){const o=this.order(d,row.orderId);row.archived=!restore;this.syncWork(d,o);this.event(d,'part-archive',o.id,(restore?'Restaurada':'Archivada')+': '+row.description);}else row.archived=!restore;});
  }
  async employeePayment(accountId,v,id){
    return this.change(d=>{
      refreshAccounts(d);const account=find(d,'ledgerAccounts',accountId);assert(account&&account.status!=='CERRADA','Cuenta no disponible.');
      const old=id?find(d,'ledgerPayments',id):null;assert(!id||old?.accountId===account.id,'Pago no encontrado.');
      const value=amount(v.amount),other=sum(d.ledgerPayments.filter(p=>p.accountId===accountId&&!p.voided&&p.id!==old?.id),p=>p.amount);
      assert(round(other+value)<=account.generated,'El pago supera el saldo del empleado.');
      const fields={accountId,employeeId:account.employeeId,amount:value,date:this.date(v.date),method:METHODS.includes(v.method)?v.method:'Efectivo',note:text(v.note),voided:false};
      // Allocate only the portion that can be established from persisted payment allocations.
      const accruals=d.ledgerAccruals.filter(a=>a.accountId===accountId);
      let remaining=value,legacyUnallocated=sum(d.ledgerPayments.filter(p=>p.accountId===accountId&&!p.voided&&p.id!==old?.id&&!p.allocations),p=>p.amount);
      fields.allocations=[];
      for(const a of accruals){
        const allocated=sum(d.ledgerPayments.filter(p=>p.accountId===accountId&&!p.voided&&p.id!==old?.id).flatMap(p=>p.allocations||[]).filter(x=>x.accrualId===a.id),x=>x.amount);
        let available=Math.max(0,round(n(a.total)-allocated));
        const legacyUsed=Math.min(available,legacyUnallocated);available-=legacyUsed;legacyUnallocated-=legacyUsed;
        const applied=Math.min(available,remaining);
        if(applied>0){fields.allocations.push({accrualId:a.id,orderId:a.orderId,amount:applied});remaining=round(remaining-applied);}
      }
      if(old)Object.assign(old,fields,{updatedAt:new Date().toISOString()});else this.add(d,'ledgerPayments',{...fields,createdAt:new Date().toISOString()});
      refreshAccounts(d);this.event(d,'employee-payment',null,'Pago a empleado '+account.employeeId+': '+value,{employeeId:account.employeeId});
    });
  }
  async closeAccount(id){return this.change(d=>{refreshAccounts(d);const a=find(d,'ledgerAccounts',id);assert(a&&a.status==='PAGADA'&&a.balance===0,'La cuenta debe estar pagada.');a.status='CERRADA';a.closedAt=new Date().toISOString();});}
  async saveProduct(v,id){
    return this.change(d=>{
      assert(text(v.name),'Indica el producto.');assert(text(v.unit),'Indica la unidad.');
      const old=id?find(d,'inventory',id):null;assert(!id||old,'Producto no encontrado.');
      const fields={name:text(v.name),category:text(v.category)||'Otros',unit:text(v.unit),unitCost:amount(v.unitCost||0,true),minimum:amount(v.minimum||0,true),supplier:text(v.supplier),notes:text(v.notes)};
      if(old){assert(n(old.quantity)===0||fields.unitCost===n(old.unitCost),'El costo cambia mediante una entrada de inventario para conservar su valoración.');return Object.assign(old,fields);}
      const p=this.add(d,'inventory',{...fields,quantity:0,lastPurchaseDate:null});
      const initial=amount(v.quantity||0,true);
      if(initial)this.moveInventory(d,p,{kind:'adjustment',quantity:initial,date:this.date(v.date||today()),note:'Existencia inicial',unitCost:fields.unitCost});
      return p;
    });
  }
  moveInventory(d,p,v){
    assert(['entry','exit','adjustment'].includes(v.kind),'Movimiento inválido.');
    const input=amount(v.quantity,v.kind==='adjustment'),before=n(p.quantity);
    const delta=v.kind==='adjustment'?round(input-before):v.kind==='exit'?-input:input;
    assert(round(before+delta)>=0,'No hay suficiente inventario.');
    const unitCost=v.kind==='entry'?amount(v.unitCost,true):n(p.unitCost);
    if(v.kind==='entry'){
      p.unitCost=round((before*n(p.unitCost)+input*unitCost)/(before+input));p.lastPurchaseDate=v.date;
    }
    p.quantity=round(before+delta);
    this.add(d,'inventoryMoves',{productId:p.id,kind:v.kind,quantity:Math.abs(delta),delta,before,after:p.quantity,unitCost,value:round(Math.abs(delta)*unitCost),date:this.date(v.date),note:text(v.note),orderId:null,createdAt:new Date().toISOString()});
  }
  async inventoryMove(id,v){return this.change(d=>{const p=find(d,'inventory',id);assert(p,'Producto no encontrado.');this.moveInventory(d,p,v);});}
  async closeMonth(month){
    assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(month),'Mes inválido.');
    assert(month<today().slice(0,7),'Solo puedes cerrar un mes que ya terminó.');
    return this.change(d=>{
      const existing=d.monthlyClosures.find(x=>x.month===month);if(existing)return existing;
      const metrics=monthly(d,month);
      return this.add(d,'monthlyClosures',{month,closedAt:new Date().toISOString(),metrics,source:structuredClone(Object.fromEntries(['orders','parts','vehiclePieces','workAssignments','payments','costs','ledgerAccruals','ledgerPayments','inventoryMoves','quotations'].map(s=>[s,d[s]])))});
    });
  }
  async settings(v){
    return this.change(d=>{const s=d.settings[0];for(const key of ['name','phone','whatsapp','email','address','document','prefix'])if(v[key]!==undefined)s[key]=text(v[key]);if(v.logoData!==undefined)s.logoData=v.logoData;if(v.painterRate!==undefined)s.painterRate=amount(v.painterRate||0,true);
      if(v.instagram!==undefined){const value=text(v.instagram);assert(!value||/^@?[a-zA-Z0-9._]{1,30}$/.test(value)||/^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?$/.test(value),'Indica el usuario de Instagram o su URL https.');s.instagram=value;}
      if(v.website!==undefined){const value=text(v.website);let valid=!value;try{const url=new URL(value);valid=['http:','https:'].includes(url.protocol)&&!url.username&&!url.password;}catch{}assert(valid,'Indica una página web válida con https://.');s.website=value;}
      if(v.appearance!==undefined){
        const a=v.appearance;
        assert(a&&['dark','light'].includes(a.theme),'Selecciona un tema válido.');
        assert(/^#[0-9a-f]{6}$/i.test(a.primary)&&/^#[0-9a-f]{6}$/i.test(a.accent),'Selecciona colores válidos.');
        s.appearance={...s.appearance,theme:a.theme,primary:a.primary.toLowerCase(),accent:a.accent.toLowerCase(),mode:a.mode==='auto'?'auto':'manual'};
      }

      if(v.palette!==undefined){
        assert(Array.isArray(v.palette)&&v.palette.length<=5&&v.palette.every(x=>/^#[0-9a-f]{6}$/i.test(x)),'Paleta inválida.');
        s.palette=v.palette;s.paletteLogo=v.paletteLogo||null;
      }
      if(v.fullCarPieceIds!==undefined){
        assert(Array.isArray(v.fullCarPieceIds)&&v.fullCarPieceIds.length>0&&v.fullCarPieceIds.every(id=>catalog(s).some(p=>p.id===id)),'Selecciona las piezas de carro completo.');
        s.fullCarPieceIds=[...new Set(v.fullCarPieceIds)];
      }
      if(v.warranty!==undefined){
        const w=v.warranty;assert(w&&['none','months','custom'].includes(w.kind),'Garantía inválida.');
        if(w.kind==='months')assert([3,6,12].includes(Number(w.months)),'Duración de garantía inválida.');
        if(w.kind==='custom')assert(text(w.label),'Describe la garantía personalizada.');
        s.warranty={kind:w.kind,months:w.kind==='months'?Number(w.months):null,label:w.kind==='custom'?text(w.label):'',conditions:text(w.conditions)};
      }
      if(v.documents!==undefined){
        assert(v.documents&&['classic','modern','compact'].includes(v.documents.style),'Estilo de documento inválido.');
        assert(['workshop','custom'].includes(v.documents.colorMode)&&/^#[a-f0-9]{6}$/i.test(v.documents.color||''),'Color de documento inválido.');
        s.documents={...s.documents,...documentPresentation(v.documents)};
      }
      if(v.quoteConditions!==undefined)s.quoteConditions=text(v.quoteConditions);
    });
  }
}
Object.assign(TallerService.prototype,workMethods);
Object.assign(TallerService.prototype,assistantMethods);

import {active,trashed,cancelled,find,financial,employeeSummary,monthly,sum,today,validDate,round,METHODS,uid} from './domain.mjs';
import {worksFor,piecesFor,PROCESSES,workFrozen,PIECE_CATALOG,expandReceptionPieces} from './work-model.mjs';
import {validateIntent} from './assistant-contract.mjs';
export const money=n=>'RD$'+Number(n||0).toLocaleString('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2});
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bbonete\b/g,'capo').replace(/\blij[ao]s?\b/g,'lija').replace(/[^a-z0-9]+/g,' ').trim();
const match=(s,q)=>norm(q).split(' ').filter(Boolean).every(w=>norm(s).split(' ').some(token=>/^\d+$/.test(w)?token===w:token.startsWith(w)));
const label=(d,o)=>{const v=find(d,'vehicles',o.vehicleId)||{};return [v.brand,v.model,v.plate,o.number].filter(Boolean).join(' · ');};
const answer=(text,cards=[],context={})=>({kind:'answer',text,cards,context});
const card=(title,rows,href)=>({title,rows,href});
const ask=(intent,text,field,options=[])=>({kind:'question',text,intent,field,options});
const requireValue=(i,field,text)=>i[field]===null?ask(i,text,field):null;
const fingerprintStores=['orders','clients','vehicles','payments','costs','employees','workAssignments','vehiclePieces','inventory','inventoryMoves','ledgerAccounts','ledgerAccruals','ledgerPayments','settings'];
export const stateFingerprint=d=>JSON.stringify(fingerprintStores.map(k=>d[k]));
function choose(i,field,rows,name,prompt){
  const q=i[field],exact=q?rows.filter(r=>String(r.id)===q||norm(name(r))===norm(q)):[];
  const matches=exact.length?exact:q?rows.filter(r=>match(name(r),q)):rows;
  if(matches.length===1&&(q||rows.length===1))return matches[0];
  return ask(i,matches.length?prompt:'No encontré ese registro. '+prompt,field,matches.slice(0,12).map(r=>({label:name(r),value:String(r.id)})));
}
export function prepareIntent(d,raw,context={}){
  const i=validateIntent(raw),now=today();
  if(i.action==='clarify')return ask(i,i.question||'¿Qué necesitas consultar o registrar?','question');
  if(['client.create','vehicle.create','order.create'].includes(i.action))return prepareIntake(d,i,context);
  if(i.action==='reports.receivables')return answer('Cuentas por cobrar',[card('Pendiente por cobrar',[['Balance',money(sum(d.orders.filter(o=>!trashed(o)&&!cancelled(o)),o=>financial(d,o).balance))]])]);
  if(i.action==='reports.month'){
    const month=i.month||now.slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return ask(i,'¿Qué mes quieres consultar?','month');
    const m=monthly(d,month);return answer('Venta y cobro son conceptos distintos. Venta según fecha de entrada; cobros según los pagos registrados.',[card(month,[['Venta acordada',money(m.sold)],['Cobrado',money(m.cash)],['Por cobrar al cierre del mes',money(m.receivables)],['Costos registrados',money(m.costs)],['Resultado',money(m.profit)]],'monthly')]);
  }
  if(i.action==='inventory.low'||i.action==='inventory.list'){
    const rows=d.inventory.filter(p=>(i.action!=='inventory.low'||Number(p.quantity)<=Number(p.minimum))&&(!i.product||String(p.id)===i.product||match(p.name,i.product)));
    return answer(rows.length?(i.action==='inventory.low'?'Materiales en mínimo o por debajo del mínimo.':'Inventario registrado: '+rows.length):'No hay materiales que coincidan con la consulta.',rows.map(p=>card(p.name,[['Disponible',p.quantity+' '+p.unit],['Mínimo',p.minimum],['Costo unitario',money(p.unitCost)]],'product/'+p.id)));
  }
  if(i.action==='orders.list'||i.action==='work.list'&&!i.order&&!context.orderId){
    let orders=d.orders.filter(active);
    const filter=i.filter||'pending';
    const end=new Date(now+'T12:00:00');end.setDate(end.getDate()+(7-end.getDay())%7);
    if(filter==='overdue')orders=orders.filter(o=>o.dueDate&&o.dueDate<now);
    if(filter==='week')orders=orders.filter(o=>o.dueDate>=now&&o.dueDate<=today(end));
    if(i.date){if(!validDate(i.date))return ask(i,'¿Para qué fecha?','date');orders=orders.filter(o=>o.dueDate===i.date);}
    if(i.action==='work.list')return answer('Trabajos pendientes',orders.flatMap(o=>worksFor(d,o.id).filter(w=>w.status!=='Terminado').map(w=>card(label(d,o),[['Proceso',w.process],['Piezas',w.quantity],['Estado',w.status]],'order/'+o.id))));
    return answer(orders.length?'Órdenes activas: '+orders.length:'No hay órdenes que coincidan.',orders.map(o=>card(label(d,o),[['Entrega',o.dueDate||'Sin fecha'],['Pendiente',money(financial(d,o).balance)]],'order/'+o.id)));
  }
  if(i.action==='employee.balance'){
    const e=choose(i,'employee',d.employees,e=>e.name,'¿De qué empleado hablamos?');if(e.kind)return e;
    const f=employeeSummary(d,e.id);return answer('Saldo del empleado según devengos y pagos reales.',[card(e.name,[['Devengado',money(f.generated)],['Pagado',money(f.paid)],['Pendiente',money(f.balance)],['Piezas devengadas',f.pieces]],'employee/'+e.id)]);
  }
  let o=null;
  if(!i.action.startsWith('inventory.')){
    if(!i.order&&context.orderId)i.order=String(context.orderId);
    const write=['payment.add','cost.add','work.add','work.assign','work.start','work.finish'].includes(i.action);
    o=choose(i,'order',d.orders.filter(x=>write?active(x):!trashed(x)),x=>label(d,x)+' · '+(find(d,'clients',x.clientId)?.name||''),'¿Qué vehículo u orden?');
    if(o.kind)return o;i.order=String(o.id);context={...context,orderId:o.id};
    const f=financial(d,o);
    if(i.action.startsWith('order.'))return answer('Datos de '+o.number,[card(label(d,o),[['Precio acordado',money(f.revenue)],['Abonado',money(f.collected)],['Pendiente',money(f.balance)],...(i.action==='order.costs'||i.action==='order.profit'?[['Materiales',money(f.materials)],['Mano de obra devengada',money(f.labor)],['Otros costos',money(f.others)],['Costos registrados',money(f.costs)],['Utilidad sobre venta',money(f.profit)],['Mano de obra pendiente',money(f.pendingLabor)],['Utilidad proyectada',money(f.projectedProfit)]]:[]),['Entrega',o.dueDate||'Sin fecha'],['Trabajos terminados',worksFor(d,o.id).filter(w=>w.status==='Terminado').length+' / '+worksFor(d,o.id).length]],'order/'+o.id)],context);
    if(i.action==='work.list')return answer('Trabajos pendientes de '+o.number,worksFor(d,o.id).filter(w=>w.status!=='Terminado').map(w=>card(w.process,[['Piezas',w.quantity],['Estado',w.status]],'order/'+o.id)),context);
  }
  let command,title,rows=[];const date=i.date||now;
  if(!validDate(date))return ask(i,'¿Qué fecha tiene el movimiento?','date');
  if(i.action==='work.add'){
    const parsed=receptionIntent(i);if(parsed.kind)return parsed;
    command={method:'addOrderWork',args:[o.id,parsed]};title='Agregar trabajos';rows=[['Orden',label(d,o)],['Piezas',parsed.map(p=>p.name).join(', ')],['Procesos',[...new Set(parsed.flatMap(p=>p.processes))].join(', ')],['Precio acordado',money(o.total)],['Aviso','No cambia el precio ni el comprobante original.']];
  }
  if(i.action==='payment.add'){
    let missing=requireValue(i,'amount','¿Cuánto recibiste?');if(missing)return missing;
    if(!i.method||!METHODS.includes(i.method))return ask(i,'¿Cómo recibiste el pago?','method',METHODS.map(value=>({label:value,value})));
    if(i.amount<=0||i.amount>financial(d,o).balance)throw Error('El abono debe ser mayor que cero y no superar el balance pendiente.');
    command={method:'payment',args:[o.id,{amount:i.amount,method:i.method,date,note:'Registrado mediante asistente'}]};title='Registrar abono';rows=[['Orden',label(d,o)],['Monto',money(i.amount)],['Método',i.method],['Fecha',date],['Balance después',money(round(financial(d,o).balance-i.amount))]];
  }
  if(i.action==='cost.add'){
    const missing=requireValue(i,'amount','¿Cuál fue el monto total?')||requireValue(i,'description','¿Qué concepto tiene el gasto?');if(missing)return missing;
    if(i.amount<=0)throw Error('El gasto debe ser mayor que cero.');
    const type=i.filter==='materials'?'Materiales':'Otros costos';
    command={method:'cost',args:[o.id,{amount:i.amount,description:i.description,date,type,quantity:1}]};title='Registrar costo';rows=[['Orden',label(d,o)],['Concepto',i.description],['Tipo',type],['Monto total',money(i.amount)],['Fecha',date]];
  }
  if(i.action==='inventory.receive'){
    let missing=requireValue(i,'product','¿Qué producto compraste?');if(missing)return missing;
    if(norm(i.product)==='lija')return ask(i,'¿De qué grano son las lijas?','product');
    const matches=d.inventory.filter(p=>match(p.name,i.product));
    const exact=d.inventory.find(p=>String(p.id)===i.product||norm(p.name)===norm(i.product));
    if(!exact&&matches.length>1)return ask(i,'¿Cuál de estos productos?','product',matches.map(p=>({label:p.name,value:String(p.id)})));
    const p=exact||matches[0];
    missing=requireValue(i,'quantity','¿Cuántas unidades compraste?');if(missing)return missing;
    if(i.quantity<=0)throw Error('La cantidad debe ser mayor que cero.');
    if(i.unitCost===null&&i.amount!==null)i.unitCost=round(i.amount/i.quantity);
    missing=requireValue(i,'unitCost','¿Cuál fue el costo por unidad?');if(missing)return missing;
    if(!p&&!i.unit)return ask(i,'¿En qué unidad se cuenta?','unit',[{label:'Unidad',value:'unidad'},{label:'Galón',value:'galón'},{label:'Litro',value:'litro'}]);
    command=p?{method:'inventoryMove',args:[p.id,{kind:'entry',quantity:i.quantity,unitCost:i.unitCost,date,note:'Compra registrada mediante asistente'}]}:{method:'assistantNewProduct',args:[{name:i.product,unit:i.unit,unitCost:i.unitCost,quantity:i.quantity,date}]};
    title='Agregar al inventario';rows=[['Producto',p?.name||i.product],['Cantidad',i.quantity+' '+(p?.unit||i.unit)],['Costo unitario',money(i.unitCost)],['Total',money(round(i.unitCost*i.quantity))],['Fecha',date]];
  }
  if(['work.assign','work.finish','work.start'].includes(i.action)){
    if(!i.process)return ask(i,'¿Qué proceso?','process',PROCESSES.map(value=>({label:value,value})));
    const process=PROCESSES.find(p=>norm(p)===norm(i.process));if(!process)throw Error('El proceso no existe en TallerOS.');i.process=process;
    let ps=piecesFor(d,o.id);
    if(!i.pieces)return ask(i,'¿Qué piezas de la orden?','pieces',[{label:'Todas las piezas',value:'todas'},...ps.map(p=>({label:p.name,value:p.name}))]);
    if(!['todas','pintura completa'].includes(norm(i.pieces))){const terms=i.pieces.split(/[,;]|\s+y\s+/).map(s=>s.trim()).filter(Boolean);ps=ps.filter(p=>terms.some(t=>match(p.name,t)));}
    if(norm(i.pieces)==='pintura completa'){
      ps=ps.filter(p=>PIECE_CATALOG.some(c=>c.id===p.catalogId));
      if(!PIECE_CATALOG.every(c=>ps.some(p=>p.catalogId===c.id)))throw Error('Selecciona primero las 13 piezas estándar en la orden.');
    }
    if(!ps.length)throw Error('No encontré esas piezas en la orden. Selecciónalas en el detalle antes de asignar.');
    const ids=ps.map(p=>p.id),jobs=worksFor(d,o.id).filter(w=>w.process===process&&w.selectedPieceIds.some(id=>ids.includes(id)));
    if(i.action==='work.finish'||i.action==='work.start'){
      if(!jobs.length)throw Error('No hay una asignación para ese proceso y esas piezas.');
      if(!ids.every(id=>jobs.some(w=>w.selectedPieceIds.includes(id))))throw Error('Alguna pieza no tiene ese proceso. Registra primero el trabajo que falta.');
      const status=i.action==='work.finish'?'Terminado':'En proceso';
      const pending=jobs.filter(w=>w.status!=='Terminado'&&w.status!==status);if(!pending.length)return answer('Esos trabajos ya tienen ese avance o están terminados.',[],context);
      if(pending.some(w=>w.selectedPieceIds.some(id=>!ids.includes(id))&&(workFrozen(w)||w.mode!=='Por pieza')))throw Error('El grupo tiene un monto fijo o importes históricos. Actualiza el grupo completo desde la orden.');
      if(status==='Terminado'&&pending.some(w=>!w.employeeId))throw Error('Asigna un empleado antes de terminar el trabajo.');
      command={method:'workSelectionState',args:[o.id,process,ids,status]};title=status==='Terminado'?'Terminar trabajos':'Iniciar trabajos';rows=[['Orden',label(d,o)],['Proceso',process],['Piezas',ps.map(p=>p.name).join(', ')],['Estado',status],['Devengo',money(status==='Terminado'?sum(pending.filter(w=>!workFrozen(w)),w=>w.mode==='Por pieza'?round(w.selectedPieceIds.filter(id=>ids.includes(id)).length*w.rate):w.total):0)]];
    }else{
      const e=choose(i,'employee',d.employees.filter(e=>e.active!==false),e=>e.name,'¿A qué empleado lo asigno?');if(e.kind)return e;i.employee=String(e.id);
      if(i.rate===null)i.rate=Number(e.pieceRate)||null;
      if(!i.rate)return ask(i,'¿Cuál es la tarifa por pieza?','rate');
      if(jobs.some(w=>w.employeeId||workFrozen(w)||w.status==='Terminado'))throw Error('Ya hay asignaciones en esas piezas. Revísalas desde la orden para evitar duplicar mano de obra.');
      command={method:'assignWorkSelection',args:[o.id,{process,employeeId:e.id,selectedPieceIds:ids,mode:'Por pieza',rate:i.rate,notes:'Asignado mediante asistente'}]};title='Asignar trabajo';rows=[['Orden',label(d,o)],['Proceso',process],['Empleado',e.name],['Piezas',ps.map(p=>p.name).join(', ')],['Cantidad',ids.length],['Tarifa por pieza',money(i.rate)],['Total',money(round(ids.length*i.rate))]];
    }
  }
  if(!command)throw Error('Esta acción todavía no está disponible.');
  return proposal(d,i,context,title,rows,command);
}
const proposal=(d,i,context,title,rows,command)=>({kind:'proposal',text:title,cards:[card(title,rows)],intent:i,context,command,requestId:uid(),fingerprint:stateFingerprint(d),createdAt:Date.now()});
function receptionIntent(i){
  if(!i.pieces)return ask(i,'¿Qué piezas se trabajarán?','pieces');
  if(!i.process){if(norm(i.pieces)==='pintura completa')i.process='Pintura';else return ask(i,'¿Qué procesos se realizarán en esas piezas?','process',PROCESSES.map(value=>({label:value,value})));}
  const processes=i.process.split(/[,;]|\s+y\s+/).map(value=>PROCESSES.find(p=>norm(p)===norm(value)));
  if(processes.some(p=>!p))return ask(i,'¿Qué proceso del taller corresponde?','process',PROCESSES.map(value=>({label:value,value})));
  const pieces=expandReceptionPieces(i.pieces.split(/[,;]/).flatMap(name=>{
    const value=norm(name);
    if(/^(las )?((4|cuatro) )?puertas$/.test(value))return PIECE_CATALOG.filter(p=>p.id.startsWith('door-')).map(p=>({name:p.name,processes}));
    const known=PIECE_CATALOG.find(p=>norm(p.name)===value);return [{name:known?.name||name.trim(),processes}];
  }));
  if(pieces.some(p=>!p.name||p.name.length>100))throw Error('Separa los nombres de las piezas con comas.');
  return pieces;
}
function prepareIntake(d,i,context){
  if(i.action==='client.create'){
    const missing=requireValue(i,'client','¿Cómo se llama el cliente?')||requireValue(i,'phone','¿Cuál es su teléfono?');if(missing)return missing;
    const exists=d.clients.find(c=>norm(c.name)===norm(i.client)&&c.phone.replace(/\D/g,'')===i.phone.replace(/\D/g,''));
    if(exists)return answer('Ese cliente ya está registrado.',[card(exists.name,[['Teléfono',exists.phone]],'client/'+exists.id)],{clientId:exists.id});
    return proposal(d,i,context,'Registrar cliente',[['Nombre',i.client],['Teléfono',i.phone],['WhatsApp',i.whatsapp||'No indicado']],{method:'saveClient',args:[{name:i.client,phone:i.phone,whatsapp:i.whatsapp||''}]});
  }
  if(i.action==='vehicle.create'){
    if(!i.client&&context.clientId)i.client=String(context.clientId);
    const c=choose(i,'client',d.clients.filter(c=>!c.archived),c=>c.name+' · '+c.phone,'¿De qué cliente es el vehículo?');if(c.kind)return c;i.client=String(c.id);
    const missing=requireValue(i,'brand','¿De qué marca es?')||requireValue(i,'model','¿Cuál es el modelo?');if(missing)return missing;
    if(i.plate&&d.vehicles.some(v=>norm(v.plate)===norm(i.plate)))throw Error('Ya existe un vehículo con esa matrícula. Consúltalo antes de crear otro.');
    return proposal(d,i,{...context,clientId:c.id},'Registrar vehículo',[['Cliente',c.name],['Marca',i.brand],['Modelo',i.model],['Año',i.year||'No indicado'],['Color',i.color||'No indicado'],['Matrícula',i.plate||'No indicada']],{method:'saveVehicle',args:[{clientId:c.id,brand:i.brand,model:i.model,year:i.year||'',color:i.color||'',plate:i.plate||''}]});
  }
  if(!i.vehicle&&context.vehicleId)i.vehicle=String(context.vehicleId);
  let vehicles=d.vehicles.filter(v=>!v.archived&&!find(d,'clients',v.clientId)?.archived);
  if(i.client){const c=choose(i,'client',d.clients.filter(c=>!c.archived),c=>c.name,'¿Para qué cliente?');if(c.kind)return c;i.client=String(c.id);vehicles=vehicles.filter(v=>v.clientId===c.id);}
  const v=choose(i,'vehicle',vehicles,v=>[v.brand,v.model,v.year,v.plate,find(d,'clients',v.clientId)?.name].filter(Boolean).join(' · '),'¿Para qué vehículo creamos la orden?');if(v.kind)return v;i.vehicle=String(v.id);
  const missing=requireValue(i,'amount','¿Cuál es el precio total acordado?')||requireValue(i,'dueDate','¿Cuál es la fecha estimada de entrega?');if(missing)return missing;
  const date=i.date||today();if(!validDate(date))return ask(i,'¿Cuál es la fecha de recepción?','date');if(!validDate(i.dueDate)||i.dueDate<date)return ask(i,'¿Qué fecha de entrega igual o posterior a la recepción acordaron?','dueDate');
  const pieces=receptionIntent(i);if(pieces.kind)return pieces;
  if(i.initialAmount===null)return ask(i,'¿Cuánto recibiste de abono inicial?','initialAmount',[{label:'Sin abono',value:0}]);
  if(i.initialAmount>i.amount)throw Error('El abono inicial supera el precio acordado.');
  if(i.initialAmount&&!METHODS.includes(i.method))return ask(i,'¿Cómo recibiste el abono inicial?','method',METHODS.map(value=>({label:value,value})));
  if(i.paymentDate&&!validDate(i.paymentDate))return ask(i,'¿En qué fecha recibiste el abono?','paymentDate');
  const fields={clientId:v.clientId,vehicleId:v.id,total:i.amount,entryDate:date,dueDate:i.dueDate,createReception:true,receptionPieces:pieces,initialAmount:i.initialAmount,initialMethod:i.method,initialDate:i.paymentDate||date,workConditions:i.conditions||'',receptionNotes:i.receptionNotes||''};
  return proposal(d,i,{...context,clientId:v.clientId,vehicleId:v.id},'Crear orden y comprobante',[['Cliente',find(d,'clients',v.clientId)?.name],['Vehículo',[v.brand,v.model,v.year,v.color,v.plate].filter(Boolean).join(' · ')],['Recepción',date],['Entrega prevista',i.dueDate],['Piezas',pieces.map(p=>p.name).join(', ')],['Procesos',[...new Set(pieces.flatMap(p=>p.processes))].join(', ')],['Precio',money(i.amount)],['Abono inicial',money(i.initialAmount)],['Método',i.method||'Sin abono'],['Fecha del abono',i.initialAmount?fields.initialDate:'Sin abono'],['Balance',money(round(i.amount-i.initialAmount))],['Condiciones',fields.workConditions||'No indicadas'],['Observaciones',fields.receptionNotes||'No indicadas']],{method:'saveOrder',args:[fields]});
}

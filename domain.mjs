export const VERSION = '2.1.0';
export const MAIN = ['settings','clients','vehicles','orders','parts','employees','payments','costs'];
export const EXTRA = ['ledgerAccounts','ledgerAccruals','ledgerPayments','invoices','inventory','inventoryMoves','events','monthlyClosures','meta','snapshots'];
export const STORES = [...MAIN,...EXTRA];
export const METHODS = ['Efectivo','Transferencia','Tarjeta','Otro'];
export const STAGES = ['Pendiente','Desabolladura','Preparación','Pintura','Secado','Brillado','Terminada'];
export const CATEGORIES = ['Pintura','Clear','Primer','Thinner/reductor','Masilla','Lijas','Cinta/papel/plástico','Pulimento','Consumibles','Otros'];
export const n = x => Number.isFinite(Number(x)) ? Number(x) : 0;
export const round = x => Math.round((n(x) + Number.EPSILON) * 100) / 100;
export const sum = (a,f=x=>x) => round(a.reduce((s,x)=>s+n(f(x)),0));
export const today = (time=new Date()) => [time.getFullYear(),String(time.getMonth()+1).padStart(2,'0'),String(time.getDate()).padStart(2,'0')].join('-');
export const day = value => !value ? '' : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today(new Date(value));
export const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') && today(new Date(value+'T12:00:00'))===value;
export const uid = () => globalThis.crypto.randomUUID();
export const find = (d,store,id) => d[store].find(x=>String(x.id)===String(id));
export const belongs = (x,id) => Number(x.orderId)===Number(id);
export const trashed = o => o.deleted===true || !!o.deletedAt;
export const closed = o => o.lifecycle==='closed' || (!o.lifecycle && ['Entregada','Cerrada','Cerrada / Entregada'].includes(o.status));
export const cancelled = o => o.lifecycle==='cancelled' || o.status==='Cancelada';
export const active = o => !closed(o) && !cancelled(o) && !trashed(o) && !o.archived;
export const operativeParts = (d,id) => d.parts.filter(p=>belongs(p,id)&&!p.archived);
export function finished(d,o) {
  const parts=operativeParts(d,o.id);
  return parts.length ? parts.every(p=>p.status==='Terminada') : o.lifecycle==='finished'||!!o.workCompletedAt||o.status==='Lista para entregar';
}
export const paid = (d,id) => sum(d.payments.filter(x=>belongs(x,id)&&!x.voided),x=>x.amount);
export const balance = (d,o) => Math.max(0,round(n(o.total)-paid(d,o.id)));
export function status(d,o) {
  if(trashed(o))return 'Papelera';
  if(closed(o))return 'Cerrada / Entregada';
  if(cancelled(o))return 'Cancelada';
  if(o.archived)return 'Archivada';
  if(finished(d,o))return balance(d,o)>0?'Trabajo terminado · Pendiente de cobro':'Lista para entregar';
  if(o.lifecycle==='production'||operativeParts(d,o.id).some(p=>p.status!=='Pendiente')||/^En /.test(o.status))return 'En producción';
  return o.status==='Cotización'?'Cotización':'Activa';
}
export function financial(d,o) {
  const direct=d.costs.filter(x=>belongs(x,o.id)&&!x.voided),parts=d.parts.filter(x=>belongs(x,o.id));
  const materials=sum(direct.filter(x=>x.type==='Materiales'),x=>x.amount)+sum(parts,x=>x.materialCost);
  const labor=sum(direct.filter(x=>x.type==='Mano de obra'),x=>x.amount)+sum(parts,x=>x.laborCost);
  const others=sum(direct.filter(x=>!['Materiales','Mano de obra'].includes(x.type)),x=>x.amount)+sum(parts,x=>x.otherCost);
  const costs=round(materials+labor+others),revenue=n(o.total),collected=paid(d,o.id);
  const pendingLabor=sum(parts.flatMap(p=>p.laborAssignments||[]).filter(a=>a.ledgerState==='pending'&&!a.ledgerCostAlreadyCounted),a=>a.total);
  return {revenue,collected,balance:balance(d,o),credit:Math.max(0,round(collected-revenue)),materials:round(materials),labor:round(labor),others:round(others),costs,profit:round(revenue-costs),margin:revenue?round((revenue-costs)/revenue*100):0,pendingLabor,projectedProfit:round(revenue-costs-pendingLabor)};
}
export function employeeSummary(d,id) {
  const accruals=d.ledgerAccruals.filter(a=>Number(a.employeeId)===Number(id));
  const payments=d.ledgerPayments.filter(a=>Number(a.employeeId)===Number(id)&&!a.voided);
  const assignments=d.parts.flatMap(p=>(p.laborAssignments||[]).filter(a=>Number(a.employeeId)===Number(id)).map(a=>({...a,partId:p.id,orderId:p.orderId,partArchived:p.archived})));
  return {accruals,payments,assignments,generated:sum(accruals,a=>a.total),paid:sum(payments,a=>a.amount),balance:Math.max(0,round(sum(accruals,a=>a.total)-sum(payments,a=>a.amount))),pieces:sum(accruals,a=>a.quantity),pending:sum(assignments.filter(a=>a.ledgerState==='pending'&&!a.partArchived),a=>a.quantity)};
}
export function refreshAccounts(d) {
  d.ledgerAccounts.forEach(a=>{
    a.generated=sum(d.ledgerAccruals.filter(x=>x.accountId===a.id),x=>x.total);
    a.paid=sum(d.ledgerPayments.filter(x=>x.accountId===a.id&&!x.voided),x=>x.amount);
    a.balance=Math.max(0,round(a.generated-a.paid));
    if(a.status!=='CERRADA')a.status=a.generated>0&&a.balance===0?'PAGADA':'ABIERTA';
  });
}
export function suffix(number) { const s=Number(String(number||'').match(/(\d+)$/)?.[1]||0);return Number.isSafeInteger(s)?s:0; }
export function normalize(d,legacy={},at=new Date().toISOString()) {
  STORES.forEach(s=>d[s] ||= []);
  const snap=d.meta.find(x=>x.id==='phase2');
  if(snap)return d;
  if(!d.settings.some(x=>Number(x.workshopId)===1))d.settings.push({id:1,workshopId:1,name:'RevivAuto',prefix:'REV',painterRate:350});
  for(const [from,to] of [['accounts','ledgerAccounts'],['accruals','ledgerAccruals'],['payments','ledgerPayments']]){
    for(const item of legacy[from]||[])if(!d[to].some(x=>x.id===item.id))d[to].push({...item});
  }
  // Only add migration metadata. Keep IDs, order numbers, original statuses and unknown fields.
  for(const o of d.orders){
    if(o.workshopId!==1)continue;
    o.lifecycle ||= closed(o)?'closed':cancelled(o)?'cancelled':o.status==='Lista para entregar'?'finished':/^En /.test(o.status)?'production':'active';
    if(o.lifecycle==='closed'&&!o.closedAt)o.closedAt=o.deliveredAt||o.deliveryDate||null;
    o.migrationVersion=2;
  }
  for(const p of d.parts){
    if(p.workshopId!==1)continue;
    p.laborAssignments=(p.laborAssignments||[]).map((a,i)=>a.sourceAssignmentId?{...a}:{...a,sourceAssignmentId:'legacy-'+p.id+'-'+i,ledgerState:p.status==='Terminada'?'legacy':'pending',ledgerCostAlreadyCounted:p.status!=='Terminada'});
    // Existing part costs remain authoritative; do not generate historical debt.
  }
  const setting=d.settings.find(x=>Number(x.workshopId)===1);
  const history=[...d.orders,...(legacy.snapshots||[]).flatMap(s=>s.collections?.orders||[])];
  setting.orderSequence=Math.max(n(setting.orderSequence),...history.map(o=>suffix(o.number)),0);
  setting.orderSequenceInitializedAt ||= at;
  d.meta.push({id:'phase2',workshopId:1,version:2,appVersion:VERSION,migratedAt:at});
  return d;
}
export function customerInvoice(d,o,number,at=new Date().toISOString()) {
  const setting=d.settings.find(x=>x.workshopId===1)||{},client=find(d,'clients',o.clientId)||{},vehicle=find(d,'vehicles',o.vehicleId)||{};
  const payments=d.payments.filter(p=>belongs(p,o.id)&&!p.voided).sort((a,b)=>String(a.date).localeCompare(String(b.date))||n(a.id)-n(b.id));
  // Explicit allowlist: internal costs, employee pay and order notes never enter the customer document.
  return {id:uid(),workshopId:1,orderId:o.id,number,orderNumber:o.number,issuedAt:at,closedAt:at,entryDate:o.entryDate,
    workshop:{name:setting.name,logoData:setting.logoData,phone:setting.phone,address:setting.address,document:setting.document,email:setting.email},
    client:{name:client.name,phone:client.phone,document:client.document},
    vehicle:{brand:vehicle.brand,model:vehicle.model,year:vehicle.year,plate:vehicle.plate,color:vehicle.color},
    works:operativeParts(d,o.id).map(p=>({description:p.description,price:n(p.price)})),
    payments:payments.map((p,i)=>({amount:n(p.amount),date:p.date,method:p.method||'No registrado',final:i===payments.length-1})),
    total:n(o.total),paid:paid(d,o.id),balance:balance(d,o),notes:String(o.customerNotes||'')};
}
export function costEntries(d) {
  const entries=d.costs.filter(x=>!x.voided).map(x=>({source:'cost:'+x.id,orderId:x.orderId,type:x.type||'Otros costos',amount:n(x.amount),date:day(x.date||x.incurredAt)}));
  for(const p of d.parts){
    for(const [field,type] of [['materialCost','Materiales'],['otherCost','Otros costos']]){
      if(n(p[field]))entries.push({source:'part:'+p.id+':'+field,orderId:p.orderId,type,amount:n(p[field]),date:day(p[field+'Date']||p.costDate)});
    }
    let remaining=n(p.laborCost);
    // Split the authoritative labor total by known accrual dates without adding it twice.
    const accruals=d.ledgerAccruals.filter(a=>Number(a.partId)===Number(p.id));
    for(const a of accruals){
      const amount=Math.min(Math.max(0,remaining),n(a.total));
      if(amount)entries.push({source:'accrual:'+a.id,orderId:p.orderId,type:'Mano de obra',amount,date:day(a.generatedAt||a.date)});
      remaining=round(remaining-amount);
    }
    if(remaining)entries.push({source:'part:'+p.id+':legacyLabor',orderId:p.orderId,type:'Mano de obra',amount:remaining,date:day(p.laborCostDate)});
  }
  return entries;
}
export function monthly(d,month) {
  const end=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0);
  const cutoff=today(end),within=x=>day(x).slice(0,7)===month,before=x=>!!day(x)&&day(x)<=cutoff;
  // Sales: agreed price, entry/sale date. Cash: actual dated receipts, even for cancelled orders.
  const soldOrders=d.orders.filter(o=>!cancelled(o)&&o.status!=='Cotización'&&within(o.saleDate||o.entryDate));
  const sold=sum(soldOrders,o=>o.total);
  const cash=sum(d.payments.filter(p=>!p.voided&&within(p.date)),p=>p.amount);
  const receivables=sum(d.orders.filter(o=>!cancelled(o)&&o.status!=='Cotización'&&before(o.saleDate||o.entryDate)),o=>Math.max(0,n(o.total)-sum(d.payments.filter(p=>belongs(p,o.id)&&!p.voided&&before(p.date)),p=>p.amount)));
  const entries=costEntries(d),periodCosts=entries.filter(x=>within(x.date));
  const materials=sum(periodCosts.filter(x=>x.type==='Materiales'),x=>x.amount),labor=sum(periodCosts.filter(x=>x.type==='Mano de obra'),x=>x.amount),others=sum(periodCosts.filter(x=>!['Materiales','Mano de obra'].includes(x.type)),x=>x.amount);
  const generated=sum(d.ledgerAccruals.filter(x=>within(x.generatedAt||x.date)),x=>x.total);
  const employeePaid=sum(d.ledgerPayments.filter(x=>!x.voided&&within(x.date)),x=>x.amount);
  const employeeBalance=Math.max(0,round(sum(d.ledgerAccruals.filter(x=>before(x.generatedAt||x.date)),x=>x.total)-sum(d.ledgerPayments.filter(x=>!x.voided&&before(x.date)),x=>x.amount)));
  const closedOrders=d.orders.filter(o=>closed(o)&&within(o.closedAt));
  const unknown=entries.filter(x=>!validDate(x.date)&&x.amount!==0);
  const inventory=d.inventoryMoves.filter(x=>within(x.date));
  return {month,sold,cash,receivables,materials,labor,others,costs:round(materials+labor+others),profit:round(sold-materials-labor-others),margin:sold?round((sold-materials-labor-others)/sold*100):0,
    opened:d.orders.filter(o=>within(o.entryDate)).length,closed:closedOrders.length,delivered:closedOrders.length,vehicles:new Set(closedOrders.map(o=>o.vehicleId)).size,
    pieces:d.parts.filter(p=>within(p.completedAt)).length,generated,employeePaid,employeeBalance,
    purchases:sum(inventory.filter(x=>x.kind==='entry'),x=>x.value),consumption:sum(inventory.filter(x=>x.kind==='exit'),x=>x.value),
    undatedCosts:sum(unknown,x=>x.amount),undatedCount:unknown.length,undatedClosures:d.orders.filter(o=>closed(o)&&!validDate(day(o.closedAt))).length,
    basis:'Venta por fecha de entrada; caja por fecha de cobro; costos por fecha conocida de registro/devengo. Saldos al último día del mes. Sin fechas inventadas.'};
}
export function audit(d) {
  const issues=[];
  const check=(rows,test,message)=>rows.forEach(x=>{if(test(x))issues.push({id:x.id,message});});
  check(d.orders,o=>!find(d,'clients',o.clientId)||!find(d,'vehicles',o.vehicleId),'Orden con cliente o vehículo sin referencia.');
  check(d.parts,p=>!find(d,'orders',p.orderId),'Pieza con orden sin referencia.');
  check([...d.payments,...d.costs],x=>!find(d,'orders',x.orderId),'Movimiento con orden sin referencia.');
  check(d.orders,o=>paid(d,o.id)>n(o.total)+0.005,'Orden con cobros superiores al precio; revisar sin borrar pagos.');
  check(d.orders,o=>closed(o)&&balance(d,o)>0,'Orden histórica entregada con saldo pendiente.');
  const numbers=new Set();d.orders.forEach(o=>{if(numbers.has(o.number))issues.push({id:o.id,message:'Número de orden repetido: '+o.number});numbers.add(o.number);});
  const source=new Set();d.ledgerAccruals.forEach(a=>{if(source.has(a.sourceAssignmentId))issues.push({id:a.id,message:'Devengo posiblemente duplicado; requiere revisión.'});source.add(a.sourceAssignmentId);});
  return issues;
}

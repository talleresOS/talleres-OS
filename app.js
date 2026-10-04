import {createDocumentUI} from './document-ui.mjs';
import {createAssistantUI} from './assistant-ui.mjs';
import {TallerService} from './service.mjs';
import {createWorkUI} from './work-ui.mjs';
import {worksFor,piecesFor} from './work-model.mjs';
import {paletteFromLogo,logoKey} from './logo-palette.mjs';
import {VERSION,n,round,sum,today,day,find,belongs,active,closed,cancelled,trashed,finished,balance,paid,financial,status,employeeSummary,monthly,audit,STAGES,METHODS,CATEGORIES} from './domain.mjs';
const service=new TallerService(),app=document.querySelector('#app'),dialog=document.querySelector('#dialog');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>'RD$'+new Intl.NumberFormat('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n(x));
const date=x=>x?day(x):'Fecha no registrada';
const button=(label,action,id='',cls='')=>'<button type="button" class="btn '+cls+'" data-action="'+action+'" data-id="'+esc(id)+'">'+label+'</button>';
const metric=(label,value)=>'<div class="metric"><span>'+label+'</span><strong>'+value+'</strong></div>';
const row=(label,value)=>'<div class="row"><span>'+label+'</span><strong>'+value+'</strong></div>';
const empty=label=>'<div class="empty-state"><span class="empty-watermark" aria-hidden="true">TallerOS</span><p class="empty">'+label+'</p></div>';
const field=(label,name,value='',type='text',extra='')=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(type==='number'?'min="0" step="0.01" inputmode="decimal" ':'')+extra+'></label>';
const textarea=(label,name,value='')=>'<label class="field full"><span>'+label+'</span><textarea name="'+name+'" rows="3">'+esc(value)+'</textarea></label>';
const select=(label,name,options,value,extra='')=>'<label class="field"><span>'+label+'</span><select aria-label="'+esc(label)+'" name="'+name+'" '+extra+'>'+options.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return '<option value="'+esc(v)+'" '+(String(v)===String(value)?'selected':'')+'>'+esc(l)+'</option>';}).join('')+'</select></label>';
let d,route='home',id='',orderTab='work',formContext={},busy=false,selectedMonth=today().slice(0,7),pendingImport=null,previousFocus,pendingReception;
const names={home:'Inicio',orders:'Órdenes',production:'Producción',clients:'Clientes',more:'Más',history:'Historial',employees:'Empleados',inventory:'Inventario',monthly:'Cierre mensual',settings:'Configuración',finance:'Finanzas',trash:'Papelera'};
const client=o=>find(d,'clients',o.clientId)||{};
const vehicle=o=>find(d,'vehicles',o.vehicleId)||{};
const vehicleText=o=>{const v=vehicle(o);return [v.brand,v.model,v.year].filter(Boolean).join(' ')||'Vehículo sin referencia';};
const badge=label=>'<span class="badge">'+esc(label)+'</span>';
const workUI=createWorkUI({service,data:()=>d,context:()=>formContext,esc,button,field,select,textarea,row,badge,empty,money,date,openDialog,confirmAction,toast,render,navigate,download});
const documentUI=createDocumentUI({service,data:()=>d,esc,button,field,select,textarea,row,money,openDialog,render,toast,download});
const assistantUI=createAssistantUI({service,render,esc,toast,onOrderCreated:async orderId=>{d=await service.state();pendingReception=find(d,'orders',orderId)?.initialReceipt;orderTab='work';navigate('order/'+orderId);}});
// Appearance is presentation-only and persists in the existing settings record.
const appearanceDefaults={theme:'dark',primary:'#eec567',accent:'#69c9c1'};
function appearance(){const v=d.settings[0]?.appearance||{};return {theme:v.theme==='light'?'light':'dark',primary:/^#[0-9a-f]{6}$/i.test(v.primary)?v.primary:appearanceDefaults.primary,accent:/^#[0-9a-f]{6}$/i.test(v.accent)?v.accent:appearanceDefaults.accent};}
function luminance(hex){const rgb=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function readableAccent(color,theme){
  const background=theme==='light'?'#dddddd':'#3b4b61',target=theme==='light'?0:255,b=luminance(background);
  const rgb=color.slice(1).match(/../g).map(x=>parseInt(x,16));
  for(let step=0;step<=20;step++){const hex='#'+rgb.map(x=>Math.round(x+(target-x)*step/20).toString(16).padStart(2,'0')).join(''),l=luminance(hex);if((Math.max(l,b)+.05)/(Math.min(l,b)+.05)>=4.5)return hex;}
  return theme==='light'?'#000000':'#ffffff';
}
async function ensureLogo(force=false){
  const state=await service.state(),s=state.settings[0];if(!s?.logoData)return;
  const key=await logoKey(s.logoData);if(!force&&s.paletteLogo===key)return;
  const result=await paletteFromLogo(s.logoData);
  await service.settings({palette:result.colors,paletteLogo:key,appearance:{theme:s.appearance?.theme||'dark',primary:result.colors[0],accent:result.colors[1],mode:'auto'}});
}
function applyAppearance(){
  const a=appearance(),root=document.documentElement;root.dataset.theme=a.theme;
  root.style.setProperty('--primary',a.primary);root.style.setProperty('--accent',a.accent);
  root.style.setProperty('--on-primary',luminance(a.primary)>.179?'#000000':'#ffffff');
  root.style.setProperty('--gold',readableAccent(a.primary,a.theme));root.style.setProperty('--accent-ink',readableAccent(a.accent,a.theme));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',a.theme==='light'?'#f3f5f8':'#151b24');
}
function toast(message){const t=document.querySelector('#toast');t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,5000);}
function navigate(target){dialog.close();if(location.hash==='#'+target)render();else location.hash=target;}
function shell(title,body,action=''){
  const sparse=(['home','orders','production'].includes(route)?d.orders.filter(active).length<4:route==='clients'&&d.clients.length<4)&&!body.includes('empty-state');
  if(sparse)body+='<span class="workspace-watermark" aria-hidden="true">TallerOS</span>';
  const nav=[['home','⌂','Inicio'],['orders','▤','Órdenes'],['production','◇','Producción'],['clients','♙','Clientes'],['more','•••','Más']];
  const selected=route==='order'?'orders':route==='client'?'clients':names[route]&&!['history','employees','inventory','monthly','settings','finance','trash'].includes(route)?route:'more';
  app.innerHTML='<aside class="sidebar"><a class="brand" href="#home">'+(d.settings[0]?.logoData?'<img class="brand-logo" src="'+esc(d.settings[0].logoData)+'" alt="Logo del taller">':'<span class="brand-mark">T</span>')+'<span>Taller<span class="gold">OS</span><small>'+esc(d.settings[0]?.name||'Mi taller')+'</small></span></a><nav>'+Object.entries(names).filter(([k])=>!['more','trash'].includes(k)).map(([k,l])=>'<a href="#'+k+'" class="'+(route===k?'on':'')+'">'+l+'</a>').join('')+'</nav><small class="version">Fase 2 · '+VERSION+'</small></aside><main><header class="top"><div>'+(route==='home'&&d.settings[0]?.logoData?'<img class="home-logo" src="'+esc(d.settings[0].logoData)+'" alt="'+esc(d.settings[0].name)+'">':'<p class="eyebrow">'+esc(d.settings[0]?.name||'Mi taller')+'</p>')+'<h1>'+esc(title)+'</h1></div>'+action+'</header>'+body+'</main><nav class="bottom" aria-label="Navegación principal">'+nav.map(([r,icon,label])=>'<a href="#'+r+'" class="'+(selected===r?'on':'')+'" '+(selected===r?'aria-current="page"':'')+'><span aria-hidden="true">'+icon+'</span>'+label+'</a>').join('')+'</nav>';
}
function orderCard(o,history=false){
  const f=financial(d,o),v=vehicle(o),c=client(o);
  return '<article class="card searchable" data-search="'+esc([o.number,c.name,c.phone,v.brand,v.model,v.year,v.plate,date(o.closedAt)].join(' ').toLocaleLowerCase())+'" data-date="'+esc(day(o.closedAt))+'"><a class="card-link" href="#order/'+o.id+'"><div class="split"><small class="gold">'+esc(o.number)+'</small>'+badge(history?date(o.closedAt):status(d,o))+'</div><h3>'+esc(vehicleText(o))+'</h3><p class="muted">'+esc(c.name||'Cliente sin referencia')+' · '+esc(v.plate||'Sin placa')+'</p>'+(history?'<div class="mini-metrics">'+metric('Facturado',money(f.revenue))+metric('Costo',money(f.costs))+metric('Ganancia',money(f.profit))+'</div>':row('Saldo pendiente',money(f.balance)))+'</a>'+(!history&&finished(d,o)&&f.balance>0?button('Cobrar saldo','pay',o.id,'compact primary'):'')+'</article>';
}
function searchBar(placeholder='Buscar',history=false){return '<div class="filters"><label class="search-field"><span class="sr-only">'+placeholder+'</span><input type="search" id="search" placeholder="'+placeholder+'" data-filter></label>'+(history?field('Mes','historyMonth','','month','data-filter')+field('Año','historyYear','','number','min="2000" max="2100" step="1" data-filter')+field('Desde','historyStart','','date','data-filter')+field('Hasta','historyEnd','','date','data-filter'):'')+'</div>';}
function home(){
  const orders=d.orders.filter(active),attention=orders.filter(o=>finished(d,o)),production=orders.filter(o=>!finished(d,o)),m=monthly(d,today().slice(0,7));
  shell('Tu taller, hoy','<div class="metrics">'+metric('Órdenes activas',orders.length)+metric('Terminados por entregar',attention.length)+metric('Por cobrar',money(sum(d.orders.filter(o=>!cancelled(o)&&o.status!=='Cotización'),o=>balance(d,o))))+metric('Ingresos del mes',money(m.cash))+'</div><section><div class="section-title"><h2>Necesitan atención</h2><span>'+attention.length+'</span></div><div class="cards">'+(attention.map(o=>orderCard(o)).join('')||empty('No hay trabajos terminados pendientes de entrega.'))+'</div></section><section><div class="section-title"><h2>En producción</h2><a href="#production">Ver producción</a></div><div class="cards">'+(production.map(o=>orderCard(o)).join('')||empty('No hay trabajos en producción.'))+'</div></section>',button('Nueva orden','order-new','','primary'));
}
function orderPage(){
  const o=find(d,'orders',id);if(!o)return shell('Orden',empty('Orden no encontrada.'));
  const f=financial(d,o),isActive=active(o),done=finished(d,o);
  let primary='',banner='';
  if(closed(o))banner='<section class="status-panel"><span class="eyebrow">Orden entregada</span><h2>'+esc(date(o.closedAt))+'</h2><p>Consulta histórica. Reabre la orden para modificarla.</p>'+button('Ver factura','invoice',o.id,'primary')+'</section>';
  else if(isActive&&done)banner='<section class="status-panel"><span class="eyebrow">Trabajo terminado</span><h2>'+(f.balance?'Saldo pendiente: '+money(f.balance):'Pago completado')+'</h2>'+button(f.balance?'Cobrar saldo':'Finalizar y entregar',f.balance?'pay':'close-order',o.id,'primary')+'</section>';
  else if(isActive)banner='<section class="status-panel compact"><div><span class="eyebrow">'+esc(status(d,o))+'</span><h2>'+money(f.balance)+' por cobrar</h2></div>'+button('Registrar abono','pay',o.id)+'</section>';
  else banner='<div class="notice">'+esc(status(d,o))+'. Sus movimientos se conservan.</div>';
  const menu=button('•••','order-menu',o.id,'icon');
  const tabs='<div class="tabs" role="group" aria-label="Detalle de orden">'+[['work','Trabajo'],['profit','Rentabilidad'],['movements','Movimientos']].map(([k,l])=>button(l,'order-tab',k,orderTab===k?'selected':'')).join('')+'</div>';
  let body='';
  if(orderTab==='work'){
    body=(o.initialReceipt?'<section class="panel"><h2>Comprobante de recepción y abono</h2>'+button('Ver comprobante','reception-view',o.id,'primary')+'</section>':'')+workUI.orderContent(o)+'<section class="panel"><h2>Datos de la orden</h2>'+row('Cliente',esc(client(o).name))+row('Teléfono',esc(client(o).phone))+row('Vehículo',esc(vehicleText(o)))+row('Placa',esc(vehicle(o).plate||'Sin placa'))+row('Entrada',date(o.entryDate))+row('Entrega prevista',date(o.dueDate))+(o.workConditions?'<h3>Condiciones del trabajo</h3><p>'+esc(o.workConditions)+'</p>':'')+(o.receptionNotes?'<h3>Observaciones de recepción</h3><p>'+esc(o.receptionNotes)+'</p>':'')+row('Precio acordado',money(f.revenue))+(o.notes?'<h3>Notas internas</h3><p>'+esc(o.notes)+'</p>':'')+(o.customerNotes?'<h3>Notas para el cliente</h3><p>'+esc(o.customerNotes)+'</p>':'')+'</section>';
  }else if(orderTab==='profit'){
    const costs=d.costs.filter(x=>belongs(x,o.id)),accruals=d.ledgerAccruals.filter(x=>belongs(x,o.id));
    const allocated=d.ledgerPayments.filter(x=>!x.voided).flatMap(p=>(p.allocations||[]).filter(a=>Number(a.orderId)===Number(o.id)).map(a=>({...a,date:p.date,employeeId:p.employeeId})));
    const accountIds=new Set(accruals.map(a=>a.accountId)),legacyPay=d.ledgerPayments.filter(p=>!p.voided&&accountIds.has(p.accountId)&&!p.allocations);
    body='<section class="panel"><h2>Ingresos</h2>'+row('Precio del trabajo',money(f.revenue))+row('Dinero cobrado',money(f.collected))+row('Pendiente',money(f.balance))+'<h2>Costos</h2>'+row('Materiales',money(f.materials))+row('Mano de obra devengada / histórica',money(f.labor))+row('Otros costos',money(f.others))+'<div class="result">'+row('Ganancia '+(closed(o)?'neta':'sobre costos registrados'),money(f.profit))+row('Margen',f.margin+'%')+'</div>'+(f.pendingLabor?row('Mano de obra pendiente de terminar',money(f.pendingLabor))+row('Ganancia proyectada incluyéndola',money(f.projectedProfit)):'')+'<p class="help">La ganancia usa el precio acordado. Cobrado representa caja. Pagar al empleado reduce su saldo y no vuelve a sumar costos.</p></section><section class="panel"><div class="section-title"><h2>Detalle de costos</h2>'+(isActive?button('Agregar costo','cost-new',o.id,'compact'):'')+'</div>'+(costs.map(c=>'<div class="movement">'+row(esc(c.description||c.type)+(c.voided?' · Anulado':''),money(c.amount))+'<small>'+esc(c.type)+' · '+date(c.date)+'</small>'+(isActive?'<div class="inline-actions">'+(c.voided?button('Restaurar','cost-restore',c.id,'quiet'):button('Editar','cost-edit',c.id,'quiet')+button('Anular','cost-void',c.id,'quiet danger-text'))+'</div>':'')+'</div>').join('')||empty('Sin costos directos. Los costos registrados en piezas están incluidos arriba.'))+'</section><section class="panel"><h2>Mano de obra por empleado</h2>'+(accruals.map(a=>row(esc(find(d,'employees',a.employeeId)?.name)+' · '+esc(a.work),money(a.total))).join('')||empty('Sin devengos nuevos. Se conservan los costos históricos de las piezas.'))+'<h3>Pagos al empleado vinculados</h3>'+(allocated.map(p=>row(esc(find(d,'employees',p.employeeId)?.name)+' · '+date(p.date),money(p.amount))).join('')||empty('Sin pagos vinculados a esta orden.'))+(legacyPay.length?'<p class="help">Hay '+money(sum(legacyPay,p=>p.amount))+' en pagos históricos de cuentas que incluyen esta orden. No tenían desglose por orden; consulta la cuenta del empleado.</p>':'')+'</section>';
  }else{
    const payments=d.payments.filter(p=>belongs(p,o.id)),events=d.events.filter(e=>belongs(e,o.id)).reverse();
    body='<section class="panel"><h2>Abonos del cliente</h2>'+(payments.map(p=>'<div class="movement">'+row(date(p.date)+' · '+esc(p.method)+(p.voided?' · Anulado':''),money(p.amount))+'<p class="muted">'+esc(p.note)+'</p>'+(isActive?'<div class="inline-actions">'+(p.voided?button('Restaurar','payment-restore',p.id,'quiet'):button('Editar','payment-edit',p.id,'quiet')+button('Anular','payment-void',p.id,'quiet danger-text'))+'</div>':'')+'</div>').join('')||empty('No hay abonos registrados.'))+'</section><section class="panel"><h2>Historial de movimientos</h2>'+(events.map(e=>'<div class="movement"><small>'+esc(new Date(e.at).toLocaleString('es-DO'))+'</small><p>'+esc(e.detail)+'</p></div>').join('')||empty('Los eventos anteriores a Fase 2 no tenían bitácora. Sus registros originales se conservan.'))+'</section><section class="panel"><h2>Comprobantes</h2>'+d.invoices.filter(i=>belongs(i,o.id)).map(i=>row(esc(i.number)+(i.supersededAt?' · Orden reabierta':''),button('Ver','invoice-id',i.id,'quiet'))).join('')+'</section>';
  }
  shell(o.number,'<a class="back" href="#'+(closed(o)?'history':'orders')+'">Volver a '+(closed(o)?'Historial':'Órdenes')+'</a><div class="order-heading"><h2>'+esc(vehicleText(o))+'</h2><p class="muted">'+esc(client(o).name)+' · '+esc(vehicle(o).plate||'Sin placa')+'</p></div>'+banner+tabs+body,menu);
}
function production(){
  const orders=d.orders.filter(active).filter(o=>!finished(d,o));
  shell('Producción',searchBar('Buscar vehículo, cliente o placa')+'<div class="cards">'+(orders.map(o=>'<article class="card searchable" data-search="'+esc([o.number,vehicleText(o),client(o).name,vehicle(o).plate].join(' ').toLowerCase())+'"><a class="card-link" href="#order/'+o.id+'"><div class="split"><small class="gold">'+esc(o.number)+'</small>'+badge(status(d,o))+'</div><h2>'+esc(vehicleText(o))+'</h2></a>'+workUI.productionContent(o)+'</article>').join('')||empty('No hay trabajos pendientes en producción.'))+'</div>');
}
function history(){
  const items=d.orders.filter(o=>closed(o));
  shell('Historial',searchBar('Cliente, teléfono, vehículo, placa, REV o fecha',true)+'<div class="cards">'+(items.sort((a,b)=>String(b.closedAt||'').localeCompare(String(a.closedAt||''))).map(o=>orderCard(o,true)).join('')||empty('Las órdenes finalizadas y entregadas aparecerán aquí.'))+'</div><details class="panel"><summary>Canceladas y archivadas</summary><div class="cards">'+(d.orders.filter(o=>(cancelled(o)||o.archived)&&!closed(o)&&!trashed(o)).map(o=>orderCard(o)).join('')||empty('No hay órdenes canceladas ni archivadas.'))+'</div></details><a class="back" href="#trash">Consultar papelera</a>');
}
function clients(){
  shell('Clientes',searchBar('Buscar nombre o teléfono')+'<div class="cards">'+(d.clients.map(c=>'<article class="card searchable" data-search="'+esc((c.name+' '+c.phone).toLowerCase())+'"><a class="card-link" href="#client/'+c.id+'"><div class="split"><h3>'+esc(c.name)+'</h3>'+(c.archived?badge('Archivado'):'')+'</div><p class="muted">'+esc(c.phone)+'</p>'+row('Vehículos',d.vehicles.filter(v=>Number(v.clientId)===Number(c.id)).length)+'</a></article>').join('')||empty('Crea el primer cliente para comenzar.'))+'</div>',button('Nuevo cliente','client-new','','primary'));
}
function clientPage(){
  const c=find(d,'clients',id);if(!c)return;
  const vehicles=d.vehicles.filter(v=>Number(v.clientId)===Number(c.id)),orders=d.orders.filter(o=>Number(o.clientId)===Number(c.id));
  shell(c.name,'<a class="back" href="#clients">Volver a clientes</a><section class="panel">'+row('Teléfono',esc(c.phone))+row('WhatsApp',esc(c.whatsapp||'—'))+row('Pendiente',money(sum(orders.filter(o=>!cancelled(o)),o=>balance(d,o))))+'<div class="inline-actions">'+button(c.archived?'Restaurar cliente':'Archivar cliente',c.archived?'client-restore':'client-archive',c.id,'quiet')+'</div></section><section><div class="section-title"><h2>Vehículos</h2>'+button('Agregar vehículo','vehicle-new',c.id,'compact')+'</div><div class="cards">'+(vehicles.map(v=>'<article class="card">'+row(esc(v.brand+' '+v.model),badge(v.archived?'Archivado':v.plate||'Sin placa'))+'<div class="inline-actions">'+button('Editar','vehicle-edit',v.id,'quiet')+button(v.archived?'Restaurar':'Archivar',v.archived?'vehicle-restore':'vehicle-archive',v.id,'quiet')+'</div></article>').join('')||empty('Sin vehículos registrados.'))+'</div></section><section><h2>Órdenes</h2><div class="cards">'+orders.map(o=>orderCard(o,closed(o))).join('')+'</div></section>',button('Editar cliente','client-edit',c.id));
}
function employees(){
  shell('Empleados','<div class="cards">'+(d.employees.map(e=>{const s=employeeSummary(d,e.id);return '<a class="card card-link" href="#employee/'+e.id+'"><div class="split"><h3>'+esc(e.name)+'</h3>'+badge(e.active===false?'Inactivo':e.role||'Empleado')+'</div><p class="muted">'+s.pieces+' piezas terminadas · '+s.pending+' asignadas pendientes</p>'+row('Devengado',money(s.generated))+row('Pagado',money(s.paid))+row('Por pagar',money(s.balance))+'</a>';}).join('')||empty('Agrega empleados y asígnalos a las piezas.'))+'</div>',button('Agregar empleado','employee-new','','primary'));
}
function employeePage(){
  const e=find(d,'employees',id);if(!e)return;
  const s=employeeSummary(d,id),accounts=d.ledgerAccounts.filter(a=>Number(a.employeeId)===Number(id));
  shell(e.name,'<a class="back" href="#employees">Volver a empleados</a><div class="metrics">'+metric('Piezas terminadas',s.pieces)+metric('Devengado',money(s.generated))+metric('Pagado',money(s.paid))+metric('Por pagar',money(s.balance))+'</div><section><h2>Cuentas</h2><div class="cards">'+(accounts.map(a=>'<article class="card"><div class="split"><h3>Cuenta '+a.number+'</h3>'+badge(a.status)+'</div>'+row('Devengado',money(a.generated))+row('Pendiente',money(a.balance))+(a.status!=='CERRADA'&&n(a.balance)>0?button('Registrar pago','employee-pay',a.id,'primary'):a.status==='PAGADA'?button('Cerrar cuenta pagada','account-close',a.id):'')+'</article>').join('')||empty('La cuenta se crea al terminar el primer trabajo asignado.'))+'</div></section><section class="panel"><h2>Trabajos asignados y terminados</h2>'+(s.assignments.map(a=>workUI.employeeAssignment(a)).join('')||empty('Sin trabajos asignados.'))+'</section><section class="panel"><h2>Historial de pagos</h2>'+(d.ledgerPayments.filter(p=>Number(p.employeeId)===Number(e.id)).map(p=>'<div class="movement">'+row(date(p.date)+' · '+esc(p.method||'No registrado')+(p.voided?' · Anulado':''),money(p.amount))+'<p class="muted">'+esc(p.note)+'</p>'+(!p.voided&&find(d,'ledgerAccounts',p.accountId)?.status!=='CERRADA'?'<div class="inline-actions">'+button('Editar','employee-payment-edit',p.id,'quiet')+button('Anular','employee-payment-void',p.id,'quiet danger-text')+'</div>':'')+'</div>').join('')||empty('Terminar el trabajo genera el devengo; el pago se registra aquí por separado.'))+'</section>',button('Editar','employee-edit',e.id));
}
function inventory(){
  const low=d.inventory.filter(p=>n(p.quantity)<=n(p.minimum));
  shell('Inventario',(low.length?'<div class="notice">'+low.length+' productos con stock bajo.</div>':'')+searchBar('Buscar producto o categoría')+'<div class="cards">'+(d.inventory.map(p=>'<a class="card card-link searchable" data-search="'+esc((p.name+' '+p.category).toLowerCase())+'" href="#product/'+p.id+'"><div class="split"><h3>'+esc(p.name)+'</h3>'+badge(n(p.quantity)<=n(p.minimum)?'Stock bajo':p.category)+'</div>'+row('Existencia',n(p.quantity)+' '+esc(p.unit))+row('Valor aproximado',money(n(p.quantity)*n(p.unitCost)))+'</a>').join('')||empty('Registra tus materiales y sus movimientos.'))+'</div>',button('Nuevo producto','product-new','','primary'));
}
function productPage(){
  const p=find(d,'inventory',id);if(!p)return;
  shell(p.name,'<a class="back" href="#inventory">Volver a inventario</a><div class="metrics">'+metric('Cantidad',n(p.quantity)+' '+esc(p.unit))+metric('Costo unitario',money(p.unitCost))+metric('Valor aproximado',money(n(p.quantity)*n(p.unitCost)))+metric('Stock mínimo',n(p.minimum))+'</div><div class="inline-actions">'+button('Entrada','inventory-entry',p.id,'primary')+button('Salida','inventory-exit',p.id)+button('Ajuste','inventory-adjustment',p.id)+'</div><section class="panel">'+row('Categoría',esc(p.category))+row('Proveedor',esc(p.supplier||'—'))+row('Última compra',date(p.lastPurchaseDate))+'<p>'+esc(p.notes)+'</p></section><section class="panel"><h2>Historial de movimientos</h2>'+d.inventoryMoves.filter(m=>m.productId===p.id).reverse().map(m=>'<div class="movement">'+row(({entry:'Entrada',exit:'Salida',adjustment:'Ajuste'}[m.kind])+' · '+date(m.date),(m.delta>0?'+':'')+m.delta+' '+esc(p.unit))+'<p class="muted">'+esc(m.note)+' · Stock final: '+m.after+'</p></div>').join('')+'<p class="help">Las salidas todavía no crean costos en órdenes. Registra el consumo de cada trabajo en su rentabilidad.</p></section>',button('Editar producto','product-edit',p.id));
}
function monthPage(){
  const snapshot=d.monthlyClosures.find(x=>x.month===selectedMonth),m=snapshot?.metrics||monthly(d,selectedMonth);
  shell('Cierre mensual','<div class="filters">'+field('Período','period',selectedMonth,'month')+'</div>'+(snapshot?'<div class="notice">Mes cerrado el '+date(snapshot.closedAt)+'. Estás viendo la instantánea guardada.</div>':'<p class="help">Período abierto. '+esc(m.basis)+'</p>')+'<div class="metrics">'+metric('Total vendido',money(m.sold))+metric('Realmente cobrado',money(m.cash))+metric('Por cobrar al cierre',money(m.receivables))+metric('Ganancia del período',money(m.profit))+'</div><div class="cards"><section class="panel"><h2>Costos y resultado</h2>'+row('Materiales',money(m.materials))+row('Mano de obra',money(m.labor))+row('Otros gastos',money(m.others))+row('Costos del período',money(m.costs))+row('Margen',m.margin+'%')+'</section><section class="panel"><h2>Operación</h2>'+row('Órdenes abiertas en el mes',m.opened)+row('Órdenes cerradas / entregas',m.closed)+row('Vehículos distintos entregados',m.vehicles)+row('Piezas terminadas con fecha',m.pieces)+'</section><section class="panel"><h2>Empleados</h2>'+row('Devengado en el mes',money(m.generated))+row('Pagado en el mes',money(m.employeePaid))+row('Saldo acumulado al cierre',money(m.employeeBalance))+'</section><section class="panel"><h2>Inventario</h2>'+row('Compras del mes',money(m.purchases))+row('Consumo registrado',money(m.consumption))+'<p class="help">Compras no equivale a costo consumido en los trabajos.</p></section></div>'+(m.undatedCount||m.undatedClosures?'<div class="notice">'+m.undatedCount+' costos históricos sin fecha ('+money(m.undatedCosts)+') y '+m.undatedClosures+' cierres sin fecha real. Se conservan en el historial y no se asignan a un mes inventado. El resultado mensual puede estar incompleto.</div>':'')+(!snapshot?button('Cerrar mes y guardar instantánea','month-close',selectedMonth):''));
}
function settings(){
  const s=d.settings[0],issues=audit(d),a=appearance();
  shell('Configuración','<section class="panel"><h2>Datos del taller</h2><form data-form="settings" class="form">'+field('Nombre del taller','name',s.name,'text','required')+field('Teléfono','phone',s.phone,'tel')+field('WhatsApp','whatsapp',s.whatsapp,'tel')+field('Correo','email',s.email,'email')+field('Dirección','address',s.address)+field('RNC / Cédula','document',s.document)+field('Prefijo de órdenes','prefix',s.prefix)+'<div class="full"><button class="btn">Guardar datos</button></div></form><h3>Logo</h3>'+(s.logoData?'<img class="logo-preview" src="'+esc(s.logoData)+'" alt="Logo del taller">':'')+'<label class="field"><span>Subir logo (PNG, JPG o WEBP · máximo 2 MB)</span><input type="file" id="logo" accept="image/png,image/jpeg,image/webp"></label></section><section class="panel appearance-panel"><p class="eyebrow">Tu identidad</p><h2>Apariencia</h2><p class="muted">El logo genera una paleta automática. Puedes afinarla manualmente.</p>'+button('Usar colores del logo','palette-auto','','quiet')+'<div class="palette-swatches">'+(s.palette||[]).map(color=>'<span style="background:'+esc(color)+'" title="'+esc(color)+'"></span>').join('')+'</div><form data-form="appearance" class="form">'+select('Tema','theme',[['dark','Oscuro'],['light','Claro']],a.theme)+field('Color principal','primary',a.primary,'color')+field('Color secundario / acento','accent',a.accent,'color')+'<div class="full"><button class="btn primary">Guardar apariencia</button></div></form></section>'+workUI.settingsExtra()+'<section class="panel"><h2>Copias de seguridad</h2><p class="help">Tus datos se guardan en este navegador y esta dirección. Exporta una copia antes de cambiar de dispositivo o borrar datos del navegador.</p><div class="inline-actions">'+button('Exportar todos los datos','export','','primary')+button('Importar copia','import')+'</div><input type="file" id="backup-file" accept=".json,application/json" hidden><h3>Recuperación</h3><p>'+d.snapshots.length+' instantáneas locales conservadas.</p>'+button('Descargar copia previa a 2.3','recovery-work','','quiet')+button('Descargar recuperación inicial','recovery','','quiet')+'</section><section class="panel"><h2>Revisión de datos</h2>'+(issues.length?issues.map(x=>'<p class="notice">'+esc(x.message)+' · Registro '+esc(x.id)+'</p>').join(''):'<p>No se detectaron referencias rotas, números repetidos ni excesos de cobro en la revisión automática.</p>')+'</section><section class="panel"><h2>TallerOS '+VERSION+'</h2><p>Dirección actual</p><p class="url">'+esc(location.origin+location.pathname)+'</p>'+button('Instalar en el teléfono','install')+'</section>');
}
function openDialog(title,body,type=null,context={},submit='Guardar'){
  dialog.classList.remove('document-dialog');
  previousFocus=document.activeElement;formContext={...context,invoice:context.invoice||formContext.invoice};
  dialog.innerHTML='<div class="dialog-top"><h2>'+esc(title)+'</h2>'+button('×','dialog-close','','icon')+'</div>'+(type?'<form class="form" data-form="'+type+'">'+body+'<p class="form-error full" role="alert"></p><div class="dialog-actions full">'+button('Cancelar','dialog-close')+'<button class="btn primary">'+submit+'</button></div></form>':body);
  if(!dialog.open)dialog.showModal();
}
function confirmAction(title,message,action,target,label='Confirmar'){
  openDialog(title,'<p>'+message+'</p><div class="dialog-actions">'+button('Cancelar','dialog-close')+button(label,action,target,'primary')+'</div>');
}
function paymentForm(orderId,paymentId){
  const o=find(d,'orders',orderId),p=paymentId?find(d,'payments',paymentId):{};
  openDialog('Cobrar · '+o.number,'<p class="full help">Saldo pendiente: '+money(balance(d,o))+'</p>'+field('Monto recibido','amount',p.amount??balance(d,o),'number','required')+select('Método de pago','method',METHODS,p.method||'Efectivo')+field('Fecha','date',p.date||today(),'date','required')+textarea('Nota opcional','note',p.note),'payment',{orderId:o.id,id:paymentId},'Guardar pago');
}
function orderForm(orderId){
  const o=orderId?find(d,'orders',orderId):{};
  const cs=d.clients.filter(c=>!c.archived||c.id===o.clientId),cId=o.clientId||cs[0]?.id;
  openDialog(orderId?'Editar '+o.number:'Nueva orden',select('Cliente','clientId',cs.map(c=>[c.id,c.name]),cId,'required')+select('Vehículo','vehicleId',[['','Seleccionar'],...d.vehicles.filter(v=>v.clientId===Number(cId)&&(!v.archived||v.id===o.vehicleId)).map(v=>[v.id,[v.brand,v.model,v.plate].filter(Boolean).join(' · ')])],o.vehicleId,'required')+'<div class="inline-actions full">'+button('Nuevo cliente','client-new','','quiet')+button('Agregar vehículo','vehicle-from-order','','quiet')+'</div>'+field('Precio acordado','total',o.total||0,'number','required')+field('Fecha de entrada','entryDate',o.entryDate||today(),'date','required')+field('Entrega prevista','dueDate',o.dueDate,'date',orderId?'':'required')+(!orderId?documentUI.creationFields():'')+textarea('Condiciones del trabajo','workConditions',o.workConditions)+textarea('Observaciones de recepción','receptionNotes',o.receptionNotes)+textarea('Notas internas (no salen en factura)','notes',o.notes)+textarea('Notas para el cliente','customerNotes',o.customerNotes),'order',{id:orderId,creationToken:orderId?null:crypto.randomUUID()},'Guardar orden');
}
function costForm(orderId,costId){
  const c=costId?find(d,'costs',costId):{};
  openDialog(costId?'Editar costo':'Agregar costo',select('Tipo','type',['Materiales','Otros costos',...(c.type==='Mano de obra'?['Mano de obra']:[])],c.type||'Materiales')+field('Concepto','description',c.description||c.concept,'text','required')+field('Monto total','amount',c.amount,'number','required')+field('Cantidad','quantity',c.quantity||1,'number','required')+field('Fecha del costo','date',c.date||today(),'date','required'),'cost',{orderId,id:costId},'Guardar costo');
}
function employeeForm(employeeId){
  const e=employeeId?find(d,'employees',employeeId):{};
  openDialog(employeeId?'Editar empleado':'Agregar empleado',field('Nombre','name',e.name,'text','required')+field('Teléfono','phone',e.phone,'tel')+field('Puesto','role',e.role,'text','required list="roles"')+'<datalist id="roles">'+['Desabollador','Preparador','Empapelador/Desarmador','Pintor','Brillador',...(d.settings[0].customRoles||[])].map(r=>'<option value="'+esc(r)+'">').join('')+'</datalist>'+field('Tarifa por pieza','pieceRate',e.pieceRate||0,'number')+field('Pago fijo de referencia','fixedPay',e.fixedPay||0,'number')+select('Estado','active',[['true','Activo'],['false','Inactivo']],String(e.active!==false)),'employee',{id:employeeId},'Guardar empleado');
}
function clientForm(clientId){
  const c=clientId?find(d,'clients',clientId):{};
  openDialog(clientId?'Editar cliente':'Nuevo cliente',field('Nombre completo','name',c.name,'text','required autocomplete="name"')+field('Teléfono','phone',c.phone,'tel','required autocomplete="tel"')+field('WhatsApp','whatsapp',c.whatsapp,'tel')+'<details class="full"><summary>Más datos</summary>'+field('Cédula / RNC','document',c.document)+field('Dirección','address',c.address)+textarea('Notas','notes',c.notes)+'</details>','client',{id:clientId},'Guardar cliente');
}
function vehicleForm(vehicleId,clientId){
  const v=vehicleId?find(d,'vehicles',vehicleId):{};
  openDialog(vehicleId?'Editar vehículo':'Agregar vehículo',select('Cliente','clientId',d.clients.filter(c=>!c.archived||c.id===v.clientId).map(c=>[c.id,c.name]),v.clientId||clientId)+field('Marca','brand',v.brand,'text','required')+field('Modelo','model',v.model,'text','required')+field('Año','year',v.year,'number','min="1900" max="2100" step="1"')+field('Placa','plate',v.plate)+field('Color','color',v.color)+'<details class="full"><summary>Más datos</summary>'+field('VIN','vin',v.vin)+textarea('Notas','notes',v.notes)+'</details>','vehicle',{id:vehicleId},'Guardar vehículo');
}
function productForm(productId){
  const p=productId?find(d,'inventory',productId):{};
  openDialog(productId?'Editar producto':'Nuevo producto',field('Producto','name',p.name,'text','required')+select('Categoría','category',CATEGORIES,p.category||'Pintura')+field('Unidad (litro, unidad, galón…)','unit',p.unit||'unidad','text','required')+(!productId?field('Cantidad inicial','quantity',0,'number'):'')+field('Costo unitario','unitCost',p.unitCost||0,'number',productId&&p.quantity?'readonly':'')+field('Stock mínimo','minimum',p.minimum||0,'number')+field('Proveedor opcional','supplier',p.supplier)+textarea('Notas','notes',p.notes),'product',{id:productId},'Guardar producto');
}
function filterCards(){
  const term=(document.querySelector('#search')?.value||'').trim().toLocaleLowerCase(),val=name=>document.querySelector('[name="'+name+'"]')?.value||'';
  for(const card of document.querySelectorAll('.searchable')){
    const date=card.dataset.date||'';
    card.hidden=!(card.dataset.search||'').includes(term)||(val('historyMonth')&&!date.startsWith(val('historyMonth')))||(val('historyYear')&&!date.startsWith(val('historyYear')))||(val('historyStart')&&date<val('historyStart'))||(val('historyEnd')&&(!date||date>val('historyEnd')));
  }
}
async function render(){
  d=await service.state();applyAppearance();[route,id]=location.hash.slice(1).split('/');route ||= 'home';
  if(route==='home')home();else if(route==='orders')shell('Órdenes',searchBar('Buscar REV, cliente, vehículo o placa')+'<div class="cards">'+(d.orders.filter(active).map(o=>orderCard(o)).join('')||empty('No hay órdenes activas.'))+'</div>',button('Nueva orden','order-new','','primary'));
  else if(route==='order')orderPage();else if(route==='production')production();else if(route==='history')history();else if(route==='clients')clients();else if(route==='client')clientPage();else if(route==='employees')employees();else if(route==='employee')employeePage();else if(route==='inventory')inventory();else if(route==='product')productPage();else if(route==='monthly')monthPage();else if(route==='settings')settings();
  else if(route==='finance')shell('Finanzas','<p class="help">Precio acordado, dinero cobrado y costos se consultan en una única vista de rentabilidad dentro de cada orden.</p><div class="cards">'+d.orders.filter(o=>!trashed(o)).map(o=>orderCard(o,closed(o))).join('')+'</div>');
  else if(route==='trash')shell('Papelera','<div class="cards">'+(d.orders.filter(trashed).map(o=>'<article class="card"><h3>'+esc(o.number)+'</h3><p>'+esc(vehicleText(o))+'</p>'+button('Ver detalle conservado','open-order',o.id)+button('Restaurar','order-restore',o.id)+'</article>').join('')||empty('No hay órdenes en papelera.'))+'</div>');
  else shell('Más','<div class="more-grid">'+['history','employees','inventory','monthly','finance','settings','trash'].map(r=>'<a class="card card-link" href="#'+r+'"><h2>'+names[r]+'</h2></a>').join('')+'</div>');
  if(pendingReception&&route==='order'&&String(pendingReception.orderId)===String(id)){documentUI.show(pendingReception);pendingReception=null;}
}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function handleAction(action,target){
  if(action==='palette-auto'){await ensureLogo(true);await render();toast('Paleta del logo aplicada.');return;}
  if(await documentUI.handleAction(action,target))return;
  if(await workUI.handleAction(action,target))return;
  if(action==='dialog-close'){dialog.close();return;}
  if(action==='order-new'){orderForm();return;}
  if(action==='order-edit'){orderForm(target);return;}
  if(action==='order-tab'){orderTab=target;orderPage();return;}
  if(action==='open-order'){navigate('order/'+target);return;}
  if(action==='order-menu'){
    const o=find(d,'orders',target);
    openDialog('Opciones · '+o.number,'<div class="menu-list">'+(active(o)?button('Editar orden','order-edit',o.id)+button('Cancelar orden','order-cancel',o.id,'danger-text')+button('Eliminar orden vacía','order-trash',o.id,'danger-text'):closed(o)||cancelled(o)||o.archived?button('Reabrir orden','order-reopen',o.id):'')+'</div>');return;
  }
  if(action==='client-new'||action==='client-edit'){clientForm(action==='client-edit'?target:null);return;}
  if(action==='vehicle-new'||action==='vehicle-edit'){vehicleForm(action==='vehicle-edit'?target:null,action==='vehicle-new'?target:null);return;}
  if(action==='vehicle-from-order'){const c=dialog.querySelector('[name="clientId"]')?.value;vehicleForm(null,c);return;}
  if(action==='employee-new'||action==='employee-edit'){employeeForm(action==='employee-edit'?target:null);return;}
  if(action==='pay'){paymentForm(target);return;}
  if(action==='payment-edit'){const p=find(d,'payments',target);paymentForm(p.orderId,p.id);return;}
  if(action==='cost-new'||action==='cost-edit'){const c=action==='cost-edit'?find(d,'costs',target):null;costForm(c?.orderId||target,c?.id);return;}
  if(action==='employee-pay'||action==='employee-payment-edit'){
    const p=action==='employee-payment-edit'?find(d,'ledgerPayments',target):{},a=find(d,'ledgerAccounts',p.accountId||target);
    openDialog('Pago al empleado','<p class="full help">Saldo: '+money(a.balance)+'</p>'+field('Monto','amount',p.amount||a.balance,'number','required')+select('Método','method',METHODS,p.method||'Efectivo')+field('Fecha','date',p.date||today(),'date','required')+textarea('Nota','note',p.note),'employee-payment',{accountId:a.id,id:p.id},'Guardar pago');return;
  }
  if(action==='product-new'||action==='product-edit'){productForm(action==='product-edit'?target:null);return;}
  if(action.startsWith('inventory-')){
    const kind=action.slice(10),p=find(d,'inventory',target);
    openDialog({entry:'Entrada',exit:'Salida',adjustment:'Ajuste'}[kind]+' · '+p.name,field(kind==='adjustment'?'Nueva cantidad total':'Cantidad','quantity',kind==='adjustment'?p.quantity:'','number','required')+(kind==='entry'?field('Costo unitario de compra','unitCost',p.unitCost,'number','required'):'')+field('Fecha','date',today(),'date','required')+textarea('Nota / motivo','note'),'inventory-move',{id:p.id,kind},'Guardar movimiento');return;
  }
  const confirmMap={
    'part-finish':['Terminar trabajo','Se registrará el trabajo terminado y su mano de obra devengada. El pago al empleado y la entrega del vehículo quedan pendientes.','part-finish-confirm','Terminar trabajo'],
    'work-finish':['Trabajo terminado','Confirma que terminaste los trabajos sin piezas registradas. La orden todavía deberá cobrarse y entregarse.','work-finish-confirm','Marcar terminado'],
    'order-reopen':['Reabrir orden','Permitirás editar nuevamente esta orden. Su comprobante anterior y movimientos se conservan.','order-reopen-confirm','Reabrir orden'],
    'order-cancel':['Cancelar orden','La orden saldrá de la operación. Sus cobros, costos y mano de obra se conservarán.','order-cancel-confirm','Cancelar orden'],
    'order-trash':['Eliminar orden vacía','Solo se permite enviar a papelera órdenes sin piezas, pagos ni costos. Podrás restaurarla.','order-trash-confirm','Enviar a papelera'],
    'account-close':['Cerrar cuenta','La cuenta pagada quedará bloqueada para conservar su historial.','account-close-confirm','Cerrar cuenta'],
    'month-close':['Cerrar mes','Guardarás una instantánea del mes '+esc(target)+'. Incluye las advertencias de datos sin fecha y no cambiará con ediciones posteriores.','month-close-confirm','Guardar cierre'],
    'payment-void':['Anular abono','El registro se conserva; dejará de reducir el saldo.','payment-void-confirm','Anular abono'],
    'cost-void':['Anular costo','El registro se conserva; dejará de afectar la rentabilidad.','cost-void-confirm','Anular costo'],
    'employee-payment-void':['Anular pago','El saldo del empleado volverá a quedar pendiente. No cambia el costo del trabajo.','employee-payment-void-confirm','Anular pago'],
    'part-reopen':['Reabrir pieza','Volverá a Preparación. Sus devengos y pagos se conservan; terminarla otra vez no generará un devengo duplicado.','part-reopen-confirm','Reabrir']
  };
  if(confirmMap[action]){const [title,body,next,label]=confirmMap[action];confirmAction(title,body,next,target,label);return;}
  const mutations={
    'part-finish-confirm':()=>service.finishPart(target),'work-finish-confirm':()=>service.markFinished(target),
    'order-reopen-confirm':()=>service.reopen(target),'order-cancel-confirm':()=>service.cancel(target),'order-trash-confirm':()=>service.trash(target),'order-restore':()=>service.restoreOrder(target),
    'account-close-confirm':()=>service.closeAccount(target),'month-close-confirm':()=>service.closeMonth(target),
    'payment-void-confirm':()=>service.voidMovement('payments',target),'payment-restore':()=>service.voidMovement('payments',target,true),
    'cost-void-confirm':()=>service.voidMovement('costs',target),'cost-restore':()=>service.voidMovement('costs',target,true),
    'employee-payment-void-confirm':()=>service.voidMovement('ledgerPayments',target),
    'part-remove-confirm':()=>service.archive('parts',target),'part-restore':()=>service.archive('parts',target,true),
    'client-archive':()=>service.archive('clients',target),'client-restore':()=>service.archive('clients',target,true),
    'vehicle-archive':()=>service.archive('vehicles',target),'vehicle-restore':()=>service.archive('vehicles',target,true)
  };
  if(mutations[action]){await mutations[action]();dialog.close();await render();toast('Cambios guardados.');return;}
  if(action==='recovery-work'){download('TallerOS-antes-modelo-piezas-'+today()+'.json',JSON.stringify(await service.storage.previousModelBackup(),null,2));return;}
  if(action==='export'){download('TallerOS-copia-'+today()+'.json',JSON.stringify(await service.storage.export(),null,2));toast('Copia completa descargada.');return;}
  if(action==='recovery'){const s=d.snapshots.find(s=>s.id==='before-phase2');if(s)download('TallerOS-recuperacion-antes-fase2.json',JSON.stringify({format:'TallerOS-backup',version:1,workshopId:1,main:s.payload.main,ledger:{accounts:s.payload.ledger.accounts||[],accruals:s.payload.ledger.accruals||[],payments:s.payload.ledger.payments||[]}},null,2));return;}
  if(action==='import'){document.querySelector('#backup-file').click();return;}
  if(action==='import-confirm'){await service.storage.import(pendingImport);pendingImport=null;dialog.close();await render();toast('Copia importada. Se conservó una recuperación previa.');return;}
  if(action==='install'){openDialog('Instalar TallerOS','<p>En iPhone abre esta dirección en Safari, toca Compartir y luego “Añadir a pantalla de inicio”. En Android usa “Instalar aplicación” en el menú del navegador.</p><p class="help">La instalación y los datos pertenecen a este dispositivo. Guarda una copia antes de cambiarlo.</p>');}
}
document.addEventListener('click',async event=>{
  const control=event.target.closest('[data-action]');if(!control||busy)return;
  if(control.dataset.action==='reception-remove'){control.closest('.reception-piece').remove();return;}
  busy=true;control.disabled=true;
  try{await handleAction(control.dataset.action,control.dataset.id);}catch(error){if(error.name!=='AbortError')toast(error.message);}
  finally{busy=false;if(control.isConnected)control.disabled=false;}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.form)return;event.preventDefault();if(busy)return;busy=true;
  const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit)submit.disabled=true;
  const v=Object.fromEntries(new FormData(form)),c=formContext;
  try{
    let saved,destination;
    if(await documentUI.submit(form,c))return;
    const workHandled=await workUI.submit(form,c);
    if(workHandled==='keep-dialog')return;
    if(!workHandled)switch(form.dataset.form){
      case 'client':saved=await service.saveClient(v,c.id);destination='client/'+saved.id;break;
      case 'vehicle':saved=await service.saveVehicle(v,c.id);destination='client/'+saved.clientId;break;
      case 'employee':saved=await service.saveEmployee(v,c.id);destination='employee/'+saved.id;break;
      case 'order':saved=await service.saveOrder({...v,...(!c.id?documentUI.creationValues(form):{}),creationToken:c.creationToken},c.id);destination='order/'+saved.id;orderTab='work';if(!c.id)pendingReception=saved.initialReceipt;break;
      case 'payment':await service.payment(c.orderId,v,c.id);destination='order/'+c.orderId;break;
      case 'cost':await service.cost(c.orderId,v,c.id);orderTab='profit';destination='order/'+c.orderId;break;
      case 'employee-payment':await service.employeePayment(c.accountId,v,c.id);break;
      case 'product':saved=await service.saveProduct(v,c.id);destination='product/'+saved.id;break;
      case 'inventory-move':await service.inventoryMove(c.id,{...v,kind:c.kind});break;
      case 'settings':await service.settings(v);break;
      case 'appearance':await service.settings({appearance:{...v,mode:'manual'}});break;
    }
    dialog.close();await render();if(destination)navigate(destination);
    const messages={order:c.id?'Orden actualizada correctamente.':'Orden creada correctamente. Comprobante inicial generado.',payment:c.id?'Pago actualizado.':'Pago registrado.',cost:'Costo registrado.',client:c.id?'Cliente actualizado.':'Cliente creado correctamente.',vehicle:c.id?'Vehículo actualizado.':'Vehículo creado correctamente.','employee-payment':'Pago al empleado registrado.'};
    toast(messages[form.dataset.form]||'Guardado correctamente.');
  }catch(error){const errorEl=form.querySelector('.form-error');if(errorEl)errorEl.textContent=error.message;else toast(error.message);}
  finally{busy=false;if(submit?.isConnected)submit.disabled=false;}
});
document.addEventListener('input',event=>{
  if(event.target.matches('[data-filter]'))filterCards();
  if(event.target.matches('[data-piece-search]')){
    const term=event.target.value.toLocaleLowerCase();event.target.closest('form').querySelectorAll('.piece-choice').forEach(el=>el.hidden=!el.textContent.toLocaleLowerCase().includes(term));
  }
  if(event.target.closest('[data-form="work-assignment"],[data-form="order-pieces"]'))workUI.updatePicker();
});
document.addEventListener('change',async event=>{
  const target=event.target;
  try{
    if(target.name==='receptionPieceName'&&documentUI.isFullPaint(target.value))documentUI.expandFullPaint();
    if(target.name==='period'){selectedMonth=target.value||today().slice(0,7);monthPage();}
    if(target.name==='clientId'&&target.closest('[data-form="order"]')){const s=dialog.querySelector('[name="vehicleId"]');s.innerHTML='<option value="">Seleccionar</option>'+d.vehicles.filter(v=>v.clientId===Number(target.value)&&!v.archived).map(v=>'<option value="'+v.id+'">'+esc(v.brand+' '+v.model+' '+(v.plate||''))+'</option>').join('');}
    if(target.name==='employeeId'&&target.closest('[data-form="work-assignment"]')&&!formContext.locked)dialog.querySelector('[name="rate"]').value=find(d,'employees',target.value)?.pieceRate||0;
    if(target.closest('[data-form="work-assignment"],[data-form="order-pieces"]'))workUI.updatePicker();
    if(target.id==='backup-file'){
      const file=target.files[0];if(!file)return;if(file.size>100*1024*1024)throw Error('La copia supera 100 MB.');
      pendingImport=JSON.parse(await file.text());service.storage.validate(pendingImport);
      confirmAction('Importar copia','Se reemplazarán los datos de este taller por la copia seleccionada. Primero se guardará una recuperación local completa.','import-confirm','','Importar y reemplazar');
    }
    if(target.id==='logo'){
      const file=target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('Selecciona PNG, JPG o WEBP de hasta 2 MB.');
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
      await service.settings({logoData:data});await ensureLogo(true);await render();toast('Logo guardado.');
    }
  }catch(e){toast(e.message);}
});
dialog.addEventListener('close',()=>previousFocus?.isConnected&&previousFocus.focus());
window.addEventListener('hashchange',()=>{dialog.close();window.scrollTo(0,0);render().catch(e=>toast(e.message));});
window.addEventListener('talleros-blocked',()=>{app.innerHTML='<main><h1>Cierra las otras pestañas de TallerOS</h1><p>La actualización necesita que cierres la versión anterior en este navegador. No borres datos. Esta pantalla continuará cuando se libere el almacenamiento.</p></main>';});
window.addEventListener('talleros-versionchange',()=>{app.innerHTML='<main><h1>Hay una nueva versión</h1><p>Recarga esta pestaña para seguir trabajando.</p></main>';});
try{await service.init();await ensureLogo();await render();}catch(error){app.innerHTML='<main><h1>No se pudo abrir TallerOS</h1><p>'+esc(error.message)+'</p><p>Conserva los datos del navegador y vuelve a intentar. No borres IndexedDB.</p></main>';}

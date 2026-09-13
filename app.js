const DB='talleros2',WID=1,stores=['settings','clients','vehicles','orders','parts','employees','payments','costs'];let view='home',tab='summary';const A=document.querySelector('#app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=x=>new Intl.NumberFormat('es-DO',{style:'currency',currency:'DOP',maximumFractionDigits:0}).format(+x||0),date=x=>x||'—';
const db=new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>stores.forEach(s=>r.result.objectStoreNames.contains(s)||r.result.createObjectStore(s,{keyPath:'id',autoIncrement:true}));r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const api={all:async s=>{let d=await db;return new Promise((ok,no)=>{let r=d.transaction(s).objectStore(s).getAll();r.onsuccess=()=>ok(r.result.filter(x=>x.workshopId===WID));r.onerror=()=>no(r.error)})},get:async(s,id)=>{let d=await db;return new Promise((ok,no)=>{let r=d.transaction(s).objectStore(s).get(+id);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})},put:async(s,x)=>{let d=await db;return new Promise((ok,no)=>{let r=d.transaction(s,'readwrite').objectStore(s).put(x);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})},del:async(s,id)=>{let d=await db;return new Promise((ok,no)=>{let r=d.transaction(s,'readwrite').objectStore(s).delete(+id);r.onsuccess=ok;r.onerror=()=>no(r.error)})}};
async function init(){if((await api.all('settings')).length)return;await api.put('settings',{id:1,workshopId:WID,name:'RevivAuto',phone:'',whatsapp:'',address:'',currency:'RD$',prefix:'REV',painterRate:350})}async function data(){let d={};for(let s of stores)d[s]=await api.all(s);return d}const cn=(d,id)=>d.clients.find(x=>x.id===id)?.name||'—',vn=(d,id)=>{let v=d.vehicles.find(x=>x.id===id);return v?`${v.brand} ${v.model} · ${v.plate||'Sin placa'}`:'—'},paid=(d,id)=>d.payments.filter(x=>x.orderId===id).reduce((a,x)=>a+(+x.amount),0),cost=(d,id)=>d.costs.filter(x=>x.orderId===id).reduce((a,x)=>a+(+x.amount),0)+d.parts.filter(x=>x.orderId===id).reduce((a,x)=>a+(+x.materialCost||0)+(+x.laborCost||0)+(+x.otherCost||0),0);
function shell(title,body,action=''){let nav=[['home','Inicio'],['orders','Órdenes'],['clients','Clientes'],['production','Producción'],['finance','Finanzas'],['settings','Configuración']];return `<div class="shell"><aside class="side"><div class="brand"><b>TallerOS</b><small>Todo tu taller en un solo lugar</small></div><nav class="nav">${nav.map(x=>`<button class="${view===x[0]?'on':''}" onclick="go('${x[0]}')">${x[1]}</button>`).join('')}</nav></aside><main class="main"><header class="top"><div><div class="eyebrow">RevivAuto · Taller de desabolladura y pintura</div><h1>${title}</h1></div>${action}</header>${body}</main></div>`}function table(h,rs,f){return `<table class="table"><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rs.length?rs.map(f).join(''):`<tr><td colspan="${h.length}" class="muted">Sin registros.</td></tr>`}</tbody></table>`}
async function render(){try{let d=await data();if(view==='home'){let active=d.orders.filter(o=>!['Entregada','Cancelada','Cotización'].includes(o.status)),done=d.orders.filter(o=>o.status==='Lista para entregar'),rev=d.orders.reduce((s,o)=>s+(+o.total||0),0),p=d.payments.reduce((s,x)=>s+(+x.amount),0),c=d.orders.reduce((s,o)=>s+cost(d,o.id),0);A.innerHTML=shell('Inicio',`<div class="stats"><div class="stat"><span>Vehículos en taller</span><b>${active.length}</b></div><div class="stat"><span>Trabajos activos</span><b>${active.length}</b></div><div class="stat"><span>Listos para entregar</span><b>${done.length}</b></div><div class="stat"><span>Dinero pendiente</span><b>${money(rev-p)}</b></div><div class="stat"><span>Ingresos</span><b>${money(p)}</b></div><div class="stat"><span>Gastos</span><b>${money(c)}</b></div><div class="stat"><span>Ganancia estimada</span><b>${money(rev-c)}</b></div></div><div class="panel"><h2>Órdenes recientes</h2>${table(['Número','Cliente','Vehículo','Estado','Balance'],d.orders.slice(-8).reverse(),o=>`<tr><td><button class="link" onclick="orderModal(${o.id})">${o.number}</button></td><td>${esc(cn(d,o.clientId))}</td><td>${esc(vn(d,o.vehicleId))}</td><td><span class="badge">${o.status}</span></td><td>${money((+o.total)-paid(d,o.id))}</td></tr>`)}</div>`,`<button class="btn primary" onclick="orderModal()">+ Nueva orden</button>`)}else if(view==='clients')clients(d);else if(view==='orders')orders(d);else if(view==='production')production(d);else if(view==='finance')finance(d);else settings(d)}catch(e){A.innerHTML=`<main class="loading"><div class="error">No se pudo cargar TallerOS: ${esc(e.message)}</div></main>`}}
function go(v){view=v;render()}function clients(d){A.innerHTML=shell('Clientes',`<div class="panel"><div class="bar"><input class="search" placeholder="Buscar por nombre o teléfono" oninput="search(this)"><button class="btn primary" onclick="clientModal()">+ Nuevo cliente</button></div>${table(['Cliente','Teléfono','WhatsApp','Vehículos',''],d.clients,c=>`<tr class="row"><td><button class="link" onclick="clientModal(${c.id})">${esc(c.name)}</button></td><td>${esc(c.phone)}</td><td>${esc(c.whatsapp||'—')}</td><td>${d.vehicles.filter(v=>v.clientId===c.id).length}</td><td><button class="btn" onclick="clientModal(${c.id})">Abrir</button></td></tr>`)}</div>`)}function orders(d){A.innerHTML=shell('Órdenes',`<div class="panel">${table(['Número','Cliente','Vehículo','Estado','Total'],d.orders,o=>`<tr><td><button class="link" onclick="orderModal(${o.id})">${o.number}</button></td><td>${esc(cn(d,o.clientId))}</td><td>${esc(vn(d,o.vehicleId))}</td><td>${o.status}</td><td>${money(o.total)}</td></tr>`)}</div>`,`<button class="btn primary" onclick="orderModal()">+ Nueva orden</button>`)}function production(d){let states=['Pendiente','Desabolladura','Preparación','Pintura','Secado','Brillado','Terminada'];A.innerHTML=shell('Producción',`<div class="board">${states.map(s=>`<section class="col"><b>${s}</b>${d.parts.filter(p=>p.status===s).map(p=>`<button class="card" onclick="partModal(${p.id})"><b>${d.orders.find(o=>o.id===p.orderId)?.number||'—'}</b><br>${esc(p.description)}<br><small>${esc(vn(d,d.orders.find(o=>o.id===p.orderId)?.vehicleId))}</small></button>`).join('')||'<p class="muted">Sin piezas</p>'}</section>`).join('')}</div>`)}function finance(d){let os=d.orders;A.innerHTML=shell('Finanzas',`<div class="tabs">${['summary','payments','costs','profits'].map(x=>`<button class="${tab===x?'on':''}" onclick="tab='${x}';render()">${{summary:'Resumen',payments:'Pagos',costs:'Costos',profits:'Ganancias'}[x]}</button>`).join('')}</div><div class="panel">${table(['Orden','Total','Pagado','Balance','Ganancia'],os,o=>`<tr><td>${o.number}</td><td>${money(o.total)}</td><td>${money(paid(d,o.id))}</td><td>${money(o.total-paid(d,o.id))}</td><td>${money(o.total-cost(d,o.id))}</td><td><button class="btn" onclick="paymentModal(${o.id})">Pago</button> <button class="btn" onclick="costModal(${o.id})">Costo</button></td></tr>`)}</div>`)}function settings(d){A.innerHTML=shell('Configuración',`<div class="panel"><h2>RevivAuto</h2><p class="muted">Los datos y empleados se administrarán aquí. Esta primera versión se mantiene limpia, sin datos demo automáticos.</p></div>`)}function search(i){document.querySelectorAll('.row').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(i.value.toLowerCase()))}
const field=(l,n,v='',type='text',full='')=>{const key=String(n||'').toLowerCase(),numeric=type==='number',telephone=type==='tel'||/phone|telefono|tel[eé]fono|whatsapp/.test(key),mobile=numeric?' inputmode="decimal" step="any"':telephone?' inputmode="tel" autocomplete="tel"':'';return `<div class="field ${full}"><label>${l}</label><input name="${n}" value="${esc(v)}" type="${type}"${mobile}></div>`},close=()=>document.querySelector('#modal')?.remove();function modal(title,body){document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="save(event)"><h2>${title}</h2><div class="form">${body}</div><div class="actions"><button type="button" class="btn" onclick="close()">Cancelar</button><button class="btn primary">Guardar</button></div></form></div>`)}
async function clientModal(id){let d=await data(),c=id?await api.get('clients',id):{};modal(id?'Cliente':'Nuevo cliente',`${field('Nombre completo *','name',c.name)}${field('Teléfono *','phone',c.phone)}${field('WhatsApp','whatsapp',c.whatsapp)}${field('Cédula/RNC','document',c.document)}${field('Dirección','address',c.address,'text','full')}<input type="hidden" name="kind" value="client"><input type="hidden" name="id" value="${id||''}"><div class="field full"><label>Notas</label><textarea name="notes">${esc(c.notes)}</textarea></div><div class="field full"><b>Vehículo del cliente (opcional)</b></div>${field('Marca','brand')}${field('Modelo','model')}${field('Año','year','','number')}${field('Placa','plate')}${field('Color','color')}${field('VIN','vin')}`)}
async function orderModal(id){let d=await data(),o=id?await api.get('orders',id):{};modal(id?'Orden':'Nueva orden',`<input type="hidden" name="kind" value="order"><input type="hidden" name="id" value="${id||''}"><div class="field"><label>Cliente *</label><select name="clientId" onchange="filterVehicles(this)"><option value="">Selecciona un cliente</option>${d.clients.map(c=>`<option value="${c.id}" ${c.id===o.clientId?'selected':''}>${esc(c.name)}</option>`).join('')}</select><button type="button" class="link" onclick="close();clientModal()">+ Crear cliente nuevo</button></div><div class="field"><label>Vehículo *</label><select name="vehicleId">${d.vehicles.filter(v=>v.clientId===o.clientId).map(v=>`<option value="${v.id}" ${v.id===o.vehicleId?'selected':''}>${esc(vn(d,v.id))}</option>`).join('')||'<option value="">Selecciona primero un cliente</option>'}</select></div>${field('Fecha de entrada *','entryDate',o.entryDate||new Date().toISOString().slice(0,10),'date')}${field('Fecha estimada de entrega','dueDate',o.dueDate,'date')}<div class="field"><label>Estado</label><select name="status">${['Cotización','Aprobada','Esperando ingreso','En reparación','En preparación','En pintura','En acabado','Lista para entregar','Entregada','Cancelada'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></div>${field('Precio total','total',o.total,'number')}<div class="field full"><label>Notas</label><textarea name="notes">${esc(o.notes)}</textarea></div>`)}
async function filterVehicles(s){let d=await data(),target=document.querySelector('#modal select[name="vehicleId"]');target.innerHTML=d.vehicles.filter(v=>v.clientId===+s.value).map(v=>`<option value="${v.id}">${esc(vn(d,v.id))}</option>`).join('')||'<option value="">Este cliente no tiene vehículos</option>'}
async function save(e){e.preventDefault();let x=Object.fromEntries(new FormData(e.target));try{if(x.kind==='client'){if(!x.name||!x.phone)throw Error('Nombre y teléfono son obligatorios.');let cid=x.id?+x.id:await api.put('clients',{workshopId:WID,name:x.name,phone:x.phone,whatsapp:x.whatsapp,document:x.document,address:x.address,notes:x.notes});if(x.id)await api.put('clients',{workshopId:WID,id:+x.id,name:x.name,phone:x.phone,whatsapp:x.whatsapp,document:x.document,address:x.address,notes:x.notes});if(x.brand&&x.model)await api.put('vehicles',{workshopId:WID,clientId:cid,brand:x.brand,model:x.model,year:x.year,plate:x.plate,color:x.color,vin:x.vin})}if(x.kind==='order'){if(!x.clientId||!x.vehicleId)throw Error('Selecciona un cliente y un vehículo.');let all=await api.all('orders'),max=Math.max(0,...all.map(o=>+(o.number.match(/\d+$/)||[0])[0]));await api.put('orders',{workshopId:WID,id:x.id?+x.id:undefined,number:x.id?(await api.get('orders',x.id)).number:`REV-${String(max+1).padStart(4,'0')}`,clientId:+x.clientId,vehicleId:+x.vehicleId,entryDate:x.entryDate,dueDate:x.dueDate,status:x.status,total:+x.total||0,notes:x.notes})}close();render()}catch(err){alert(err.message)}}
init().then(render).catch(e=>A.innerHTML=`<main class="loading"><div class="error">${esc(e.message)}</div></main>`);
/* Personalización del taller: logo persistente en IndexedDB. */
async function settingsLogo(d){const s=d.settings[0]||{id:1};A.innerHTML=shell('Configuración',`<div class="panel"><h2>Datos del taller</h2><form class="form" onsubmit="saveWorkshop(event,${s.id||1})">${field('Nombre del taller','name',s.name)}${field('Teléfono','phone',s.phone)}${field('WhatsApp','whatsapp',s.whatsapp)}${field('Correo electrónico','email',s.email)}${field('Dirección','address',s.address,'text','full')}${field('RNC/Cédula','document',s.document)}${field('Prefijo de órdenes','prefix',s.prefix||'REV')}${field('Tarifa del pintor por pieza (RD$)','painterRate',s.painterRate||350,'number')}<div class="field full"><label>Logo del taller</label><div id="logoPreview">${s.logoData?`<img class="workshop-logo" src="${s.logoData}" alt="Logo del taller">`:'<span class="muted">Aún no hay logo cargado.</span>'}</div><input id="logoInput" type="file" accept="image/png,image/jpeg,image/webp" onchange="uploadLogo(this,${s.id||1})"><span class="muted">PNG, JPG, JPEG o WEBP · máximo 2 MB.</span><div class="actions"><button type="button" class="btn" onclick="document.getElementById('logoInput').click()">${s.logoData?'Cambiar logo':'Subir logo'}</button>${s.logoData?`<button type="button" class="btn danger" onclick="removeLogo(${s.id||1})">Eliminar logo</button>`:''}</div></div><div class="field full"><button class="btn primary">Guardar datos del taller</button></div></form></div>`)}
async function saveWorkshop(e,id){e.preventDefault();try{const v=Object.fromEntries(new FormData(e.target)),old=await api.get('settings',id);await api.put('settings',{...old,...v,id:+id,workshopId:WID,painterRate:+v.painterRate||350});await render()}catch(err){alert(`No se pudieron guardar los datos: ${err.message}`)}}
async function uploadLogo(input,id){const file=input.files?.[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))return alert('Selecciona una imagen PNG, JPG, JPEG o WEBP.');if(file.size>2*1024*1024)return alert('El logo debe pesar menos de 2 MB.');const reader=new FileReader();reader.onload=async()=>{try{const old=await api.get('settings',id);await api.put('settings',{...old,id:+id,workshopId:WID,logoData:reader.result});await render()}catch(e){alert(`No se pudo guardar el logo: ${e.message}`)}};reader.onerror=()=>alert('No se pudo leer esa imagen.');reader.readAsDataURL(file)}
async function removeLogo(id){if(!confirm('¿Eliminar el logo del taller?'))return;const old=await api.get('settings',id);delete old.logoData;await api.put('settings',old);render()}
async function applyWorkshopLogo(){try{const settings=(await api.all('settings'))[0];const brand=document.querySelector('.brand');if(!brand||!settings)return;if(settings.logoData)brand.innerHTML=`<img class="workshop-logo side-logo" src="${settings.logoData}" alt="${esc(settings.name)}"><small>${esc(settings.name)}</small>`;else brand.innerHTML=`<b>${esc(settings.name||'TallerOS')}</b><small>Todo tu taller en un solo lugar</small>`}catch(_) {}}
new MutationObserver(()=>applyWorkshopLogo()).observe(A,{childList:true,subtree:true});
let settingsPainted=false;
new MutationObserver(()=>{if(view==='settings'&&!settingsPainted){settingsPainted=true;data().then(settingsLogo)}}).observe(A,{childList:true,subtree:true});
/* Seguridad de claves: los stores usan keyPath "id" con autoIncrement.
   Al crear, nunca se envía id vacío; IndexedDB genera una clave numérica válida. */
const originalPut=api.put;
api.put=async function(store,record){const value={...record};if(Object.prototype.hasOwnProperty.call(value,'id')&&(value.id===undefined||value.id===null||value.id===''||Number.isNaN(value.id)))delete value.id;return originalPut(store,value)};
api.create=async function(store,record){const value={...record};delete value.id;return api.put(store,value)};
let pendingOrderClientId=null;
window.createVehicleFromOrder=async function(){const clientId=document.querySelector('#modal select[name="clientId"]')?.value;if(!clientId)return alert('Selecciona primero el cliente de la orden.');pendingOrderClientId=Number(clientId);const d=await data();document.querySelector('#modal')?.remove();modal('Agregar vehículo',`<input type="hidden" name="kind" value="quickVehicle"><input type="hidden" name="clientId" value="${clientId}"><div class="field full"><label>Cliente propietario</label><input value="${esc(cn(d,Number(clientId)))}" disabled></div>${field('Marca *','brand')}${field('Modelo *','model')}${field('Año','year','','number')}${field('Placa','plate')}${field('Color','color')}${field('VIN (opcional)','vin')}`)};
const previousSave=window.save;
window.save=async function(event){const form=event.target;if(new FormData(form).get('kind')!=='quickVehicle')return previousSave(event);event.preventDefault();const v=Object.fromEntries(new FormData(form));try{if(!v.brand?.trim()||!v.model?.trim())throw new Error('Marca y modelo son obligatorios.');await api.create('vehicles',{workshopId:WID,clientId:Number(v.clientId),brand:v.brand,model:v.model,year:v.year,plate:v.plate,color:v.color,vin:v.vin,notes:''});close();await orderModal();const select=document.querySelector('#modal select[name="clientId"]');if(select){select.value=String(pendingOrderClientId);await filterVehicles(select)}pendingOrderClientId=null}catch(e){alert(`No se pudo guardar el vehículo: ${e.message}`)}};
new MutationObserver(()=>{const orderForm=document.querySelector('#modal form input[name="kind"][value="order"]');if(!orderForm||orderForm.dataset.vehicleButton)return;orderForm.dataset.vehicleButton='1';const vehicle=orderForm.closest('form').querySelector('select[name="vehicleId"]');if(vehicle)vehicle.insertAdjacentHTML('afterend','<button type="button" class="link" onclick="createVehicleFromOrder()">+ Crear vehículo nuevo para este cliente</button>')}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('submit',event=>{if(new FormData(event.target).get('kind')==='quickVehicle'){event.preventDefault();event.stopImmediatePropagation();window.save(event)}},true);
/* Rentabilidad por orden: usa costos vinculados a orderId, sin afectar producción. */
const sumType=(items,type)=>items.filter(x=>x.type===type).reduce((s,x)=>s+Number(x.amount||0),0);
window.rentabilityModal=async function(orderId){const d=await data(),order=d.orders.find(o=>o.id===Number(orderId));if(!order)return;const list=d.costs.filter(c=>c.orderId===Number(orderId)),labor=sumType(list,'Mano de obra'),materials=sumType(list,'Materiales'),others=sumType(list,'Otros costos'),total=labor+materials+others,profit=Number(order.total||0)-total,pay=paid(d,orderId),margin=Number(order.total||0)?profit/Number(order.total)*100:0;document.querySelector('#modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><div class="modal"><h2>Rentabilidad · ${order.number}</h2><div class="stats"><div class="stat"><span>Precio del trabajo</span><b>${money(order.total)}</b></div><div class="stat"><span>Costo total</span><b>${money(total)}</b></div><div class="stat"><span>Ganancia estimada</span><b>${money(profit)}</b></div><div class="stat"><span>Margen</span><b>${margin.toFixed(1)}%</b></div><div class="stat"><span>Total cobrado</span><b>${money(pay)}</b></div><div class="stat"><span>Balance pendiente</span><b>${money(Number(order.total||0)-pay)}</b></div></div><div class="tabs"><button class="on" onclick="rentForm(${orderId},'Mano de obra')">+ Mano de obra</button><button onclick="rentForm(${orderId},'Materiales')">+ Material</button><button onclick="rentForm(${orderId},'Otros costos')">+ Otro costo</button></div><div class="panel"><h2>Costos registrados</h2>${list.length?table(['Tipo','Detalle','Monto'],list,c=>`<tr><td>${esc(c.type)}</td><td>${esc(c.description||c.concept||'—')}</td><td>${money(c.amount)}</td></tr>`):'<p class="muted">Aún no hay costos para esta orden.</p>'}</div><div class="actions"><button class="btn" onclick="close()">Cerrar</button></div></div></div>`)};
window.rentForm=function(orderId,type){const dsc=type==='Mano de obra'?`<div class="field"><label>Empleado</label><select name="employeeId"><option value="">Selecciona un empleado</option></select></div><div class="field"><label>Trabajo realizado</label><input name="description" placeholder="Ej. Preparación"></div><div class="field"><label>Forma de pago</label><select name="paymentMode"><option>Por pieza</option><option>Monto fijo</option></select></div><div class="field"><label>Cantidad de piezas</label><input name="quantity" type="number" value="1"></div><div class="field"><label>Pago por pieza / monto</label><input name="unitAmount" type="number"></div>`:type==='Materiales'?`<div class="field"><label>Material</label><input name="description" placeholder="Ej. Pintura"></div><div class="field"><label>Cantidad</label><input name="quantity" type="number" value="1"></div><div class="field"><label>Costo total</label><input name="amount" type="number"></div>`:`<div class="field"><label>Concepto</label><input name="description"></div><div class="field"><label>Monto</label><input name="amount" type="number"></div>`;document.querySelector('#modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="saveRent(event,${orderId},'${type}')"><h2>Agregar ${type}</h2><div class="form">${dsc}</div><div class="actions"><button type="button" class="btn" onclick="rentabilityModal(${orderId})">Cancelar</button><button class="btn primary">Guardar costo</button></div></form></div>`)};
window.saveRent=async function(e,orderId,type){e.preventDefault();try{const v=Object.fromEntries(new FormData(e.target));let amount=Number(v.amount||0);if(type==='Mano de obra'){const unit=Number(v.unitAmount||0),qty=Number(v.quantity||1);amount=v.paymentMode==='Por pieza'?unit*qty:unit}if(!amount||amount<0)throw new Error('Indica un monto válido.');if(!v.description?.trim()&&type!=='Mano de obra')throw new Error('Describe el costo.');await api.create('costs',{workshopId:WID,orderId:Number(orderId),type,employeeId:v.employeeId?Number(v.employeeId):null,description:v.description||'Mano de obra',quantity:Number(v.quantity||1),paymentMode:v.paymentMode||'',amount});await rentabilityModal(orderId);await render()}catch(err){alert(`No se pudo guardar el costo: ${err.message}`)}};
new MutationObserver(()=>{const form=document.querySelector('#modal form input[name="kind"][value="order"]');if(!form||!form.value)return;const id=form.closest('form').querySelector('input[name="id"]')?.value;if(!id||form.dataset.rent)return;form.dataset.rent='1';form.closest('form').querySelector('.actions')?.insertAdjacentHTML('afterbegin',`<button type="button" class="btn" onclick="rentabilityModal(${id})">Rentabilidad</button>`)}).observe(document.body,{childList:true,subtree:true});
window.rentForm=async function(orderId,type){const d=await data();const employees=d.employees.map(e=>`<option value="${e.id}">${esc(e.name)} · ${esc(e.role||'Otro')}</option>`).join('');const body=type==='Mano de obra'?`<div class="field"><label>Empleado</label><select name="employeeId"><option value="">Selecciona un empleado</option>${employees}</select></div><div class="field"><label>Trabajo realizado</label><input name="description"></div><div class="field"><label>Forma de pago</label><select name="paymentMode"><option>Por pieza</option><option>Monto fijo</option></select></div><div class="field"><label>Cantidad de piezas</label><input name="quantity" type="number" value="1"></div><div class="field"><label>Pago por pieza / monto</label><input name="unitAmount" type="number"></div>`:type==='Materiales'?`<div class="field"><label>Material</label><input name="description"></div><div class="field"><label>Cantidad</label><input name="quantity" type="number" value="1"></div><div class="field"><label>Costo total</label><input name="amount" type="number"></div>`:`<div class="field"><label>Concepto</label><input name="description"></div><div class="field"><label>Monto</label><input name="amount" type="number"></div>`;document.querySelector('#modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="saveRent(event,${orderId},'${type}')"><h2>Agregar ${type}</h2><div class="form">${body}</div><div class="actions"><button type="button" class="btn" onclick="rentabilityModal(${orderId})">Cancelar</button><button class="btn primary">Guardar costo</button></div></form></div>`)};
/* Producción y Finanzas usan exactamente las mismas piezas y costos de IndexedDB. */
production=function(d){const stages=['Pendiente','Desabolladura','Preparación','Pintura','Brillado','Terminada'];A.innerHTML=shell('Producción',`<div class="board">${stages.map(stage=>`<section class="col"><b>${stage}</b>${d.parts.filter(p=>p.status===stage).map(p=>{const o=d.orders.find(x=>x.id===p.orderId);return `<button class="card" onclick="partModal(${p.id})"><b>${o?.number||'—'}</b><br>${esc(p.description||'Trabajo sin nombre')}<br><small>${esc(cn(d,o?.clientId))} · ${esc(vn(d,o?.vehicleId))}</small><br><small>${esc(d.employees.find(e=>e.id===p.employeeId)?.name||'Sin asignar')}</small></button>`}).join('')||'<p class="muted">Sin piezas</p>'}</section>`).join('')}</div>`)};
window.partModal=async function(id=null,orderId=null){const d=await data(),p=id?await api.get('parts',id):{},order=orderId||p.orderId;document.querySelector('#modal')?.remove();modal(id?'Editar trabajo':'Agregar pieza/trabajo',`<input type="hidden" name="kind" value="part"><input type="hidden" name="id" value="${id||''}"><input type="hidden" name="orderId" value="${order||''}">${field('Descripción *','description',p.description)}<div class="field"><label>Estado</label><select name="status">${['Pendiente','Desabolladura','Preparación','Pintura','Brillado','Terminada'].map(s=>`<option ${p.status===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="field"><label>Empleado responsable</label><select name="employeeId"><option value="">Sin asignar</option>${d.employees.map(e=>`<option value="${e.id}" ${e.id===p.employeeId?'selected':''}>${esc(e.name)}</option>`).join('')}</select></div>${field('Precio de la pieza','price',p.price,'number')}`)};
const basicSave=window.save;window.save=async function(e){const form=e.target,dataForm=new FormData(form);if(dataForm.get('kind')!=='part')return basicSave(e);e.preventDefault();const v=Object.fromEntries(dataForm);if(!v.description?.trim())return alert('Describe la pieza o trabajo.');await api.put('parts',{workshopId:WID,id:v.id?Number(v.id):undefined,orderId:Number(v.orderId),description:v.description,status:v.status,employeeId:v.employeeId?Number(v.employeeId):null,price:Number(v.price||0),materialCost:0,laborCost:0,otherCost:0});close();render()};
new MutationObserver(()=>{const id=document.querySelector('#modal form input[name="kind"][value="order"]')?.closest('form')?.querySelector('input[name="id"]')?.value;if(!id)return;const actions=document.querySelector('#modal .actions');if(actions&&!actions.dataset.parts){actions.dataset.parts='1';actions.insertAdjacentHTML('afterbegin',`<button type="button" class="btn" onclick="partModal(null,${id})">+ Agregar pieza</button>`)}}).observe(document.body,{childList:true,subtree:true});
document.addEventListener('submit',event=>{if(new FormData(event.target).get('kind')==='part'){event.preventDefault();event.stopImmediatePropagation();window.save(event)}},true);
/* Producción es una proyección directa de orders; no mantiene registros propios. */
const productionStage=status=>({"En reparación":"Desabolladura","En preparación":"Preparación","En pintura":"Pintura","En acabado":"Brillado","Lista para entregar":"Terminada","Entregada":"Terminada"}[status]||'Pendiente');
production=function(d){const stages=['Pendiente','Desabolladura','Preparación','Pintura','Brillado','Terminada'],active=d.orders.filter(o=>o.status!=='Cancelada');A.innerHTML=shell('Producción',`<div class="board">${stages.map(stage=>`<section class="col"><b>${stage}</b>${active.filter(o=>productionStage(o.status)===stage).map(o=>{const pcs=d.parts.filter(p=>p.orderId===o.id);return `<button class="card" onclick="orderStageModal(${o.id})"><b>${o.number}</b><br>${esc(cn(d,o.clientId))}<br><small>${esc(vn(d,o.vehicleId))}</small><br><span class="badge">${esc(o.status)}</span><br><small>Entrega: ${esc(o.dueDate||'Sin fecha')}</small>${pcs.length?`<br><small>${pcs.length} pieza(s)</small>`:''}</button>`}).join('')||'<p class="muted">Sin órdenes</p>'}</section>`).join('')}</div>`)};
window.orderStageModal=async function(id){const order=await api.get('orders',id);document.querySelector('#modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="saveOrderStage(event,${id})"><h2>${esc(order.number)} · Actualizar proceso</h2><div class="form"><div class="field full"><label>Estado de la orden</label><select name="status">${['Cotización','Aprobada','Esperando ingreso','En reparación','En preparación','En pintura','En acabado','Lista para entregar','Entregada','Cancelada'].map(s=>`<option ${s===order.status?'selected':''}>${s}</option>`).join('')}</select></div></div><div class="actions"><button type="button" class="btn" onclick="close()">Cancelar</button><button class="btn primary">Guardar estado</button></div></form></div>`)};
window.saveOrderStage=async function(e,id){e.preventDefault();const order=await api.get('orders',id),status=new FormData(e.target).get('status');await api.put('orders',{...order,status});close();render()};
const DEFAULT_ROLES=['Desabollador','Preparador','Empapelador/Desarmador','Pintor','Brillador'];
async function roles(){const s=(await api.all('settings'))[0]||{};return [...new Set([...DEFAULT_ROLES,...(s.customRoles||[])])]}async function saveRole(name){const n=name.trim();if(!n)return;const s=(await api.all('settings'))[0];const list=[...(s.customRoles||[])];if(!list.some(x=>x.toLowerCase()===n.toLowerCase()))list.push(n);await api.put('settings',{...s,customRoles:list});}
window.employeeModal=async function(id=null){const d=await data(),e=id?await api.get('employees',id):{},r=await roles();document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="saveEmployee(event,${id||'null'})"><h2>${id?'Editar empleado':'Agregar empleado'}</h2><div class="form">${field('Nombre *','name',e.name)}${field('Teléfono','phone',e.phone)}<div class="field"><label>Puesto</label><select name="role">${r.map(x=>`<option ${x===e.role?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Estado</label><select name="active"><option value="true" ${e.active!==false?'selected':''}>Activo</option><option value="false" ${e.active===false?'selected':''}>Inactivo</option></select></div>${field('Tarifa por pieza (opcional)','pieceRate',e.pieceRate,'number')}${field('Pago fijo (opcional)','fixedPay',e.fixedPay,'number')}</div><div class="actions"><button type="button" class="btn" onclick="close()">Cancelar</button><button class="btn primary">Guardar empleado</button></div></form></div>`)};
window.saveEmployee=async function(e,id){e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(!v.name?.trim())return alert('El nombre del empleado es obligatorio.');await api.put('employees',{workshopId:WID,id:id?Number(id):undefined,name:v.name,phone:v.phone,role:v.role,active:v.active==='true',pieceRate:Number(v.pieceRate||0),fixedPay:Number(v.fixedPay||0)});close();render()};
window.roleModal=()=>document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="saveRoleForm(event)"><h2>Agregar puesto</h2><div class="form">${field('Nombre del puesto','roleName')}</div><div class="actions"><button type="button" class="btn" onclick="close()">Cancelar</button><button class="btn primary">Guardar puesto</button></div></form></div>`);
window.saveRoleForm=async function(e){e.preventDefault();await saveRole(new FormData(e.target).get('roleName')||'');close();render()};
new MutationObserver(async()=>{const settingForm=document.querySelector('#modal form')||document.querySelector('.main form');if(view!=='settings'||!settingForm||settingForm.dataset.employees)return;settingForm.dataset.employees='1';const d=await data();settingForm.insertAdjacentHTML('beforeend',`<div class="field full"><hr><h2>Empleados y puestos</h2><div class="actions"><button type="button" class="btn" onclick="employeeModal()">+ Agregar empleado</button><button type="button" class="btn" onclick="roleModal()">+ Agregar puesto</button></div>${d.employees.map(e=>`<div class="card"><b>${esc(e.name)}</b><br><small>${esc(e.role||'Sin puesto')} · ${e.active===false?'Inactivo':'Activo'}</small><button type="button" class="link" onclick="employeeModal(${e.id})">Editar</button></div>`).join('')||'<p class="muted">Aún no hay empleados.</p>'}</div>`)}).observe(A,{childList:true,subtree:true});
window.rentForm=async function(orderId,type){const d=await data(),active=d.employees.filter(e=>e.active!==false);const body=type==='Mano de obra'?`<div class="field"><label>Empleado</label><select name="employeeId" onchange="fillEmployeeRate(this)"><option value="">Selecciona un empleado</option>${active.map(e=>`<option value="${e.id}" data-role="${esc(e.role||'Otro')}" data-rate="${e.pieceRate||0}">${esc(e.name)} · ${esc(e.role||'Otro')}</option>`).join('')}</select><small id="employeeRole" class="muted"></small></div><div class="field"><label>Trabajo realizado</label><input name="description"></div><div class="field"><label>Forma de pago</label><select name="paymentMode"><option>Por pieza</option><option>Monto fijo</option></select></div><div class="field"><label>Cantidad de piezas</label><input name="quantity" type="number" value="1"></div><div class="field"><label>Pago por pieza / monto</label><input name="unitAmount" type="number"></div>`:type==='Materiales'?`<div class="field"><label>Material</label><input name="description"></div><div class="field"><label>Cantidad</label><input name="quantity" type="number" value="1"></div><div class="field"><label>Costo total</label><input name="amount" type="number"></div>`:`<div class="field"><label>Concepto</label><input name="description"></div><div class="field"><label>Monto</label><input name="amount" type="number"></div>`;document.querySelector('#modal')?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="saveRent(event,${orderId},'${type}')"><h2>Agregar ${type}</h2><div class="form">${body}</div><div class="actions"><button type="button" class="btn" onclick="rentabilityModal(${orderId})">Cancelar</button><button class="btn primary">Guardar costo</button></div></form></div>`)};
window.fillEmployeeRate=select=>{const option=select.options[select.selectedIndex],form=select.closest('form');form.querySelector('#employeeRole').textContent=option.dataset.role?`Puesto: ${option.dataset.role}`:'';if(option.dataset.rate&&Number(option.dataset.rate)>0)form.querySelector('[name="unitAmount"]').value=option.dataset.rate};
/* Asignaciones de mano de obra: una sola fuente de verdad dentro de cada pieza. */
window.laborAssignmentModal=async function(partId){const d=await data(),part=await api.get('parts',partId),active=d.employees.filter(e=>e.active!==false);document.querySelector('#modal')?.remove();const rows=(part.laborAssignments||[]).map(a=>`<tr><td>${esc(d.employees.find(e=>e.id===a.employeeId)?.name||'Empleado')}</td><td>${esc(a.role||'')}</td><td>${a.quantity}</td><td>${money(a.total)}</td></tr>`).join('');document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="saveLaborAssignment(event,${partId})"><h2>Empleados · ${esc(part.description)}</h2><div class="panel">${rows?`<table class="table"><thead><tr><th>Empleado</th><th>Puesto</th><th>Piezas</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>`:'<p class="muted">Sin empleados asignados.</p>'}</div><div class="form"><div class="field"><label>Empleado</label><select name="employeeId" onchange="laborRate(this)"><option value="">Selecciona un empleado</option>${active.map(e=>`<option value="${e.id}" data-role="${esc(e.role||'Otro')}" data-rate="${e.pieceRate||0}">${esc(e.name)} · ${esc(e.role||'Otro')}</option>`).join('')}</select></div><div class="field"><label>Puesto</label><input name="role" readonly></div><div class="field"><label>Forma de pago</label><select name="mode"><option>Por pieza</option><option>Monto fijo</option></select></div><div class="field"><label>Cantidad de piezas</label><input name="quantity" type="number" value="1"></div><div class="field"><label>Tarifa por pieza / monto</label><input name="rate" type="number"></div><div class="field"><label>Trabajo realizado</label><input name="work" value="${esc(part.description)}"></div></div><div class="actions"><button type="button" class="btn" onclick="close()">Cerrar</button><button class="btn primary">Agregar empleado</button></div></form></div>`)};
window.laborRate=s=>{const o=s.options[s.selectedIndex],f=s.closest('form');f.role.value=o.dataset.role||'';if(o.dataset.rate)f.rate.value=o.dataset.rate};
window.saveLaborAssignment=async function(e,partId){e.preventDefault();try{const v=Object.fromEntries(new FormData(e.target)),part=await api.get('parts',partId),employeeId=Number(v.employeeId),quantity=Number(v.quantity||1),rate=Number(v.rate||0);if(!employeeId||!quantity||rate<0)throw new Error('Selecciona un empleado e indica una tarifa válida.');const total=v.mode==='Por pieza'?quantity*rate:rate;const assignments=[...(part.laborAssignments||[]),{employeeId,role:v.role,quantity,rate,mode:v.mode,total,work:v.work,date:new Date().toISOString().slice(0,10)}];await api.put('parts',{...part,laborAssignments:assignments,laborCost:assignments.reduce((s,a)=>s+Number(a.total||0),0)});await laborAssignmentModal(partId);await render()}catch(err){alert(`No se pudo guardar la mano de obra: ${err.message}`)}};
new MutationObserver(()=>{const partForm=document.querySelector('#modal form input[name="kind"][value="part"]')?.closest('form'),id=partForm?.querySelector('input[name="id"]')?.value;if(!partForm||!id||partForm.dataset.labor)return;partForm.dataset.labor='1';partForm.querySelector('.actions')?.insertAdjacentHTML('afterbegin',`<button type="button" class="btn" onclick="laborAssignmentModal(${id})">Empleados y mano de obra</button>`)}).observe(document.body,{childList:true,subtree:true});
window.tallerCerrarModal=()=>document.querySelector('#modal')?.remove();
new MutationObserver(()=>document.querySelectorAll('[onclick*="close()"]:not([data-taller-close])').forEach(button=>{button.dataset.tallerClose='1';button.setAttribute('onclick',button.getAttribute('onclick').replaceAll('close()','tallerCerrarModal()'))})).observe(document.body,{childList:true,subtree:true});

/*
 * Cuentas de empleados: las asignaciones de una pieza solo se devengan al
 * terminar la pieza. El costo de la orden sigue viviendo en part.laborCost;
 * los pagos al empleado solo reducen su saldo y nunca crean un segundo costo.
 */
const employeeLedger=window.TallerOSLedger;
const employeeLedgerToday=()=>new Date().toISOString().slice(0,10);
const employeeLedgerNumber=value=>Number.isFinite(Number(value))?Number(value):0;
const employeeLedgerDate=value=>value?String(value).slice(0,10):'Sin fecha';
const employeeLedgerAccountLabel=account=>`Cuenta #${String(account.number||0).padStart(3,'0')}`;
const employeeLedgerLegacyCost=part=>{
  if(part&&part.legacyLaborCost!==undefined&&part.legacyLaborCost!==null)return employeeLedgerNumber(part.legacyLaborCost);
  const generated=(part?.laborAssignments||[]).filter(assignment=>assignment.ledgerState==='generated').reduce((sum,assignment)=>sum+employeeLedgerNumber(assignment.total),0);
  return Math.max(0,employeeLedgerNumber(part?.laborCost)-generated);
};

async function employeeLedgerPrepare(){
  try{
    await init();
    await employeeLedger.prepareMigration();
    window.__employeeLedgerReady=true;
  }catch(error){
    window.__employeeLedgerMigrationError=error?.message||'No se pudo preparar las cuentas de empleados.';
    console.error('TallerOS: migración de cuentas de empleados',error);
  }
}
const employeeLedgerMigration=employeeLedgerPrepare();
async function employeeLedgerEnsureReady(){
  await employeeLedgerMigration;
  if(window.__employeeLedgerMigrationError)throw new Error(window.__employeeLedgerMigrationError);
}

async function employeeLedgerFinalizePart(part){
  if(part.status!=='Terminada'||!Array.isArray(part.laborAssignments)||!part.laborAssignments.length)return part;
  const order=await api.get('orders',part.orderId);
  if(!order)throw new Error('No se encontró la orden de esta pieza.');
  return employeeLedger.finalizePart(part,order);
}

/* Conserva costos, materiales y asignaciones al editar una pieza existente. */
const employeeLedgerSaveBefore=window.save;
window.save=async function(event){
  const form=event?.target;
  const formData=form?new FormData(form):null;
  if(!formData||formData.get('kind')!=='part')return employeeLedgerSaveBefore(event);
  event.preventDefault();
  try{
    await employeeLedgerEnsureReady();
    const values=Object.fromEntries(formData);
    if(!values.description?.trim())throw new Error('Describe la pieza o trabajo.');
    if(!values.orderId||!Number.isFinite(Number(values.orderId)))throw new Error('Selecciona una orden válida para esta pieza.');
    const existing=values.id?await api.get('parts',Number(values.id)):null;
    let part={
      ...(existing||{}),
      workshopId:WID,
      id:existing?.id,
      orderId:Number(values.orderId),
      description:values.description.trim(),
      status:values.status||'Pendiente',
      employeeId:values.employeeId?Number(values.employeeId):null,
      price:employeeLedgerNumber(values.price),
      materialCost:employeeLedgerNumber(existing?.materialCost),
      laborCost:employeeLedgerNumber(existing?.laborCost),
      legacyLaborCost:employeeLedgerLegacyCost(existing),
      otherCost:employeeLedgerNumber(existing?.otherCost),
      laborAssignments:Array.isArray(existing?.laborAssignments)?existing.laborAssignments:[]
    };
    const savedId=await api.put('parts',part);
    part={...part,id:part.id||savedId};
    part=await employeeLedgerFinalizePart(part);
    await api.put('parts',part);
    close();
    await render();
    await orderModal(part.orderId);
  }catch(error){
    alert(`No se pudo guardar la pieza: ${error.message}`);
  }
};

async function employeeLedgerShowPartsInOrder(orderId){
  const form=document.querySelector('#modal form input[name="kind"][value="order"]')?.closest('form');
  if(!form||form.dataset.employeeLedgerParts)return;
  form.dataset.employeeLedgerParts='1';
  const d=await data();
  const parts=d.parts.filter(part=>part.orderId===Number(orderId));
  const partRows=parts.map(part=>{
    const assignments=(part.laborAssignments||[]).map(assignment=>{
      const employee=d.employees.find(item=>item.id===Number(assignment.employeeId));
      const state=assignment.ledgerState==='generated'?'devengado':assignment.ledgerState==='pending'?'pendiente de terminar':assignment.ledgerState==='legacy'?'histórico':'';
      return `${esc(employee?.name||'Empleado sin registro')} · ${esc(state)}`;
    }).join('<br>')||'Sin empleados asignados';
    const finishAction=part.status==='Terminada'?'<span class="muted">Terminada</span>':`<button type="button" class="btn primary" onclick="employeeLedgerMarkPartFinished(${part.id})">Marcar terminada</button>`;
    return `<tr><td>${esc(part.description||'Trabajo')}</td><td><span class="badge">${esc(part.status||'Pendiente')}</span></td><td>${assignments}</td><td>${money(part.laborCost||0)}</td><td><button type="button" class="btn" onclick="partModal(${part.id})">Abrir</button> ${finishAction}</td></tr>`;
  }).join('');
  form.querySelector('.form')?.insertAdjacentHTML('beforeend',`<div class="field full employee-ledger-order-parts"><hr><h2>Piezas y mano de obra</h2><div class="actions"><button type="button" class="btn" onclick="partModal(null,${Number(orderId)})">+ Agregar pieza</button></div>${partRows?`<table class="table"><thead><tr><th>Trabajo</th><th>Estado</th><th>Empleados</th><th>Mano de obra</th><th></th></tr></thead><tbody>${partRows}</tbody></table>`:'<p class="muted">Aún no hay piezas registradas.</p>'}</div>`);
}
const employeeLedgerOrderModalBefore=orderModal;
orderModal=async function(id){
  await employeeLedgerOrderModalBefore(id);
  if(id)await employeeLedgerShowPartsInOrder(Number(id));
};
window.orderModal=orderModal;

const employeeLedgerPartModalBefore=window.partModal;
window.partModal=async function(id=null,orderId=null){
  await employeeLedgerPartModalBefore(id,orderId);
  if(!id)return;
  const form=document.querySelector('#modal form input[name="kind"][value="part"]')?.closest('form');
  if(!form)return;
  const d=await data();
  const part=d.parts.find(item=>item.id===Number(id));
  if(!part)return;
  const responsibleLabel=form.querySelector('select[name="employeeId"]')?.closest('.field')?.querySelector('label');
  if(responsibleLabel)responsibleLabel.textContent='Responsable de producción (opcional)';
  const assignments=(part.laborAssignments||[]).map(assignment=>{
    const employee=d.employees.find(item=>item.id===Number(assignment.employeeId));
    const state=assignment.ledgerState==='generated'?'mano de obra generada':assignment.ledgerState==='pending'?'pendiente de terminar':assignment.ledgerState==='legacy'?'histórico':'';
    return `<li><b>${esc(employee?.name||'Empleado sin registro')}</b> · ${esc(assignment.role||'Sin puesto')} · ${money(assignment.total||0)} <small>${esc(state)}</small></li>`;
  }).join('');
  if(!form.dataset.employeeLedgerDetails){
    form.dataset.employeeLedgerDetails='1';
    const responsible=d.employees.find(item=>item.id===Number(part.employeeId));
    form.querySelector('.form')?.insertAdjacentHTML('beforeend',`<div class="field full"><hr><h2>Estado y mano de obra</h2><p><b>Estado actual:</b> <span class="badge">${esc(part.status||'Pendiente')}</span></p><p><b>Empleado responsable:</b> ${esc(responsible?.name||'Sin asignar')}</p>${assignments?`<ul class="muted">${assignments}</ul>`:'<p class="muted">Aún no hay mano de obra asignada. Usa “Asignar empleado y mano de obra” para que TallerOS pueda generar el pago al terminarla.</p>'}</div>`);
  }
  const actions=form?.querySelector('.actions');
  if(actions&&!form.dataset.labor){
    form.dataset.labor='1';
    actions.insertAdjacentHTML('afterbegin',`${part.status==='Terminada'?'':`<button type="button" class="btn primary" onclick="employeeLedgerMarkPartFinished(${Number(id)})">Marcar como terminada</button>`}<button type="button" class="btn" onclick="laborAssignmentModal(${Number(id)})">Asignar empleado y mano de obra</button>`);
  }
};

window.employeeLedgerMarkPartFinished=async function(partId){
  try{
    await employeeLedgerEnsureReady();
    const part=await api.get('parts',Number(partId));
    if(!part)throw new Error('No se encontró la pieza seleccionada.');
    if(part.status==='Terminada'){
      alert('Esta pieza ya está terminada. La mano de obra no se generará nuevamente.');
      return;
    }
    const d=await data();
    const employees=(part.laborAssignments||[]).map(assignment=>d.employees.find(item=>item.id===Number(assignment.employeeId))?.name).filter(Boolean);
    const message=employees.length?`¿Marcar “${part.description}” como terminada? Se generará la mano de obra pendiente de ${employees.join(', ')}.`:`¿Marcar “${part.description}” como terminada? No hay mano de obra asignada.`;
    if(!confirm(message))return;
    const before=(await employeeLedger.all('accruals')).filter(item=>Number(item.partId)===Number(part.id)).reduce((sum,item)=>sum+employeeLedgerNumber(item.total),0);
    const completed=await employeeLedgerFinalizePart({...part,status:'Terminada'});
    await api.put('parts',completed);
    const after=(await employeeLedger.all('accruals')).filter(item=>Number(item.partId)===Number(part.id)).reduce((sum,item)=>sum+employeeLedgerNumber(item.total),0);
    const generated=Math.max(0,after-before);
    close();
    await render();
    await orderModal(completed.orderId);
    alert(generated>0?`Pieza terminada. Se generó ${money(generated)} de mano de obra una sola vez.`:'Pieza terminada. No había mano de obra nueva por generar.');
  }catch(error){
    alert(`No se pudo terminar la pieza: ${error.message}`);
  }
};

/* Una asignación queda pendiente hasta que la pieza llegue a Terminada. */
window.saveLaborAssignment=async function(event,partId){
  event.preventDefault();
  try{
    await employeeLedgerEnsureReady();
    const values=Object.fromEntries(new FormData(event.target));
    const part=await api.get('parts',Number(partId));
    const employeeId=Number(values.employeeId);
    const quantity=Number(values.quantity||1);
    const rate=Number(values.rate||0);
    const employee=await api.get('employees',employeeId);
    if(!part)throw new Error('No se encontró la pieza seleccionada.');
    if(!employeeId||!employee||employee.active===false)throw new Error('Selecciona un empleado activo.');
    if((part.laborAssignments||[]).some(assignment=>Number(assignment.employeeId)===employeeId&&assignment.ledgerState!=='invalid'))throw new Error('Este empleado ya está asignado a esta pieza. Edita la cantidad en lugar de agregarlo otra vez.');
    if(!Number.isFinite(quantity)||quantity<=0)throw new Error('Indica una cantidad de piezas válida.');
    if(!Number.isFinite(rate)||rate<=0)throw new Error('Indica una tarifa mayor que cero.');
    const mode=values.mode||'Por pieza';
    const total=mode==='Por pieza'?quantity*rate:rate;
    const assignment={
      sourceAssignmentId:employeeLedger.id(),
      employeeId,
      role:values.role||employee.role||'Otro',
      quantity,
      rate,
      mode,
      total,
      work:(values.work||part.description||'Trabajo realizado').trim(),
      date:employeeLedgerToday(),
      ledgerState:'pending'
    };
    let updated={
      ...part,
      laborAssignments:[...(part.laborAssignments||[]),assignment],
      laborCost:employeeLedgerNumber(part.laborCost),
      legacyLaborCost:employeeLedgerLegacyCost(part)
    };
    updated=await employeeLedgerFinalizePart(updated);
    await api.put('parts',updated);
    await laborAssignmentModal(part.id);
    await render();
  }catch(error){
    alert(`No se pudo asignar la mano de obra: ${error.message}`);
  }
};

async function employeeLedgerEmployeeData(employeeId){
  const [accounts,accruals,payments]=await Promise.all([
    employeeLedger.listForEmployee('accounts',employeeId),
    employeeLedger.listForEmployee('accruals',employeeId),
    employeeLedger.listForEmployee('payments',employeeId)
  ]);
  const refreshed=[];
  for(const account of accounts)refreshed.push(await employeeLedger.refreshAccount(account.id));
  return {
    accounts:refreshed.sort((a,b)=>Number(b.number)-Number(a.number)),
    accruals:accruals.sort((a,b)=>new Date(b.generatedAt||b.date)-new Date(a.generatedAt||a.date)),
    payments:payments.sort((a,b)=>new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date))
  };
}

window.employeeLedgerProfile=async function(employeeId){
  try{
    await employeeLedgerEnsureReady();
    const d=await data();
    const employee=d.employees.find(item=>item.id===Number(employeeId));
    if(!employee)throw new Error('No se encontró el empleado.');
    const ledgerData=await employeeLedgerEmployeeData(employee.id);
    const totalGenerated=ledgerData.accruals.reduce((sum,item)=>sum+employeeLedgerNumber(item.total),0);
    const totalPaid=ledgerData.payments.reduce((sum,item)=>sum+employeeLedgerNumber(item.amount),0);
    const totalPieces=ledgerData.accruals.reduce((sum,item)=>sum+employeeLedgerNumber(item.quantity),0);
    const monthPrefix=new Date().toISOString().slice(0,7);
    const piecesThisMonth=ledgerData.accruals.filter(item=>String(item.date||'').slice(0,7)===monthPrefix).reduce((sum,item)=>sum+employeeLedgerNumber(item.quantity),0);
    const pending=Math.max(0,totalGenerated-totalPaid);
    const workRows=ledgerData.accruals.map(item=>{
      const order=d.orders.find(order=>order.id===Number(item.orderId));
      return `<tr><td>${esc(employeeLedgerDate(item.date))}</td><td>${esc(order?.number||'Orden eliminada')}</td><td>${esc(vn(d,item.vehicleId))}</td><td>${esc(item.work||'Trabajo')}</td><td>${item.quantity}</td><td>${money(item.total)}</td></tr>`;
    }).join('');
    const paymentRows=ledgerData.payments.map(item=>`<tr><td>${esc(employeeLedgerDate(item.date))}</td><td>${money(item.amount)}</td><td>${esc(item.note||'Sin nota')}</td></tr>`).join('');
    document.querySelector('#modal')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><div class="modal"><h2>${esc(employee.name)} · Cuenta de mano de obra</h2><p class="muted">${esc(employee.role||'Sin puesto')} · Tarifa predeterminada: ${money(employee.pieceRate||0)} por pieza</p><div class="stats"><div class="stat"><span>Piezas realizadas</span><b>${totalPieces}</b><small>Este mes: ${piecesThisMonth}</small></div><div class="stat"><span>Mano de obra generada</span><b>${money(totalGenerated)}</b></div><div class="stat"><span>Total pagado</span><b>${money(totalPaid)}</b></div><div class="stat"><span>Saldo pendiente</span><b>${money(pending)}</b></div></div><div class="panel"><h2>Cuenta y períodos</h2>${ledgerData.accounts.length?table(['Cuenta','Estado','Generado','Pagado','Saldo','Cierre',''],ledgerData.accounts,account=>`<tr><td>${employeeLedgerAccountLabel(account)}</td><td><span class="badge">${esc(account.status)}</span></td><td>${money(account.generated)}</td><td>${money(account.paid)}</td><td>${money(account.balance)}</td><td>${account.closedAt?esc(employeeLedgerDate(account.closedAt)):'—'}</td><td>${account.status==='ABIERTA'&&account.balance>0?`<button type="button" class="btn" onclick="employeeLedgerPaymentModal('${account.id}')">Registrar pago</button>`:''}${account.status==='PAGADA'?` <button type="button" class="btn primary" onclick="employeeLedgerCloseAccount('${account.id}',${employee.id})">Cerrar cuenta</button>`:''}</td></tr>`):'<p class="muted">Todavía no hay una cuenta generada. Se crea al terminar una pieza asignada a este empleado.</p>'}</div><div class="panel"><h2>Historial de trabajos</h2>${workRows?`<table class="table"><thead><tr><th>Fecha</th><th>Orden</th><th>Vehículo</th><th>Trabajo</th><th>Piezas</th><th>Monto</th></tr></thead><tbody>${workRows}</tbody></table>`:'<p class="muted">Aún no hay trabajos terminados.</p>'}</div><div class="panel"><h2>Historial de pagos</h2>${paymentRows?`<table class="table"><thead><tr><th>Fecha</th><th>Monto</th><th>Nota</th></tr></thead><tbody>${paymentRows}</tbody></table>`:'<p class="muted">Aún no hay pagos registrados.</p>'}</div><div class="actions"><button type="button" class="btn" onclick="close()">Cerrar</button></div></div></div>`);
  }catch(error){
    alert(`No se pudo abrir la cuenta del empleado: ${error.message}`);
  }
};

window.employeeLedgerPaymentModal=async function(accountId){
  try{
    await employeeLedgerEnsureReady();
    const account=await employeeLedger.refreshAccount(accountId);
    if(account.status==='CERRADA')throw new Error('Esta cuenta ya está cerrada.');
    if(account.balance<=0.005)throw new Error('Esta cuenta ya está completamente pagada.');
    document.querySelector('#modal')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><form class="modal" onsubmit="employeeLedgerSavePayment(event,'${account.id}')"><h2>Registrar pago de empleado</h2><p class="muted">${employeeLedgerAccountLabel(account)} · Saldo pendiente: ${money(account.balance)}</p><div class="form">${field('Fecha','date',employeeLedgerToday(),'date')}${field('Monto a pagar','amount','','number')}${field('Nota','note','','text','full')}</div><div class="actions"><button type="button" class="btn" onclick="employeeLedgerProfile(${account.employeeId})">Cancelar</button><button class="btn primary">Guardar pago</button></div></form></div>`);
  }catch(error){
    alert(error.message);
  }
};

window.employeeLedgerSavePayment=async function(event,accountId){
  event.preventDefault();
  try{
    await employeeLedgerEnsureReady();
    const values=Object.fromEntries(new FormData(event.target));
    const account=await employeeLedger.recordPayment(accountId,values.amount,values.note,values.date||employeeLedgerToday());
    await employeeLedgerProfile(account.employeeId);
    await render();
  }catch(error){
    alert(`No se pudo registrar el pago: ${error.message}`);
  }
};

window.employeeLedgerCloseAccount=async function(accountId,employeeId){
  try{
    await employeeLedgerEnsureReady();
    if(!confirm('¿Cerrar esta cuenta pagada? Se abrirá un nuevo período con saldo RD$0.'))return;
    await employeeLedger.closePaidAccount(accountId);
    await employeeLedgerProfile(employeeId);
  }catch(error){
    alert(`No se pudo cerrar la cuenta: ${error.message}`);
  }
};

/* La vista de Configuración ya existente mantiene sus datos y suma el acceso a cada cuenta. */
settings=function(d){
  settingsPainted=true;
  const s=d.settings[0]||{id:1,name:'RevivAuto'};
  const employeeCards=d.employees.map(employee=>`<div class="card"><b>${esc(employee.name)}</b><br><small>${esc(employee.role||'Sin puesto')} · ${employee.active===false?'Inactivo':'Activo'} · ${money(employee.pieceRate||0)} por pieza</small><div class="actions"><button type="button" class="btn" onclick="employeeLedgerProfile(${employee.id})">Ver cuenta</button><button type="button" class="link" onclick="employeeModal(${employee.id})">Editar</button></div></div>`).join('')||'<p class="muted">Aún no hay empleados.</p>';
  A.innerHTML=shell('Configuración',`<div class="panel"><h2>Datos del taller</h2><form class="form" data-employees="1" onsubmit="saveWorkshop(event,${s.id||1})">${field('Nombre del taller','name',s.name)}${field('Teléfono','phone',s.phone)}${field('WhatsApp','whatsapp',s.whatsapp)}${field('Correo electrónico','email',s.email)}${field('Dirección','address',s.address,'text','full')}${field('RNC/Cédula','document',s.document)}${field('Prefijo de órdenes','prefix',s.prefix||'REV')}${field('Tarifa del pintor por pieza (RD$)','painterRate',s.painterRate||350,'number')}<div class="field full"><label>Logo del taller</label><div id="logoPreview">${s.logoData?`<img class="workshop-logo" src="${s.logoData}" alt="Logo del taller">`:'<span class="muted">Aún no hay logo cargado.</span>'}</div><input id="logoInput" type="file" accept="image/png,image/jpeg,image/webp" onchange="uploadLogo(this,${s.id||1})"><span class="muted">PNG, JPG, JPEG o WEBP · máximo 2 MB.</span><div class="actions"><button type="button" class="btn" onclick="document.getElementById('logoInput').click()">${s.logoData?'Cambiar logo':'Subir logo'}</button>${s.logoData?`<button type="button" class="btn danger" onclick="removeLogo(${s.id||1})">Eliminar logo</button>`:''}</div></div><div class="field full"><hr><h2>Empleados y puestos</h2><p class="muted">La mano de obra se genera una sola vez al terminar una pieza asignada.</p><div class="actions"><button type="button" class="btn" onclick="employeeModal()">+ Agregar empleado</button><button type="button" class="btn" onclick="roleModal()">+ Agregar puesto</button></div>${employeeCards}</div><div class="field full"><button class="btn primary">Guardar datos del taller</button></div></form></div>`);
};

/* Evita que un pago o un formulario manual vuelva a contar mano de obra. */
const employeeLedgerRentFormBefore=window.rentForm;
window.rentForm=function(orderId,type){
  if(type==='Mano de obra'){
    alert('La mano de obra se registra desde cada pieza: asigna el empleado y marca la pieza como terminada. Así TallerOS evita duplicar costos.');
    return;
  }
  return employeeLedgerRentFormBefore(orderId,type);
};
const employeeLedgerSaveRentBefore=window.saveRent;
window.saveRent=async function(event,orderId,type){
  if(type==='Mano de obra'){
    event.preventDefault();
    alert('La mano de obra se registra desde la pieza para evitar que el costo se cuente dos veces.');
    return;
  }
  return employeeLedgerSaveRentBefore(event,orderId,type);
};

/* Rentabilidad incorpora los costos de piezas terminadas, incluida mano de obra. */
window.rentabilityModal=async function(orderId){
  const d=await data();
  const order=d.orders.find(item=>item.id===Number(orderId));
  if(!order)return;
  const direct=d.costs.filter(item=>item.orderId===Number(orderId));
  const pieces=d.parts.filter(item=>item.orderId===Number(orderId));
  const labor=sumType(direct,'Mano de obra')+pieces.reduce((sum,item)=>sum+employeeLedgerNumber(item.laborCost),0);
  const materials=sumType(direct,'Materiales')+pieces.reduce((sum,item)=>sum+employeeLedgerNumber(item.materialCost),0);
  const others=sumType(direct,'Otros costos')+pieces.reduce((sum,item)=>sum+employeeLedgerNumber(item.otherCost),0);
  const total=labor+materials+others;
  const profit=employeeLedgerNumber(order.total)-total;
  const totalPaid=paid(d,order.id);
  const margin=employeeLedgerNumber(order.total)?profit/employeeLedgerNumber(order.total)*100:0;
  document.querySelector('#modal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modalbg" id="modal"><div class="modal"><h2>Rentabilidad · ${esc(order.number)}</h2><div class="stats"><div class="stat"><span>Precio del trabajo</span><b>${money(order.total)}</b></div><div class="stat"><span>Mano de obra</span><b>${money(labor)}</b></div><div class="stat"><span>Costo total</span><b>${money(total)}</b></div><div class="stat"><span>Ganancia estimada</span><b>${money(profit)}</b></div><div class="stat"><span>Margen</span><b>${margin.toFixed(1)}%</b></div><div class="stat"><span>Balance pendiente</span><b>${money(employeeLedgerNumber(order.total)-totalPaid)}</b></div></div><div class="tabs"><button class="on" onclick="rentForm(${order.id},'Mano de obra')">Mano de obra desde piezas</button><button onclick="rentForm(${order.id},'Materiales')">+ Material</button><button onclick="rentForm(${order.id},'Otros costos')">+ Otro costo</button></div><div class="panel"><h2>Costos directos registrados</h2>${direct.length?table(['Tipo','Detalle','Monto'],direct,item=>`<tr><td>${esc(item.type)}</td><td>${esc(item.description||item.concept||'—')}</td><td>${money(item.amount)}</td></tr>`):'<p class="muted">Aún no hay costos directos para esta orden.</p>'}<p class="muted">La mano de obra generada por piezas se suma automáticamente y no se duplica al registrar pagos al empleado.</p></div><div class="actions"><button class="btn" onclick="close()">Cerrar</button></div></div></div>`);
};

/*
 * Numeración de órdenes: contador persistente y de alta seguridad.
 *
 * El valor orderSequence es un "high-water mark": nunca se reduce, aunque
 * una orden se cancele, se mueva a Papelera, se restaure o se elimine para
 * siempre. La primera vez que se instala esta mejora se inicializa una sola
 * vez a partir del historial ya existente. Después, cada alta reserva el
 * siguiente número junto con la orden dentro de la misma transacción de
 * IndexedDB; por eso dos pestañas no pueden recibir el mismo número.
 */
(() => {
  const ORDER_SEQUENCE_FIELD = 'orderSequence';
  const ORDER_SEQUENCE_READY_FIELD = 'orderSequenceInitializedAt';
  const orderSuffix = value => {
    const match = String(value || '').match(/(\d+)$/);
    const number = match ? Number(match[1]) : 0;
    return Number.isSafeInteger(number) && number >= 0 ? number : 0;
  };
  const validSequence = value => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  };
  const orderPrefix = setting => String(setting?.prefix || 'REV').trim().toUpperCase().replace(/\s+/g, '') || 'REV';
  const formattedOrderNumber = (prefix, sequence) => `${prefix}-${String(sequence).padStart(4, '0')}`;
  const validDateValue = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const [year, month, day] = match.slice(1).map(Number);
    const dateValue = new Date(year, month - 1, day);
    return dateValue.getFullYear() === year && dateValue.getMonth() === month - 1 && dateValue.getDate() === day;
  };
  const allowedOrderStatuses = new Set(['Cotización', 'Aprobada', 'Esperando ingreso', 'En reparación', 'En preparación', 'En pintura', 'En acabado', 'Lista para entregar', 'Entregada', 'Cancelada']);

  function normalizedSetting(setting) {
    return {
      ...(setting || {}),
      id: Number.isFinite(Number(setting?.id)) ? Number(setting.id) : 1,
      workshopId: WID,
      name: setting?.name || 'RevivAuto',
      prefix: orderPrefix(setting)
    };
  }

  function highestExistingSequence(orders) {
    return (orders || [])
      .filter(order => Number(order?.workshopId) === Number(WID))
      .reduce((highest, order) => Math.max(highest, orderSuffix(order.number)), 0);
  }

  api.ensureOrderNumberSequence = async function () {
    const database = await db;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['settings', 'orders'], 'readwrite');
      const settingsStore = transaction.objectStore('settings');
      const ordersStore = transaction.objectStore('orders');
      let result = null;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo preparar la numeración de órdenes.'));
      transaction.onabort = () => reject(transaction.error || new Error('La preparación de la numeración fue cancelada.'));

      const settingRequest = settingsStore.get(1);
      settingRequest.onerror = () => transaction.abort();
      settingRequest.onsuccess = () => {
        const setting = normalizedSetting(settingRequest.result);
        const current = validSequence(setting[ORDER_SEQUENCE_FIELD]);
        const initialized = Boolean(setting[ORDER_SEQUENCE_READY_FIELD]) && current !== null;
        if (initialized) {
          result = { sequence: current, prefix: orderPrefix(setting) };
          return;
        }
        const ordersRequest = ordersStore.getAll();
        ordersRequest.onerror = () => transaction.abort();
        ordersRequest.onsuccess = () => {
          const sequence = Math.max(current || 0, highestExistingSequence(ordersRequest.result));
          const updated = {
            ...setting,
            [ORDER_SEQUENCE_FIELD]: sequence,
            [ORDER_SEQUENCE_READY_FIELD]: new Date().toISOString()
          };
          settingsStore.put(updated);
          result = { sequence, prefix: orderPrefix(updated) };
        };
      };
    });
  };

  api.createOrderWithNextNumber = async function (record) {
    const database = await db;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(['settings', 'orders'], 'readwrite');
      const settingsStore = transaction.objectStore('settings');
      const ordersStore = transaction.objectStore('orders');
      let created = null;
      transaction.oncomplete = () => resolve(created);
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo crear la orden.'));
      transaction.onabort = () => reject(transaction.error || new Error('No se pudo reservar el número de la orden.'));

      const reserve = (rawSetting, currentSequence) => {
        if (currentSequence >= Number.MAX_SAFE_INTEGER) {
          transaction.abort();
          return;
        }
        const setting = normalizedSetting(rawSetting);
        const sequence = currentSequence + 1;
        const number = formattedOrderNumber(orderPrefix(setting), sequence);
        const updatedSetting = {
          ...setting,
          [ORDER_SEQUENCE_FIELD]: sequence,
          [ORDER_SEQUENCE_READY_FIELD]: setting[ORDER_SEQUENCE_READY_FIELD] || new Date().toISOString()
        };
        settingsStore.put(updatedSetting);
        const orderRequest = ordersStore.add({ ...record, workshopId: WID, number });
        orderRequest.onerror = () => transaction.abort();
        orderRequest.onsuccess = () => {
          created = { id: orderRequest.result, number, sequence };
        };
      };

      const settingRequest = settingsStore.get(1);
      settingRequest.onerror = () => transaction.abort();
      settingRequest.onsuccess = () => {
        const setting = normalizedSetting(settingRequest.result);
        const current = validSequence(setting[ORDER_SEQUENCE_FIELD]);
        const initialized = Boolean(setting[ORDER_SEQUENCE_READY_FIELD]) && current !== null;
        if (initialized) {
          reserve(setting, current);
          return;
        }
        /* Migración única: solo si todavía no existía el contador persistente. */
        const ordersRequest = ordersStore.getAll();
        ordersRequest.onerror = () => transaction.abort();
        ordersRequest.onsuccess = () => reserve(setting, Math.max(current || 0, highestExistingSequence(ordersRequest.result)));
      };
    });
  };

  /* Solo eleva el contador: se usa al recuperar copias o historiales previos. */
  api.raiseOrderNumberSequence = async function (minimum) {
    const requested = validSequence(minimum);
    const initialized = await api.ensureOrderNumberSequence();
    const floor = Math.max(initialized.sequence || 0, requested === null ? 0 : requested);
    const database = await db;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('settings', 'readwrite');
      const settingsStore = transaction.objectStore('settings');
      let result = null;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('No se pudo proteger el contador de órdenes.'));
      transaction.onabort = () => reject(transaction.error || new Error('La protección del contador fue cancelada.'));
      const settingRequest = settingsStore.get(1);
      settingRequest.onerror = () => transaction.abort();
      settingRequest.onsuccess = () => {
        const setting = normalizedSetting(settingRequest.result);
        const current = validSequence(setting[ORDER_SEQUENCE_FIELD]) || 0;
        const sequence = Math.max(current, floor);
        if (sequence !== current || !setting[ORDER_SEQUENCE_READY_FIELD]) {
          settingsStore.put({
            ...setting,
            [ORDER_SEQUENCE_FIELD]: sequence,
            [ORDER_SEQUENCE_READY_FIELD]: setting[ORDER_SEQUENCE_READY_FIELD] || new Date().toISOString()
          });
        }
        result = { sequence, prefix: orderPrefix(setting) };
      };
    });
  };

  const saveBeforeOrderSequence = window.save;
  window.save = async function (event) {
    const form = event?.target;
    const formData = form ? new FormData(form) : null;
    if (!formData || formData.get('kind') !== 'order') return saveBeforeOrderSequence(event);
    event.preventDefault();
    try {
      const values = Object.fromEntries(formData);
      const clientId = Number(values.clientId);
      const vehicleId = Number(values.vehicleId);
      const totalText = String(values.total ?? '').trim();
      const total = totalText === '' ? 0 : Number(totalText);
      if (!Number.isFinite(clientId) || clientId <= 0) throw new Error('Selecciona un cliente.');
      if (!Number.isFinite(vehicleId) || vehicleId <= 0) throw new Error('Selecciona un vehículo.');
      if (!validDateValue(values.entryDate)) throw new Error('Indica una fecha de entrada válida.');
      if (values.dueDate && !validDateValue(values.dueDate)) throw new Error('Indica una fecha estimada de entrega válida.');
      if (!allowedOrderStatuses.has(values.status)) throw new Error('Selecciona un estado válido para la orden.');
      if (!Number.isFinite(total) || total < 0) throw new Error('Indica un precio total válido.');

      const [client, vehicle] = await Promise.all([api.get('clients', clientId), api.get('vehicles', vehicleId)]);
      if (!client || Number(client.workshopId) !== Number(WID)) throw new Error('El cliente seleccionado ya no está disponible.');
      if (!vehicle || Number(vehicle.workshopId) !== Number(WID) || Number(vehicle.clientId) !== clientId) {
        throw new Error('El vehículo debe pertenecer al cliente seleccionado.');
      }

      const payload = {
        clientId,
        vehicleId,
        entryDate: values.entryDate,
        dueDate: values.dueDate || '',
        status: values.status,
        total,
        notes: String(values.notes || '').trim()
      };
      if (values.id) {
        const existing = await api.get('orders', Number(values.id));
        if (!existing) throw new Error('No se encontró la orden que intentas modificar.');
        await api.put('orders', { ...existing, ...payload, id: existing.id, workshopId: WID, number: existing.number });
      } else {
        await api.createOrderWithNextNumber(payload);
      }
      close();
      await render();
    } catch (error) {
      alert(`No se pudo guardar la orden: ${error.message || 'Revisa los datos e inténtalo de nuevo.'}`);
    }
  };
  window.save = window.save;

})();

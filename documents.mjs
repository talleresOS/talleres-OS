import {n,day,documentPaymentSummary} from './domain.mjs';
import {DOCUMENT_CSS} from './documents-style.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'RD$'+new Intl.NumberFormat('es-DO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n(v));
const date=v=>/^\d{4}-\d{2}-\d{2}/.test(v||'')?day(v).split('-').reverse().join('/'):'No registrada';
const value=v=>esc(v||'No registrado');
const color=(v,fallback)=>/^#[a-f0-9]{6}$/i.test(v||'')?v:fallback;
export function ink(hex){
  const [r,g,b]=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b>.179?'#000000':'#ffffff';
}
const line=(label,v,cls='')=>'<div class="doc-row '+cls+'"><span>'+label+'</span><strong>'+v+'</strong></div>';
const section=(title,body,cls='')=>'<section class="doc-section '+cls+'"><h2><span class="doc-dot" aria-hidden="true">◆</span>'+title+'</h2>'+body+'</section>';
function groupedWorks(works){
  const groups=new Map();
  for(const w of works||[]){
    const process=w.pieces||w.unspecifiedQuantity?w.description:'Otros trabajos';
    if(!groups.has(process))groups.set(process,new Set());
    for(const piece of w.pieces||[])groups.get(process).add(piece);
    if(w.unspecifiedQuantity)groups.get(process).add(w.unspecifiedQuantity+' piezas sin especificar');
    if(!w.pieces&&!w.unspecifiedQuantity)groups.get(process).add(w.description);
  }
  return '<div class="doc-work-grid">'+([...groups].map(([process,pieces])=>'<div class="doc-work"><h3>'+esc(process)+'</h3><ul>'+[...pieces].map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul></div>').join('')||'<p>No hay trabajos registrados.</p>')+'</div>';
}
export function documentMarkup(i){
  const initial=i.kind==='reception',s=i.workshop||{},c=i.client||{},v=i.vehicle||{},w=i.warranty||{},a=s.appearance||{};
  const primary=color(a.primary,'#263749'),accent=color(a.accent,'#d5dfe8'),summary=documentPaymentSummary(i);
  const logo=/^(data:image\/(png|jpeg|webp);base64,|https?:\/\/)/i.test(s.logoData||'')?'<img src="'+esc(s.logoData)+'" alt="Logo de '+esc(s.name||'taller')+'">':'';
  const status=n(i.balance)===0?'✓ PAGADO':'BALANCE PENDIENTE';
  const header='<header class="doc-header"><div class="doc-brand">'+logo+'<strong>'+value(s.name)+'</strong></div><div class="doc-contact">'+[s.address,s.phone?'Tel. '+s.phone:'',s.whatsapp?'WhatsApp '+s.whatsapp:''].filter(Boolean).map(x=>'<div>'+esc(x)+'</div>').join('')+'</div>'+(!initial?'<div class="doc-invoice-title"><h1>FACTURA</h1><b>N.º '+esc(i.orderNumber||i.number)+'</b><div>Fecha: '+date(i.closedAt||i.issuedAt)+'</div><span class="doc-status '+(n(i.balance)===0?'paid':'pending')+'">'+status+'</span></div>':'')+'</header>';
  const intro=initial?'<div class="doc-intro"><div><h1>COMPROBANTE DE RECEPCIÓN Y ABONO</h1><p>CONSTANCIA DE ENTRADA DEL VEHÍCULO</p></div><div><strong>Orden N.º '+esc(i.orderNumber||i.number)+'</strong><p>Fecha de recepción: <b>'+date(i.entryDate)+'</b><br>Fecha estimada de entrega: <b>'+date(i.dueDate)+'</b></p></div></div>':'';
  const identities='<div class="doc-identities">'+section('DATOS DEL CLIENTE',line('Nombre',value(c.name))+line('Teléfono',value(c.phone))+line('WhatsApp',value(c.whatsapp)))+section('DATOS DEL VEHÍCULO',line('Marca',value(v.brand))+line('Modelo',value(v.model))+line('Año',value(v.year))+line('Color',value(v.color))+line('Matrícula',value(v.plate)))+'</div>';
  const works=section(initial?'TRABAJOS ACORDADOS':'TRABAJOS REALIZADOS',groupedWorks(i.works));
  const texts=initial?'<div class="doc-pair">'+section('CONDICIONES DEL TRABAJO','<p>'+value(i.conditions)+'</p>')+section('OBSERVACIONES DE RECEPCIÓN','<p>'+value(i.receptionNotes)+'</p>')+'</div>':'';
  const payment=i.payments?.[0];
  const economic=section(initial?'RESUMEN DEL PAGO':'RESUMEN ECONÓMICO','<div class="doc-economic"><div>'+line(initial?'Precio total acordado':'Precio del trabajo',money(i.total))+(initial?line('Abono recibido',money(i.paid),'doc-highlight')+line('Balance restante',money(i.balance)):line('Abonos recibidos',money(summary.advances))+line('Pago final',money(summary.final))+line('TOTAL PAGADO',money(i.paid),'doc-highlight')+line('BALANCE',money(i.balance)))+'</div><aside class="doc-payment-callout '+(!initial&&n(i.balance)===0?'paid':'')+'">'+(initial?'<small>Método de pago: '+(payment?value(payment.method):'Sin abono')+'<br>Fecha del abono: '+(payment?date(payment.date):'No registrada')+'</small><b>ABONO RECIBIDO</b><strong>'+money(i.paid)+'</strong>':'<strong>'+status+'</strong>'+(n(i.balance)>0?'<b>'+money(i.balance)+'</b>':'<small>Completado el<br>'+date(i.closedAt||i.issuedAt)+'</small>'))+'</aside></div>');
  const history=initial?'':section('HISTORIAL DE PAGOS','<table><thead><tr><th>Fecha</th><th>Método de pago</th><th>Monto</th></tr></thead><tbody>'+(i.payments||[]).map(p=>'<tr><td>'+date(p.date)+'</td><td>'+value(p.method)+'</td><td>'+money(p.amount)+'</td></tr>').join('')+'</tbody></table>');
  const warranty=initial?'':'<div class="doc-pair">'+section('GARANTÍA DEL TRABAJO',w.kind&&w.kind!=='none'?line('Duración',value(w.kind==='months'?w.months+' meses':w.label))+line('Fecha de inicio',date(w.startDate))+line('Fecha de vencimiento',date(w.endDate))+'<h3>Condiciones</h3><p>'+value(w.conditions)+'</p>':'<p>Sin garantía.</p>')+section('OBSERVACIONES','<p>'+value(i.notes)+'</p>')+'</div>';
  return '<style>'+DOCUMENT_CSS+'</style><article class="customer-document receipt" style="--doc-primary:'+primary+';--doc-accent:'+accent+';--doc-on-primary:'+ink(primary)+';--doc-on-accent:'+ink(accent)+'">'+header+'<div class="doc-body">'+intro+identities+works+texts+economic+history+warranty+'<div class="doc-signatures"><div><div class="doc-signature-line"></div><span>'+(initial?'Firma / aceptación del cliente':'Firma: cliente · Conformidad de entrega')+'</span></div><p>'+(initial?'Este comprobante confirma la recepción del vehículo, los trabajos acordados y el abono recibido.':'Comprobante de servicio y entrega. No es un comprobante fiscal.')+'</p></div>'+(i.supersededAt?'<p>La orden fue reabierta después de emitir este documento.</p>':'')+'</div><footer class="doc-footer"><em>Gracias por confiar en '+esc(s.name||'nuestro taller')+'.</em><span>'+esc(s.phone||s.whatsapp||'')+'</span></footer></article>';
}
export function documentHtml(i){return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc((i.kind==='reception'?'Comprobante ':'Factura ')+(i.orderNumber||i.number))+'</title></head><body class="document-standalone">'+documentMarkup(i)+'</body></html>';}
export function printCustomerDocument(i){
  const iframe=document.createElement('iframe');iframe.className='print-frame';iframe.title='Imprimir documento del cliente';
  iframe.onload=async()=>{const win=iframe.contentWindow;await win.document.fonts.ready;await Promise.all([...win.document.images].map(img=>img.decode().catch(()=>{})));win.focus();win.print();};
  iframe.srcdoc=documentHtml(i);document.body.appendChild(iframe);setTimeout(()=>iframe.remove(),120000);
}

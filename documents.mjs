import {n,day,documentPaymentSummary} from './domain.mjs';
import {warrantyLabel,normalizeWarranty,documentPresentation} from './document-policy.mjs';
import {PIECE_CATALOG} from './work-model.mjs';
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
function groupedWorks(works,showPieces=true){
 const groups=new Map();
 for(const w of works||[]){
  const process=w.pieces||w.unspecifiedQuantity?w.description:'Otros trabajos';
  if(!groups.has(process))groups.set(process,{pieces:new Set(),unspecified:0});
  const g=groups.get(process);for(const piece of w.pieces||[])g.pieces.add(piece);
  g.unspecified+=n(w.unspecifiedQuantity);if(!w.pieces&&!w.unspecifiedQuantity)g.pieces.add(w.description);
 }
 return '<div class="doc-work-grid">'+([...groups].map(([process,g])=>{
  const full=process==='Pintura'&&g.pieces.size===13&&PIECE_CATALOG.every(p=>g.pieces.has(p.name));
  const count=g.pieces.size+g.unspecified;
  return '<div class="doc-work"><h3>'+esc(full?'Pintura completa':process)+' <small>'+count+' '+(count===1?'pieza':'piezas')+'</small></h3>'+(showPieces?'<ul>'+[...g.pieces].map(p=>'<li>'+esc(p)+'</li>').join('')+(g.unspecified?'<li>'+g.unspecified+' piezas sin especificar</li>':'')+'</ul>':'')+'</div>';
 }).join('')||'<p>No hay trabajos registrados.</p>')+'</div>';
}
export function documentMarkup(i){
 const initial=i.kind==='reception',quote=i.kind==='quote'||(!i.kind&&i.version&&i.confirmedAt!==undefined),s=i.workshop||{},c=i.client||{},v=i.vehicle||{},w=normalizeWarranty(i.warranty),a=s.appearance||{},p=documentPresentation(i.presentation);
 const primary=color(p.colorMode==='custom'?p.color:a.primary,'#263749'),accent=color(a.accent,'#d5dfe8'),summary=documentPaymentSummary(i);
 const optional=(label,v)=>v!==undefined&&v!==null&&String(v).trim()!==''?line(label,esc(v)):'';
 const logo=p.showLogo&&/^(data:image\/(png|jpeg|webp);base64,|https?:\/\/)/i.test(s.logoData||'')?'<img src="'+esc(s.logoData)+'" alt="Logo de '+esc(s.name||'taller')+'">':'';
 const samePhone=s.phone&&s.whatsapp&&String(s.phone).replace(/\D/g,'')===String(s.whatsapp).replace(/\D/g,'');
 const phones=samePhone?['Tel. / WhatsApp '+s.phone]:[s.phone?'Tel. '+s.phone:'',s.whatsapp?'WhatsApp '+s.whatsapp:''];
 const footer='<footer class="doc-footer"><div class="doc-footer-brand">'+(logo?logo.replace('<img ','<img class="doc-footer-logo" '):'')+'<strong>'+esc(s.name||'Taller')+'</strong></div><div class="doc-footer-contact">'+[...phones,s.instagram?'Instagram: '+s.instagram:'',s.address?'Ubicación: '+s.address:'',s.website?'Web: '+s.website:'',s.email?'Correo: '+s.email:''].filter(Boolean).map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></footer>';
 const status=quote?(i.confirmedAt?'CONFIRMADA':'PROPUESTA'):n(i.balance)===0?'✓ PAGADO':'SALDO PENDIENTE';
 const title=quote?'COTIZACIÓN':initial?'COMPROBANTE INICIAL':'FACTURA';
 const number=quote?i.number:i.orderNumber||i.number;
 const header='<header class="doc-header"><div class="doc-brand">'+logo+'<div><strong>'+esc(s.name||'Taller')+'</strong><div class="doc-contact">'+[...phones,s.document].filter(Boolean).map(x=>'<div>'+esc(x)+'</div>').join('')+'</div></div></div><div class="doc-invoice-title"><h1>'+title+'</h1><b>N.º '+esc(number)+'</b><div>Fecha: '+date(initial?i.entryDate:i.closedAt||i.issuedAt)+'</div><span class="doc-status '+(!quote&&n(i.balance)===0?'paid':quote?'proposed':'pending')+'">'+status+'</span></div></header>';
 const intro=initial?'<div class="doc-intro"><strong>COMPROBANTE DE RECEPCIÓN Y ABONO</strong><span>CONSTANCIA DE ENTRADA DEL VEHÍCULO</span></div>':'';
 const timing=(quote?optional('Orden relacionada',i.orderNumber):'')+((quote||initial)&&i.dueDate?line('Fecha estimada de entrega',date(i.dueDate)):'');
 const identities='<div class="doc-identities">'+section('DATOS DEL CLIENTE',optional('Nombre',c.name)+optional('Teléfono',c.phone)+optional('WhatsApp',c.whatsapp)+optional('Correo',c.email)+optional('Documento',c.document))+section('DATOS DEL VEHÍCULO',optional('Marca',v.brand)+optional('Modelo',v.model)+optional('Año',v.year)+optional('Color',v.color)+optional('Matrícula',v.plate)+optional('VIN',v.vin))+'</div>';
 const works=section(quote?'TRABAJOS PROPUESTOS':initial?'TRABAJOS ACORDADOS':'TRABAJOS REALIZADOS',groupedWorks(i.works,p.showPieces),'doc-works-section');
 const paragraph=(title,text)=>text?section(title,'<p>'+esc(text)+'</p>','doc-text-section'):'';
 const texts=quote?paragraph('CONDICIONES DE COTIZACIÓN',i.conditions):initial?paragraph('CONDICIONES DEL TRABAJO',i.conditions)+paragraph('OBSERVACIONES DE RECEPCIÓN',i.receptionNotes):'';
 const payment=i.payments?.[0],detailed=quote&&(i.quoteMode||p.quoteMode)==='detailed';
 // Only the existing customer-sale price field is eligible. Never derive from total or employee rates.
 const saleLines=(i.works||[]).filter(x=>Object.hasOwn(x,'price')&&Number.isFinite(Number(x.price))&&Number(x.price)>=0);
 const detail=detailed?section('DETALLE DE VENTA',saleLines.length?'<table><thead><tr><th>Concepto</th><th>Precio de venta</th></tr></thead><tbody>'+saleLines.map(x=>'<tr><td>'+esc(x.description)+'</td><td>'+money(x.price)+'</td></tr>').join('')+'</tbody></table><p class="doc-note">Solo conceptos con precio de venta guardado. El total propuesto corresponde al acuerdo completo.</p>':'<p>No hay precios de venta desglosados guardados. Se conserva el total propuesto sin distribuirlo entre piezas o procesos.</p>'):'';
 const economic=quote?section('RESUMEN ECONÓMICO',line('TOTAL PROPUESTO',money(i.total),'doc-highlight')):section(initial?'RESUMEN DEL PAGO':'RESUMEN ECONÓMICO','<div class="doc-economic"><div>'+line(initial?'Precio total acordado':'Precio del trabajo',money(i.total))+(initial?line('Abono recibido',money(i.paid))+line('Saldo pendiente',money(i.balance),'doc-highlight'):line('Abonos recibidos',money(summary.advances))+line('Pago final',money(summary.final))+line('TOTAL PAGADO',money(i.paid),'doc-highlight')+line('BALANCE',money(i.balance)))+'</div><aside class="doc-payment-callout '+(n(i.balance)===0?'paid':'')+'">'+(initial?'<small>'+(payment?'Método de pago: '+esc(payment.method||'')+'<br>Fecha del abono: '+date(payment.date):'Sin abono registrado')+'</small><b>SALDO PENDIENTE</b><strong>'+money(i.balance)+'</strong>':'<strong>'+status+'</strong>'+(n(i.balance)>0?'<b>'+money(i.balance)+'</b>':'<small>Completado el '+date(i.closedAt||i.issuedAt)+'</small>'))+'</aside></div>');
 const history=quote||initial?'':section('HISTORIAL DE PAGOS','<table><thead><tr><th>Fecha</th><th>Método de pago</th><th>Monto</th></tr></thead><tbody>'+(i.payments||[]).map(p=>'<tr><td>'+date(p.date)+'</td><td>'+esc(p.method||'')+'</td><td>'+money(p.amount)+'</td></tr>').join('')+'</tbody></table>','doc-payments');
 const warranty=section(quote||initial?'GARANTÍA PROPUESTA':'GARANTÍA DEL TRABAJO',w.kind!=='none'?'<p class="doc-warranty-duration">'+esc(warrantyLabel(w))+'</p>'+(!quote&&!initial?(w.startDate?line('Fecha de inicio',date(w.startDate)):'')+(w.endDate?line('Fecha de vencimiento',date(w.endDate)):''):'<p class="doc-note">Desde la entrega del vehículo.</p>')+(w.conditions?'<h3>Condiciones</h3><p>'+esc(w.conditions)+'</p>':''):'<p>Sin garantía.</p>','doc-warranty doc-text-section');
 const signature=p.showSignature?'<div class="doc-signatures" data-signature-purpose="'+(quote?'quotation':initial?'reception':'delivery')+'"><div class="doc-signature-line"></div><span>'+(quote?'Firma: cliente · Conforme a la cotización':initial?'Firma / aceptación del cliente':'Firma: cliente · Conformidad de entrega')+'</span></div>':'';
 const notice=quote?'Cotización de servicio. No es una factura ni un comprobante de pago.':initial?'Este comprobante confirma la recepción del vehículo, los trabajos acordados y el abono recibido.':'Comprobante de servicio y entrega. No es un comprobante fiscal.';
 return '<style>'+DOCUMENT_CSS+'</style><article class="customer-document receipt doc-style-'+p.style+'" style="--doc-primary:'+primary+';--doc-accent:'+accent+';--doc-on-primary:'+ink(primary)+';--doc-on-accent:'+ink(accent)+'">'+header+'<div class="doc-body">'+intro+(timing?'<div class="doc-timing">'+timing+'</div>':'')+identities+works+detail+economic+history+texts+warranty+(!initial&&!quote?paragraph('OBSERVACIONES',i.notes):'')+signature+'<p class="doc-legal">'+notice+'</p>'+(i.supersededAt?'<p>La orden fue reabierta después de emitir este documento.</p>':'')+'</div>'+footer+'</article>';
}
export function documentHtml(i){return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc((i.kind==='quote'?'Cotización ':i.kind==='reception'?'Comprobante ':'Factura ')+(i.orderNumber||i.number))+'</title></head><body class="document-standalone">'+documentMarkup(i)+'</body></html>';}
export function printCustomerDocument(i){
  const iframe=document.createElement('iframe');iframe.className='print-frame';iframe.title='Imprimir documento del cliente';
  iframe.onload=async()=>{const win=iframe.contentWindow;await win.document.fonts.ready;await Promise.all([...win.document.images].map(img=>img.decode().catch(()=>{})));win.focus();win.print();};
  iframe.srcdoc=documentHtml(i);document.body.appendChild(iframe);setTimeout(()=>iframe.remove(),120000);
}

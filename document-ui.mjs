import {find,paid,balance,today} from './domain.mjs';
import {catalog,PROCESSES,PIECE_CATALOG,isFullPaint} from './work-model.mjs';
import {documentMarkup,documentHtml,printCustomerDocument} from './documents.mjs';
export function createDocumentUI(h){
  const {service,data,esc,button,field,select,textarea,row,money,openDialog,render,toast,download}=h;
  let shown;
  function show(i){
    if(!i){toast('Esta orden histórica no tiene este documento guardado.');return;}
    shown=i;openDialog(i.kind==='reception'?'Comprobante inicial':'Factura final',documentMarkup(i)+'<div class="doc-controls">'+button('Imprimir / Guardar PDF','document-print')+button('Compartir por WhatsApp','document-whatsapp')+button('Descargar','document-download')+button('Cerrar','dialog-close')+'</div>');
    document.querySelector('#dialog').classList.add('document-dialog');
  }
  function pieceRow(){return '<div class="reception-piece">'+field('Pieza','receptionPieceName','','text','list="reception-catalog" maxlength="100" placeholder="Selecciona o escribe una pieza"')+'<fieldset><legend>Procesos de esta pieza</legend><div class="reception-processes">'+PROCESSES.map(p=>'<label><input type="checkbox" value="'+esc(p)+'">'+esc(p)+'</label>').join('')+'</div></fieldset>'+button('Quitar pieza','reception-remove','','quiet')+'</div>';}
  function creationFields(){
    return '<section class="full reception-builder"><h3>Piezas y trabajos acordados</h3><p class="help">Selecciona todos los procesos de cada pieza. Puedes asignar empleados después, en producción.</p><datalist id="reception-catalog"><option value="Pintura completa">'+catalog(data().settings[0]).map(p=>'<option value="'+esc(p.name)+'">').join('')+'</datalist><div class="reception-pieces">'+pieceRow()+'</div>'+button('Pintura completa · 13 piezas','reception-full','','primary')+button('+ Agregar pieza','reception-add')+'</section>'+field('Abono inicial','initialAmount',0,'number')+select('Método del abono','initialMethod',['Efectivo','Transferencia','Tarjeta','Otro'],'Efectivo')+field('Fecha del abono','initialDate','','date')+'<p class="help full">Si dejas la fecha del abono vacía se usará la fecha de recepción. El abono se guarda una sola vez en el historial de pagos.</p>';
  }
  function creationValues(form){return {createReception:true,receptionPieces:[...form.querySelectorAll('.reception-piece')].map(el=>({name:el.querySelector('input[name="receptionPieceName"]').value.trim(),processes:[...el.querySelectorAll('input[type="checkbox"]:checked')].map(c=>c.value)})).filter(p=>p.name||p.processes.length)};}
  function expandFullPaint(){
    const container=document.querySelector('.reception-pieces');if(!container)return;
    const normalize=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    const macros=[...container.children].filter(el=>isFullPaint(el.querySelector('[name="receptionPieceName"]').value));
    const processes=new Set(['Pintura',...macros.flatMap(el=>[...el.querySelectorAll('input[type="checkbox"]:checked')].map(c=>c.value))]);
    macros.forEach(el=>el.remove());
    for(const piece of PIECE_CATALOG){
      let el=[...container.children].find(el=>normalize(el.querySelector('[name="receptionPieceName"]').value)===normalize(piece.name));
      if(!el)el=[...container.children].find(el=>!el.querySelector('[name="receptionPieceName"]').value.trim());
      if(!el){container.insertAdjacentHTML('beforeend',pieceRow());el=container.lastElementChild;}
      el.querySelector('[name="receptionPieceName"]').value=piece.name;
      el.querySelectorAll('input[type="checkbox"]').forEach(c=>{if(processes.has(c.value))c.checked=true;});
    }
    toast('13 piezas seleccionadas. Puedes quitar, agregar o cambiar cada pieza y sus procesos.');
  }
  function closingForm(o){
    const w=o.warranty||{kind:'none'};
    openDialog('Finalizar y entregar','<div class="summary full">'+row('Orden',esc(o.number))+row('Cliente',esc(find(data(),'clients',o.clientId)?.name))+row('Precio total',money(o.total))+row('Total pagado',money(paid(data(),o.id)))+row('Balance',money(balance(data(),o)))+'</div>'+select('Tiene garantía','hasWarranty',[['no','No'],['yes','Sí']],w.kind==='none'?'no':'yes')+field('Duración de garantía','warrantyDuration',w.kind==='months'?w.months+' meses':w.label)+field('Inicio de garantía','warrantyStart',w.startDate||today(),'date')+field('Vencimiento de garantía','warrantyEnd',w.endDate||'','date')+textarea('Condiciones de garantía','warrantyConditions',w.conditions)+textarea('Observaciones finales','finalNotes',o.customerNotes)+'<p class="help full">Revisa la garantía acordada con el cliente antes de cerrar. Sus condiciones y fechas quedarán guardadas en esta orden.</p>','document-close',{orderId:o.id},'Finalizar orden');
  }
  async function handleAction(action,target){
    if(action==='reception-full'){
      expandFullPaint();return true;
    }
    if(action==='reception-add'){document.querySelector('.reception-pieces').insertAdjacentHTML('beforeend',pieceRow());return true;}
    if(action==='reception-view'){show(find(data(),'orders',target)?.initialReceipt);return true;}
    if(action==='invoice'){const o=find(data(),'orders',target);show(find(data(),'invoices',o?.invoiceId));return true;}
    if(action==='invoice-id'){show(find(data(),'invoices',target));return true;}
    if(action==='close-order'){closingForm(find(data(),'orders',target));return true;}
    if(!action.startsWith('document-'))return false;
    if(!shown)throw Error('Abre el documento primero.');
    const filename=(shown.kind==='reception'?'Comprobante-':'Factura-')+(shown.orderNumber||shown.number)+'.html';
    if(action==='document-print')printCustomerDocument(shown);
    if(action==='document-download')download(filename,documentHtml(shown),'text/html');
    if(action==='document-whatsapp'){
      const file=new File([documentHtml(shown)],filename,{type:'text/html'});
      if(navigator.canShare?.({files:[file]})){await navigator.share({title:shown.orderNumber,files:[file]});return true;}
      let phone=String(shown.client.whatsapp||shown.client.phone||'').replace(/\D/g,'');
      if(phone.length===10&&/^(809|829|849)/.test(phone))phone='1'+phone;
      download(filename,documentHtml(shown),'text/html');
      const message=(shown.workshop.name||'Taller')+' · '+(shown.kind==='reception'?'Comprobante de recepción':'Factura')+' '+(shown.orderNumber||shown.number)+'. Cliente: '+shown.client.name+'. Total: '+money(shown.total)+'. Pagado: '+money(shown.paid)+'. Balance: '+money(shown.balance)+'.';
      openDialog('Compartir por WhatsApp','<p>Documento descargado. WhatsApp abrirá un mensaje preparado; el archivo no se adjunta automáticamente. Adjunta el archivo descargado o el PDF guardado desde Imprimir.</p><a class="btn" target="_blank" rel="noopener" href="https://wa.me/'+phone+'?text='+encodeURIComponent(message)+'">Abrir WhatsApp</a>'+button('Volver al documento','document-back'));
    }
    if(action==='document-back')show(shown);
    return true;
  }
  async function submit(form,context){
    if(form.dataset.form!=='document-close')return false;
    const invoice=await service.closeOrder(context.orderId,Object.fromEntries(new FormData(form)));await render();show(invoice);toast('Orden finalizada. Factura generada y guardada en el historial.');return true;
  }
  return {show,creationFields,creationValues,handleAction,submit,expandFullPaint,isFullPaint};
}

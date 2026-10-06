import {documentMarkup,documentHtml as customerDocumentHtml,printCustomerDocument} from './documents.mjs';
import {warrantyLabel,documentPresentation} from './document-policy.mjs';
import {n,round,find,belongs,active,closed,financial} from './domain.mjs';
import {PROCESSES,WORK_STATES,catalog,fullCar,worksFor,piecesFor,workFrozen,workPieceNames,PIECE_CATALOG} from './work-model.mjs';
export function createWorkUI(h){
  const {service,data,esc,button,field,select,textarea,row,badge,empty,money,date,openDialog,confirmAction,toast,render,navigate,download}=h;
  const check=(name,value,label,checked)=>'<label class="piece-choice"><input type="checkbox" name="'+name+'" value="'+esc(value)+'" '+(checked?'checked':'')+'><span>'+esc(label)+'</span></label>';
  const shortList=names=>'<ul class="piece-names">'+names.slice(0,2).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+(names.length>2?'<details class="more-pieces"><summary>+ '+(names.length-2)+' más</summary><ul class="piece-names">'+names.slice(2).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':'');
  function pieceList(w){
    return w.unspecifiedQuantity?'<p class="notice">'+esc(w.unspecifiedQuantity)+' piezas sin especificar</p>':shortList(workPieceNames(data(),w));
  }
  function workCard(w,editable=true){
    const employee=find(data(),'employees',w.employeeId),frozen=workFrozen(w);
    return '<article class="card work-card" data-work-id="'+esc(w.id)+'"><div class="split"><h3>'+esc(w.process)+'</h3>'+badge(w.cancelled?'Retirado':w.status)+'</div><p><strong>'+esc(employee?.name||'Sin asignar')+'</strong> · '+w.quantity+' pieza'+(w.quantity===1?'':'s')+(employee?' · '+money(w.total):'')+'</p>'+pieceList(w)+(find(data(),'orders',w.orderId)?.fullPaintHistoricalNotice?'<p class="notice">'+esc(find(data(),'orders',w.orderId).fullPaintHistoricalNotice)+'</p>':'')+(w.legacyDescription?'<small class="block">Registro anterior: '+esc(w.legacyDescription)+'</small>':'')+(employee?'<small class="block">'+(w.mode==='Por pieza'?w.quantity+' × '+money(w.rate):'Monto fijo')+' · '+({generated:'Devengado',legacy:'Importe histórico conservado',pending:'Asignado',invalid:'Revisar'}[w.ledgerState]||'Asignado')+'</small>':'')+(editable&&!w.cancelled?'<div class="piece-actions">'+(!employee?button('Asignar empleado','work-edit',w.id,'compact'):w.status!=='Terminado'?button('Terminar','work-finish',w.id,'compact'):'<span class="piece-complete">✓ Terminado</span>')+button('<span aria-hidden="true">•••</span><span class="sr-only">Opciones de '+esc(w.process)+'</span>','work-menu',w.id,'icon')+'</div>':'')+'</article>';
  }
  function orderContent(o){
    const editable=active(o),pieces=piecesFor(data(),o.id),jobs=worksFor(data(),o.id),removed=worksFor(data(),o.id,true).filter(w=>w.cancelled),unassigned=pieces.filter(p=>!jobs.some(w=>w.selectedPieceIds.includes(p.id)));
    return '<section class="panel"><div class="section-title"><div><h2>Piezas del vehículo</h2><small>'+pieces.length+' piezas activas</small></div>'+(editable?button('Seleccionar piezas','pieces-select',o.id,'compact'):'')+'</div>'+shortList(pieces.map(p=>p.name))+(editable&&pieces.length?'<details><summary>Corregir una pieza</summary><p class="help">Retira una pieza agregada por error. Solo se ajustan sus trabajos sin devengos; el comprobante original se conserva.</p>'+pieces.map(p=>row(esc(p.name),button('Retirar','piece-retire',p.id,'quiet danger-text'))).join('')+'</details>':'')+(!pieces.length?'<p class="help">Define las piezas del vehículo. Los registros antiguos sin identificar se conservan debajo.</p>':'')+'</section>'+(unassigned.length?'<p class="notice">'+unassigned.length+' piezas aún sin un proceso asignado.</p>':'')+'<section><div class="section-title"><h2>Procesos y trabajos</h2>'+(editable&&pieces.length?button('Asignar trabajo','work-new',o.id,'compact'):'')+'</div><div class="list">'+(jobs.map(w=>workCard(w,editable)).join('')||empty('Sin procesos activos. Selecciona las piezas y asigna el primer trabajo.'))+'</div>'+(removed.length?'<details class="removed-parts"><summary>Trabajos retirados ('+removed.length+')</summary><p class="help">No cuentan como pendientes. Sus devengos y pagos se conservan.</p>'+removed.map(w=>'<div class="movement">'+workCard(w,false)+(editable?button('Restaurar trabajo','work-restore',w.id,'quiet'):'')+'</div>').join('')+'</details>':'')+(!jobs.length&&!pieces.length&&editable?button('Confirmar trabajos terminados','work-finish',o.id,'quiet').replace('data-action="work-finish"','data-action="work-finish-empty"'):'')+'</section>'+documents(o);
  }
  function productionContent(o){
    const jobs=worksFor(data(),o.id),done=jobs.filter(w=>w.status==='Terminado').length;
    return '<p class="muted">'+done+' / '+jobs.length+' procesos terminados</p><div class="list">'+jobs.map(w=>workCard(w,true)).join('')+'</div>';
  }
  function piecesForm(orderId){
    const selected=new Set(piecesFor(data(),orderId).map(p=>p.catalogId));
    openDialog('Piezas del vehículo','<div class="full"><div class="inline-actions">'+button('Pintura completa · 13 piezas','pieces-paint')+button('Carro completo','pieces-full')+button('Quitar selección','pieces-clear','','quiet')+'</div><label class="field"><span>Buscar pieza</span><input type="search" data-piece-search placeholder="Puerta, bumper, techo…"></label><p class="selection-count" aria-live="polite"></p><div class="piece-picker">'+catalog(data().settings[0]).map(p=>check('catalogIds',p.id,p.name,selected.has(p.id))).join('')+'</div><div class="custom-piece"><label class="field"><span>Pieza personalizada</span><input name="customPieceName" maxlength="100" placeholder="Ej. retrovisor derecho"></label>'+button('+ Agregar pieza personalizada','pieces-custom')+'</div><div class="custom-pieces"></div><p class="help">Las piezas utilizadas por un trabajo activo deben retirarse primero de ese trabajo.</p></div>','order-pieces',{orderId},'Guardar piezas');
    updatePicker();
  }
  function workForm(orderId,id){
    const w=id?find(data(),'workAssignments',id):{},pieces=piecesFor(data(),orderId),locked=id&&workFrozen(w);
    const processes=PROCESSES.includes(w.process)||!w.process?PROCESSES:[w.process,...PROCESSES];
    const employees=[['','Sin asignar'],...data().employees.filter(e=>e.active!==false||e.id===w.employeeId).map(e=>[e.id,e.name])];
    const extra=locked?'disabled':'';
    openDialog(id?'Editar asignación':'Asignar trabajo',
      select('Proceso','process',processes,w.process||PROCESSES[0])+select('Empleado','employeeId',employees,w.employeeId||'',extra)+(locked?'<input type="hidden" name="employeeId" value="'+esc(w.employeeId||'')+'">':'')+
      '<div class="full"><h3>Piezas</h3>'+(pieces.length>6?'<details><summary>Buscar entre las piezas de la orden</summary><input type="search" aria-label="Buscar piezas de la orden" data-piece-search></details>':'')+'<div class="inline-actions">'+(PIECE_CATALOG.every(c=>pieces.some(p=>p.catalogId===c.id))?button('Pintura completa · 13 piezas','work-paint','','quiet'):'')+button('Seleccionar todas','work-pieces-all','','quiet')+button('Quitar selección','pieces-clear','','quiet')+'</div><p class="selection-count" aria-live="polite"></p><div class="piece-picker">'+pieces.map(p=>check('pieceIds',p.id,p.name,(w.selectedPieceIds||[]).includes(p.id))).join('')+'</div></div>'+
      (w.unspecifiedQuantity?'<p class="notice full">'+w.unspecifiedQuantity+' piezas sin especificar. Puedes identificar exactamente esas piezas; dejar la selección vacía conserva el registro histórico.</p>':'')+
      select('Forma de pago','mode',['Por pieza','Monto fijo'],w.mode||'Por pieza',extra)+(locked?'<input type="hidden" name="mode" value="'+esc(w.mode)+'">':'')+
      field('Tarifa por pieza / monto','rate',w.rate||0,'number',locked?'readonly':'required')+
      '<div class="work-total full" aria-live="polite"></div>'+ (locked?'<p class="help full">Importe histórico protegido. Identificar piezas no cambia su cantidad, empleado, tarifa, devengo ni pago.</p>':'')+
      '<details class="full"><summary>Nota interna opcional</summary>'+textarea('Nota interna','notes',w.notes)+'</details>','work-assignment',{orderId,id,unspecifiedQuantity:w.unspecifiedQuantity||0,locked,originalTotal:w.total},'Guardar asignación');
    updatePicker();
  }
  function updatePicker(){
    const dialog=document.querySelector('#dialog'),form=dialog.querySelector('form');if(!form)return;
    const count=form.querySelectorAll('.piece-choice input:checked').length;
    const label=form.querySelector('.selection-count');if(label)label.textContent=count+' piezas seleccionadas';
    const total=form.querySelector('.work-total');
    if(total){
      const v=new FormData(form),c=h.context(),q=count||c.unspecifiedQuantity||0,rate=n(v.get('rate')),fixed=v.get('mode')==='Monto fijo';
      const value=c.locked?c.originalTotal:v.get('employeeId')?round(fixed?rate:q*rate):0;
      total.innerHTML='<span>TOTAL EMPLEADO</span><strong>'+money(value)+'</strong><small>'+(fixed?'Monto fijo':q+' piezas × '+money(rate))+'</small>';
    }
  }
  function warrantyMarkup(w){
    if(!w||w.kind==='none')return '';
    return '<section class="document-warranty"><h2>Garantía</h2><p>'+esc(warrantyLabel(w))+'</p>'+(w.conditions?'<p>'+esc(w.conditions)+'</p>':'')+'</section>';
  }
  const quoteMarkup=q=>documentMarkup({...q,kind:'quote'});
  function showQuote(q){
    const editable=active(find(data(),'orders',q.orderId));
    openDialog('Cotización '+q.number,quoteMarkup(q)+'<div class="dialog-actions">'+(editable&&!q.confirmedAt?button('Confirmar precio acordado','quote-confirm',q.id,'primary'):'')+button('Enviar por WhatsApp','quote-whatsapp',q.id)+button('Compartir','quote-share',q.id)+button('Imprimir / PDF','quote-print',q.id)+button('Descargar documento','quote-download',q.id)+'</div>');
    document.querySelector('#dialog').classList.add('document-dialog');
  }
  function documents(o){
    const quotes=data().quotations.filter(q=>belongs(q,o.id));
    return '<section class="panel"><div class="section-title"><h2>Cotización y acuerdo</h2>'+(active(o)?button('Crear cotización','quote-new',o.id,'compact'):'')+'</div>'+row('Precio de la orden',money(o.total))+(o.agreement?row('Último acuerdo',money(o.agreement.price)+' · '+date(o.agreement.confirmedAt)): '<p class="help">Sin acuerdo confirmado. Crea y revisa una cotización para confirmar precio y garantía.</p>')+(o.agreementStale?'<p class="notice">El precio cambió. Confirma una nueva cotización antes de entregar.</p>':'')+quotes.map(q=>row(esc(q.number)+' · '+money(q.total),button(q.confirmedAt?'Ver confirmada':'Ver cotización','quote-view',q.id,'quiet'))).join('')+warrantyMarkup(o.warranty)+((o.priceHistory||[]).length?'<details><summary>Historial de precios</summary>'+o.priceHistory.map(p=>row(date(p.at),money(p.from)+' → '+money(p.to))).join('')+'</details>':'')+((o.agreementHistory||[]).length>1?'<details><summary>Acuerdos anteriores</summary>'+o.agreementHistory.map(a=>row(esc(a.quoteNumber),money(a.price)+' · '+date(a.confirmedAt))).join('')+'</details>':'')+'</section>';
  }
  function settingsExtra(){
    const s=data().settings[0],w=s.warranty||{kind:'none'};
    return '<section class="panel"><h2>Garantía</h2><form data-form="work-warranty" class="form">'+select('Garantía del taller','warrantyChoice',[['none','Sin garantía'],['3','3 meses'],['6','6 meses'],['12','12 meses / 1 año'],['custom','Personalizada']],w.kind==='months'?String(w.months):w.kind)+field('Garantía personalizada','warrantyLabel',w.label)+textarea('Condiciones de garantía','warrantyConditions',w.conditions)+textarea('Condiciones de cotización','quoteConditions',s.quoteConditions)+'<p class="help full">Cada cotización conserva su garantía. Los cambios se aplican a documentos nuevos.</p><div class="full"><button class="btn">Guardar garantía</button></div></form></section><section class="panel"><h2>Carro completo</h2><p class="help">Selecciona las piezas de tu conjunto habitual. Puedes adaptar cada orden después.</p><form data-form="full-car"><div class="piece-picker">'+catalog(s).map(p=>check('fullCarIds',p.id,p.name,fullCar(s).includes(p.id))).join('')+'</div><p>'+fullCar(s).length+' piezas configuradas</p><button class="btn">Guardar carro completo</button></form></section>';
  }
  async function handleAction(action,target){
    const d=data();
    if(action==='pieces-select'){piecesForm(target);return true;}
    if(['pieces-full','pieces-paint','pieces-clear','work-pieces-all'].includes(action)){
      document.querySelectorAll('#dialog .piece-choice input').forEach(el=>{el.checked=action==='pieces-paint'?PIECE_CATALOG.some(p=>p.id===el.value):action==='pieces-full'?fullCar(d.settings[0]).includes(el.value):action==='work-pieces-all';});updatePicker();return true;
    }
    if(action==='work-paint'){
      const ids=piecesFor(d,h.context().orderId).filter(p=>PIECE_CATALOG.some(c=>c.id===p.catalogId)).map(p=>p.id);
      document.querySelectorAll('#dialog [name="pieceIds"]').forEach(el=>el.checked=ids.includes(el.value));updatePicker();return true;
    }
    if(action==='pieces-custom'){
      const input=document.querySelector('#dialog [name="customPieceName"]'),name=input.value.trim();if(!name)return true;
      document.querySelector('#dialog .custom-pieces').insertAdjacentHTML('beforeend',check('customNames',name,name,true));input.value='';updatePicker();return true;
    }
    if(action==='work-new'||action==='work-edit'){
      const w=action==='work-edit'?find(d,'workAssignments',target):null;workForm(w?.orderId||target,w?.id);return true;
    }
    if(action==='work-finish-pieces'){
      const w=find(d,'workAssignments',target);
      openDialog('Terminar piezas · '+w.process,'<p class="help full">Selecciona únicamente las piezas terminadas. Las demás mantienen su estado y su importe pendiente.</p><div class="piece-picker full">'+piecesFor(d,w.orderId).filter(p=>w.selectedPieceIds.includes(p.id)).map(p=>check('pieceIds',p.id,p.name,false)).join('')+'</div>','work-finish-selection',{orderId:w.orderId,process:w.process},'Confirmar piezas terminadas');return true;
    }
    if(action==='work-menu'){
      const w=find(d,'workAssignments',target);
      openDialog(w.process,'<div class="menu-list">'+button('Editar asignación','work-edit',w.id)+(w.status==='Pendiente'?button('Iniciar trabajo','work-start',w.id):'')+(w.status==='Terminado'?button('Reabrir trabajo','work-reopen',w.id):'')+(w.employeeId&&w.status!=='Terminado'&&!workFrozen(w)&&w.mode==='Por pieza'&&w.selectedPieceIds.length>1?button('Terminar piezas seleccionadas','work-finish-pieces',w.id):'')+button('Retirar asignación','work-cancel',w.id,'quiet danger-text')+'</div>');return true;
    }
    const confirms={
      'piece-retire':['Retirar '+(find(d,'vehiclePieces',target)?.name||'pieza'),'Se quitará solo esta pieza de los procesos pendientes y se ajustará la tarifa por pieza. Los montos fijos restantes se conservan. El comprobante inicial no cambia. No se permite si tiene trabajos terminados o devengos.','Retirar pieza'],
      'work-finish':['Terminar este proceso','Solo se termina este trabajo. Los demás procesos y la entrega siguen independientes. El devengo no equivale a pago.','Terminar trabajo'],
      'work-reopen':['Reabrir trabajo','Se conservan los devengos y pagos. Terminar nuevamente no los duplicará.','Reabrir'],
      'work-cancel':['Retirar asignación','Sale de los trabajos pendientes. Los devengos, costos históricos y pagos registrados se conservan. Podrás restaurarla.','Retirar'],
      'work-restore':['Restaurar asignación','Volverá con su estado e importes anteriores, sin generar movimientos duplicados.','Restaurar'],
      'quote-confirm':['Confirmar precio acordado','Se guardarán el precio, las condiciones y la garantía de esta versión dentro de la orden. Los acuerdos anteriores se conservan.','Confirmar acuerdo'],
      'work-finish-empty':['Confirmar trabajos terminados','Confirma que no queda ningún proceso pendiente en esta orden. La entrega y el cobro son pasos separados.','Confirmar']
    };
    if(confirms[action]){const [title,body,label]=confirms[action];confirmAction(title,body,action+'-yes',target,label);return true;}
    const mutations={
      'piece-retire-yes':()=>service.retireOrderPiece(target),
      'work-finish-yes':()=>service.workState(target,'Terminado'),
      'work-reopen-yes':()=>service.workState(target,'En proceso'),
      'work-start':()=>service.workState(target,'En proceso'),
      'work-cancel-yes':()=>service.cancelWork(target),
      'work-restore-yes':()=>service.cancelWork(target,true),
      'work-finish-empty-yes':()=>service.markFinished(target),
      'quote-confirm-yes':()=>service.confirmQuote(target)
    };
    if(mutations[action]){await mutations[action]();document.querySelector('#dialog').close();await render();toast(action==='work-finish-yes'?'Trabajo terminado.':action==='work-start'?'Trabajo iniciado.':'Cambios guardados.');return true;}
    if(action==='quote-new'){
      const o=find(d,'orders',target);openDialog('Crear cotización',field('Precio propuesto al cliente','quotePrice',o.total,'number','required')+select('Tipo de cotización','quoteMode',[['summary','Resumida'],['detailed','Detallada']],documentPresentation(d.settings[0].documents).quoteMode)+textarea('Condiciones para el cliente','quoteConditions',d.settings[0].quoteConditions)+'<p class="help full">Se incluirán las piezas, procesos y garantía configurada. Los pagos de empleados quedan fuera del documento.</p>','work-quote',{orderId:o.id},'Generar cotización');return true;
    }
    if(action.startsWith('quote-')){
      const q=find(d,'quotations',target);if(!q)throw Error('Cotización no encontrada.');
      const html=customerDocumentHtml({...q,kind:'quote'}),filename=q.number+'.html';
      if(action==='quote-view')showQuote(q);
      if(action==='quote-print')printCustomerDocument({...q,kind:'quote'});
      if(action==='quote-download')download(filename,html,'text/html');
      if(action==='quote-share'){
        const file=new File([html],filename,{type:'text/html'});
        if(navigator.canShare?.({files:[file]}))await navigator.share({title:q.number,files:[file]});
        else {download(filename,html,'text/html');toast('Documento descargado. Puedes adjuntarlo manualmente.');}
      }
      if(action==='quote-whatsapp'){
        let phone=String(q.client.whatsapp||q.client.phone||'').replace(/\D/g,'');
        if(phone.length===10&&/^(809|829|849)/.test(phone))phone='1'+phone;
        const message=(q.workshop.name||'Taller')+' · Cotización '+q.number+' para '+q.client.name+'. '+[q.vehicle.brand,q.vehicle.model].filter(Boolean).join(' ')+'. Total: '+money(q.total)+'.';
        download(filename,html,'text/html');
        openDialog('Enviar por WhatsApp','<p>El documento se descargó. Adjunta ese archivo o guarda un PDF con “Imprimir / PDF”. WhatsApp se abrirá con el mensaje preparado; el archivo no se adjunta automáticamente.</p><a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/'+phone+'?text='+encodeURIComponent(message)+'">Abrir WhatsApp</a>');
      }
      return true;
    }
    return false;
  }
  async function submit(form,c){
    const f=new FormData(form),v=Object.fromEntries(f);
    if(form.dataset.form==='work-finish-selection'){await service.workSelectionState(c.orderId,c.process,f.getAll('pieceIds'),'Terminado');return true;}
    if(form.dataset.form==='order-pieces'){await service.saveOrderPieces(c.orderId,f.getAll('catalogIds'),f.getAll('customNames'));return true;}
    if(form.dataset.form==='work-assignment'){
      const values={...v,selectedPieceIds:f.getAll('pieceIds')},old=c.id?find(data(),'workAssignments',c.id):null;
      if(v.employeeId&&(!old||!old.employeeId&&!workFrozen(old)&&old.process===v.process&&!old.unspecifiedQuantity))await service.assignWorkSelection(c.orderId,values);
      else await service.saveWork(c.orderId,values,c.id);
      return true;
    }
    if(form.dataset.form==='full-car'){await service.settings({fullCarPieceIds:f.getAll('fullCarIds')});return true;}
    if(form.dataset.form==='work-warranty'){
      const choice=v.warrantyChoice;
      await service.settings({warranty:{kind:['3','6','12'].includes(choice)?'months':choice,months:Number(choice),label:v.warrantyLabel,conditions:v.warrantyConditions},quoteConditions:v.quoteConditions});return true;
    }
    if(form.dataset.form==='work-quote'){
      const q=await service.createQuote(c.orderId,v.quoteConditions,v.quotePrice,{mode:v.quoteMode});await render();showQuote(q);return 'keep-dialog';
    }
    return false;
  }
  function employeeAssignment(a){
    if(a.id)return '<div class="movement"><a class="back" href="#order/'+a.orderId+'">'+esc(find(data(),'orders',a.orderId)?.number||'Ver orden')+'</a>'+workCard(a,false)+'</div>';
    return row(esc(a.work||'Trabajo histórico')+' · '+esc(find(data(),'orders',a.orderId)?.number),money(a.total));
  }
  return {orderContent,productionContent,workCard,piecesForm,workForm,updatePicker,settingsExtra,handleAction,submit,documents,warrantyMarkup,employeeAssignment};
}

import assert from 'node:assert/strict';
import {writeFile,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {start,out,root} from './harness.mjs';
const h=await start(),{page:p,origin}=h,logs=[];
const pass=name=>{logs.push(name);console.log('PASS '+name);};
const button=name=>p.getByRole('button',{name,exact:true}),field=name=>p.getByLabel(name,{exact:true});
const closed=()=>p.waitForFunction(()=>!document.querySelector('#dialog').open);
const submit=async name=>{await button(name).click();await closed();};
const go=async route=>{await p.goto(origin+'/index.html#'+route);await p.locator('.top').waitFor();};
const work=process=>p.locator('.work-card').filter({has:p.getByRole('heading',{name:process,exact:true})});
try{
 await go('clients');await button('Nuevo cliente').click();await field('Nombre completo').fill('Cliente de prueba');await field('Teléfono').fill('8095550303');await submit('Guardar cliente');await p.waitForURL('**#client/*');
 await button('Agregar vehículo').click();await field('Marca').fill('Lexus');await field('Modelo').fill('G350');await submit('Guardar vehículo');
 const ids=await p.evaluate(async()=>{const {TallerService}=await import('./service.mjs'),s=new TallerService();return Promise.all([s.saveEmployee({name:'David',pieceRate:500}),s.saveEmployee({name:'Francisco',pieceRate:300}),s.saveEmployee({name:'Carlos',pieceRate:400})]);});
 await go('orders');await button('Nueva orden').click();await field('Vehículo').selectOption({label:'Lexus · G350'});await field('Precio acordado').fill('50000');await field('Entrega prevista').fill('2026-12-31');await button('Guardar orden').click();await p.locator('.customer-document').waitFor();await button('Cerrar').click();await p.waitForURL('**#order/*');const orderRoute=p.url().split('#')[1];
 await button('Seleccionar piezas').click();
 for(const name of ['Bumper delantero','Guardalodo delantero izquierdo','Puerta delantera izquierda','Puerta trasera izquierda','Guardalodo/lateral trasero izquierdo'])await field(name).check();
 assert.match(await p.locator('.selection-count').innerText(),/5 piezas/);await submit('Guardar piezas');
 const assign=async(process,employee,pieces,rate,total)=>{
  await button('Asignar trabajo').click();await field('Proceso').selectOption(process);await field('Empleado').selectOption({label:employee});
  assert.equal(await field('Tarifa por pieza / monto').inputValue(),String(rate));
  if(pieces==='all')await button('Seleccionar todas').click();else for(const name of pieces)await field(name).check();
  assert.match(await p.locator('.work-total').innerText(),new RegExp(total));
  assert.equal(await field('Cantidad de piezas').count(),0);assert.equal(await field('Responsable de producción').count(),0);
  if(process==='Preparación')await p.screenshot({path:path.join(out,'assignment-modal-mobile.png')});
  await submit('Guardar asignación');
 };
 await assign('Desabolladura','David',['Guardalodo delantero izquierdo'],500,'500.00');
 await assign('Preparación','Francisco','all',300,'1,500.00');
 await assign('Pintura','Carlos','all',400,'2,000.00');
 await p.screenshot({path:path.join(out,'assignment-cards-mobile.png'),fullPage:true});
 assert.equal(await button('Abrir pieza').count(),0);assert.equal(await work('Preparación').getByText('+ 3 más',{exact:true}).count(),1);
 await work('Preparación').getByRole('button',{name:'Opciones de Preparación'}).click();await button('Editar asignación').click();await field('Bumper delantero').uncheck();assert.match(await p.locator('.work-total').innerText(),/1,200.00/);await submit('Guardar asignación');
 await work('Desabolladura').getByRole('button',{name:'Terminar',exact:true}).click();await submit('Terminar trabajo');
 await work('Desabolladura').locator('.badge').filter({hasText:'Terminado'}).waitFor();
 assert.match(await work('Desabolladura').innerText(),/Terminado/);assert.match(await work('Preparación').innerText(),/Pendiente/);assert.match(await work('Pintura').innerText(),/Pendiente/);
 await go('production');assert.match(await p.locator('main').innerText(),/David/);assert.match(await p.locator('main').innerText(),/Francisco/);assert.match(await p.locator('main').innerText(),/Carlos/);await go(orderRoute);
 await work('Desabolladura').getByRole('button',{name:'Opciones de Desabolladura'}).click();await button('Reabrir trabajo').click();await submit('Reabrir');await work('Desabolladura').getByRole('button',{name:'Terminar',exact:true}).click();await submit('Terminar trabajo');
 await work('Preparación').getByRole('button',{name:'Opciones de Preparación'}).click();await button('Retirar asignación').click();await submit('Retirar');
 assert.equal(await p.locator('.list > .work-card').filter({has:p.getByRole('heading',{name:'Preparación',exact:true})}).count(),0);
 await p.getByText('Trabajos retirados (1)',{exact:true}).click();await button('Restaurar trabajo').click();await submit('Restaurar');
 pass('UI Lexus: selección por proceso, cálculo, edición 5→4, terminar independiente, reapertura y retiro/restauración');
 await button('Seleccionar piezas').click();await field('Pieza personalizada').fill('Retrovisor derecho');await button('+ Agregar pieza personalizada').click();await submit('Guardar piezas');
 await button('Seleccionar piezas').click();await field('Retrovisor derecho').uncheck();await submit('Guardar piezas');
 pass('Pieza personalizada y retiro físico sin afectar trabajos');
 await go('settings');await field('Garantía del taller').selectOption('6');await field('Condiciones de garantía').fill('Garantía de pintura');await button('Guardar garantía').click();await p.getByText('Guardado correctamente.',{exact:true}).waitFor();
 await p.waitForFunction(()=>!document.querySelector('[data-form="work-warranty"] button').disabled);
 await p.locator('#logo').setInputFiles(path.join(root,'icon-192.png'));await p.locator('.logo-preview').waitFor();await p.waitForFunction(()=>document.querySelectorAll('.palette-swatches span').length===5);
 await go('home');await p.locator('.home-logo').waitFor();assert.equal(await p.getByRole('heading',{name:'Tu taller, en un solo lugar.'}).count(),1);
 await go(orderRoute);await button('Crear cotización').click();await field('Condiciones para el cliente').fill('Precio acordado en pesos dominicanos.');await button('Generar cotización').click();await p.locator('.receipt').waitFor();
 const quoteText=await p.locator('.receipt').innerText();assert.doesNotMatch(quoteText,/David|Francisco|Carlos|500\.00|1,200|2,000|ganancia/i);assert.match(quoteText,/6 meses/);
 const receiptPath=path.join(out,'quote-mobile.png');await p.screenshot({path:receiptPath,fullPage:true});
 await button('Imprimir / PDF').click();await p.locator('.print-frame').waitFor({state:'attached'});
 const printHtml=await p.locator('.print-frame').last().getAttribute('srcdoc');
 const newPage=await h.context.newPage();await newPage.setContent(printHtml);await newPage.setViewportSize({width:800,height:1100});await newPage.screenshot({path:path.join(out,'quote-print.png'),fullPage:true});await newPage.pdf({path:path.join(out,'cotizacion-prueba.pdf'),format:'A4',printBackground:true});await newPage.close();
 const dl=p.waitForEvent('download');await button('Enviar por WhatsApp').click();assert.match((await dl).suggestedFilename(),/COT.*\.html$/);
 const wa=await p.getByRole('link',{name:'Abrir WhatsApp'}).getAttribute('href');assert.match(wa,/https:\/\/wa.me\/18095550303\?text=/);assert.match(await p.locator('#dialog').innerText(),/no se adjunta automáticamente/);await button('×').click();
 await button('Ver cotización').click();await button('Confirmar precio acordado').click();await submit('Confirmar acuerdo');
 await go('settings');await field('Garantía del taller').selectOption('12');await button('Guardar garantía').click();await p.getByText('Guardado correctamente.',{exact:true}).waitFor();
 await go(orderRoute);await button('Ver confirmada').click();assert.match(await p.locator('.receipt').innerText(),/6 meses/);assert.doesNotMatch(await p.locator('.receipt').innerText(),/12 meses/);await button('×').click();
 pass('Cotización sin importes internos; garantía congelada; descarga y enlace WhatsApp honesto; logo y paleta');
 for(const process of ['Preparación','Pintura']){await work(process).getByRole('button',{name:'Terminar',exact:true}).click();await submit('Terminar trabajo');}
 await button('Cobrar saldo').click();await field('Monto recibido').fill('20000');await submit('Guardar pago');assert.match(await p.locator('.status-panel').innerText(),/30,000/);
 await button('Cobrar saldo').click();await submit('Guardar pago');await button('Finalizar y entregar').click();await field('Vencimiento de garantía').fill('2027-04-10');await button('Finalizar orden').click();await p.locator('.receipt').waitFor();
 const delivery=await p.locator('.receipt').innerText();assert.match(delivery,/Conformidad de entrega/);assert.match(delivery,/Firma:/);assert.match(delivery,/6 meses/);assert.doesNotMatch(delivery,/Francisco|David|Carlos|ganancia/);
 await p.screenshot({path:path.join(out,'delivery-mobile.png'),fullPage:true});await button('×').click();
 await go('home');assert.equal(await p.getByText('Lexus G350',{exact:true}).count(),0);await go('production');assert.equal(await p.getByText('Lexus G350',{exact:true}).count(),0);await go('history');await p.getByRole('link',{name:/Lexus G350/}).click();assert.equal(await button('Asignar trabajo').count(),0);assert.equal(await button('Terminar').count(),0);await button('Rentabilidad').click();assert.match(await p.locator('main').innerText(),/46,300/);
 pass('Cobro parcial/total, entrega con firma física, historial bloqueado y rentabilidad RD$46,300');
 await go('settings');await field('Garantía del taller').selectOption('none');await button('Guardar garantía').click();await p.getByText('Guardado correctamente.',{exact:true}).waitFor();
 const data=await p.evaluate(async()=>{const {TallerService}=await import('./service.mjs');return new TallerService().state();});
 const profile=await mkdtemp(path.join(out,'persistent-work-'));
 let persistent=await h.chromium.launchPersistentContext(profile,{...h.launch,serviceWorkers:'block'}),pp=await persistent.newPage();
 await pp.goto(origin+'/index.html');await pp.locator('.top').waitFor();
 const backup=await p.evaluate(async()=>{const {TallerService}=await import('./service.mjs');return new TallerService().storage.export();});
 await pp.evaluate(async backup=>{const {TallerService}=await import('./service.mjs');await new TallerService().storage.import(backup);},backup);
 const before=await pp.evaluate(async()=>{const {TallerService}=await import('./service.mjs');return new TallerService().state();});await persistent.close();
 persistent=await h.chromium.launchPersistentContext(profile,{...h.launch,serviceWorkers:'block'});pp=await persistent.newPage();await pp.goto(origin+'/index.html');await pp.locator('.top').waitFor();const after=await pp.evaluate(async()=>{const {TallerService}=await import('./service.mjs');return new TallerService().state();});assert.deepEqual(after,before);await persistent.close();pass('Caso 9: proceso de navegador cerrado y reabierto; todas las entidades persisten');
 for(const theme of ['light','dark']){
  await go('settings');await field('Tema').selectOption(theme);await button('Guardar apariencia').click();await p.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  for(const width of [360,390,430,1280]){
   await p.setViewportSize({width,height:844});
   for(const route of ['home','orders','history',orderRoute,'production','settings','employees','inventory','monthly']){
    await go(route);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,theme+' '+width+' '+route);
   }
  }
 }
 await p.setViewportSize({width:390,height:844});await go(orderRoute);await p.screenshot({path:path.join(out,'work-order-mobile.png'),fullPage:true});
 assert.equal(h.errors.length,0,h.errors.join('\n'));pass('Temas y 9 pantallas: 360/390/430/1280 px, sin desbordes ni errores JS');
 await writeFile(path.join(out,'work-ui-results.json'),JSON.stringify({status:'passed',results:logs,errors:h.errors},null,2));
}catch(e){await p.screenshot({path:path.join(out,'work-ui-failure.png'),fullPage:true}).catch(()=>{});console.error(h.errors);throw e;}
finally{await h.stop();}

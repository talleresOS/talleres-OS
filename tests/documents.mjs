import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out,root} from './harness.mjs';
const h=await start(),{page:p,origin}=h,results=[];
const btn=name=>p.getByRole('button',{name,exact:true}),field=name=>p.getByLabel(name,{exact:true});
const go=async r=>{await p.goto(origin+'/index.html#'+r);await p.locator('.top').waitFor();};
const save=async label=>{await btn(label).click();await p.waitForFunction(()=>!document.querySelector('#dialog').open);};
const state=()=>p.evaluate(async()=>new (await import('./service.mjs')).TallerService().state());
const pass=s=>{results.push(s);console.log('PASS '+s);};
async function capture(kind){
 const html=await p.evaluate(async kind=>{const d=await new (await import('./service.mjs')).TallerService().state();return (await import('./documents.mjs')).documentHtml(kind==='reception'?d.orders[0].initialReceipt:d.invoices[0]);},kind);
 await writeFile(path.join(out,kind+'.html'),html);
 const page=await h.context.newPage();await page.setContent(html);await page.setViewportSize({width:816,height:1056});await page.screenshot({path:path.join(out,kind+'-desktop.png'),fullPage:true});
 await page.emulateMedia({media:'print'});await page.pdf({path:path.join(out,kind+'.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true});await page.screenshot({path:path.join(out,kind+'-print.png'),fullPage:true});
 assert.equal(await page.locator('button').count(),0);assert.equal(await page.locator('.empty-watermark').count(),0);
 await page.emulateMedia({media:'screen'});
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,kind+' overflow '+width);}
 await page.screenshot({path:path.join(out,kind+'-mobile.png'),fullPage:true});await page.close();
 return html;
}
try{
 await go('clients');await p.clock.setFixedTime(new Date('2026-10-10T16:00:00-04:00'));await btn('Nuevo cliente').click();await field('Nombre completo').fill('Mario Rodríguez');await field('Teléfono').fill('8095555555');await field('WhatsApp').fill('8295555555');await save('Guardar cliente');
 await p.waitForURL('**#client/*');await btn('Agregar vehículo').click();await field('Marca').fill('Honda');await field('Modelo').fill('Civic');await field('Año').fill('2011');await field('Color').fill('Gris');await field('Placa').fill('A123456');await save('Guardar vehículo');
 const logo='data:image/png;base64,'+(await readFile(path.join(root,'icon-192.png'))).toString('base64');
 await p.evaluate(async logo=>{const s=new (await import('./service.mjs')).TallerService();await s.settings({name:'Taller de prueba',phone:'809-555-5555',whatsapp:'829-555-5555',address:'Santo Domingo Norte',logoData:logo,appearance:{theme:'light',primary:'#12324c',accent:'#dfb861',mode:'manual'}});const {logoKey}=await import('./logo-palette.mjs');await s.settings({palette:['#12324c','#dfb861'],paletteLogo:await logoKey(logo)});await s.saveEmployee({name:'EMPLEADO PRIVADO',role:'Pintor',pieceRate:500});},logo);
 await go('orders');await btn('Nueva orden').click();await field('Vehículo').selectOption({label:'Honda · Civic · A123456'});await field('Precio acordado').fill('60000');await field('Abono inicial').fill('20000');await field('Método del abono').selectOption('Efectivo');await field('Fecha de entrada').fill('2026-10-01');await field('Entrega prevista').fill('2026-10-08');await field('Fecha del abono').fill('2026-10-01');await field('Condiciones del trabajo').fill('Se realizará pintura y reparación de las piezas indicadas. Cualquier trabajo adicional deberá ser autorizado por el cliente.');await field('Observaciones de recepción').fill('Rayón en bumper trasero. Se recibe sin accesorios faltantes.');await field('Notas internas (no salen en factura)').fill('SECRETO COSTOS Y GANANCIA');
 const pieces=[['Bumper delantero',['Pintura']],['Capó',['Pintura']],['Puerta delantera derecha',['Desabolladura','Preparación','Pintura']],['Puerta trasera derecha',['Desabolladura','Pintura']],['Faroles',['Pulido']]];
 for(let i=0;i<pieces.length;i++){if(i)await btn('+ Agregar pieza').click();const row=p.locator('.reception-piece').nth(i);await row.getByLabel('Pieza',{exact:true}).fill(pieces[i][0]);for(const process of pieces[i][1])await row.getByLabel(process,{exact:true}).check();}
 await btn('Guardar orden').click();await p.locator('.customer-document').waitFor();
 let d=await state();const orderId=d.orders[0].id,orderRoute='order/'+orderId;assert.equal(d.payments.length,1);assert.equal(d.payments[0].amount,20000);assert.equal(d.orders[0].initialReceipt.balance,40000);assert.equal(d.workAssignments.length,4);assert.equal(d.vehiclePieces.length,5);
 const reception=await p.locator('.customer-document').innerText();for(const value of ['Mario Rodríguez','Honda','Civic','2011','Gris','01/10/2026','08/10/2026','60,000.00','20,000.00','40,000.00','OBSERVACIONES DE RECEPCIÓN','CONDICIONES DEL TRABAJO'])assert.ok(reception.includes(value),value);assert.doesNotMatch(reception,/SECRETO|EMPLEADO PRIVADO/);
 const first=await capture('reception');assert.ok(first.includes(logo));assert.ok(first.includes('--doc-primary:#12324c'));
 await btn('Cerrar').click();await btn('Ver comprobante').click();await btn('Cerrar').click();assert.equal((await state()).payments.length,1);
 pass('Mario: orden y abono atómicos, procesos múltiples, comprobante automático 60,000 / 20,000 / 40,000 sin duplicación');
 // Assign and complete through existing UI; preserve production and ledger behavior.
 for(const process of ['Desabolladura','Preparación','Pintura','Pulido']){
  const card=p.locator('.work-card').filter({has:p.getByRole('heading',{name:process,exact:true})});await card.getByRole('button',{name:'Asignar empleado',exact:true}).click();await field('Empleado').selectOption({label:'EMPLEADO PRIVADO'});await save('Guardar asignación');await card.getByRole('button',{name:'Terminar',exact:true}).click();await save('Terminar trabajo');
 }
 assert.match(await p.locator('.status-panel').innerText(),/40,000/);await btn('Cobrar saldo').click();await field('Monto recibido').fill('40000');await field('Método de pago').selectOption('Transferencia');await field('Fecha').fill('2026-10-10');await save('Guardar pago');
 await btn('Finalizar y entregar').click();await field('Tiene garantía').selectOption('yes');await field('Duración de garantía').fill('6 meses');await field('Inicio de garantía').fill('2026-10-10');await field('Vencimiento de garantía').fill('2027-04-10');await field('Condiciones de garantía').fill('Garantía de prueba: defectos de pintura y adherencia en uso normal.');await field('Observaciones finales').fill('Cliente recibe el vehículo conforme con los trabajos realizados.');await btn('Finalizar orden').click();await p.locator('.customer-document').waitFor();
 d=await state();assert.equal(d.payments.length,2);assert.equal(d.invoices.length,1);assert.equal(d.invoices[0].paid,60000);assert.equal(d.invoices[0].balance,0);assert.equal(d.orders[0].lifecycle,'closed');assert.equal(d.orders[0].warranty.endDate,'2027-04-10');
 const invoice=await p.locator('.customer-document').innerText();assert.match(invoice,/✓ PAGADO/);assert.match(invoice,/6 meses/);assert.match(invoice,/10\/04\/2027/);assert.doesNotMatch(invoice,/SECRETO|EMPLEADO PRIVADO|ganancia|utilidad|margen|mano de obra/i);assert.equal(await p.locator('.customer-document tbody tr').count(),2);assert.equal(await p.locator('.doc-work h3').filter({hasText:'Pintura'}).count(),1);
 await capture('invoice');pass('Producción, pago final 40,000, garantía, cierre y factura con exactamente dos pagos');
 await p.evaluate(()=>Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true}));
 const dl=p.waitForEvent('download');await btn('Compartir por WhatsApp').click();assert.match((await dl).suggestedFilename(),/Factura-REV/);assert.match(await p.getByRole('link',{name:'Abrir WhatsApp'}).getAttribute('href'),/wa.me\/18295555555/);assert.match(await p.locator('#dialog').innerText(),/no se adjunta automáticamente/);await btn('Volver al documento').click();
 await btn('Imprimir / Guardar PDF').click();await p.locator('.print-frame').waitFor({state:'attached'});assert.doesNotMatch(await p.locator('.print-frame').getAttribute('srcdoc'),/SECRETO|EMPLEADO PRIVADO/);await btn('Cerrar').click();
 await go('history');await p.getByRole('link',{name:/Honda Civic/}).click();await btn('Ver factura').click();assert.match(await p.locator('.customer-document').innerText(),/6 meses/);await btn('Cerrar').click();
 // Model tests: retries, rollback, payment corrections, legacy preservation, backup roundtrip.
 const result=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),s=new TallerService(),{financial,documentPaymentSummary}=await import('./domain.mjs');const d=await s.state(),o=d.orders[0];
  const saved=JSON.stringify(o.initialReceipt),invoice=JSON.stringify(d.invoices[0]);await s.settings({name:'Otro taller',appearance:{theme:'dark',primary:'#ffffff',accent:'#ffffff'}});
  const repeated=await s.saveOrder({creationToken:o.creationToken});const twice=await s.closeOrder(o.id);
  const before=await s.state();let denied=false;try{await s.saveOrder({clientId:o.clientId,vehicleId:o.vehicleId,total:100,entryDate:'2026-10-01',dueDate:'2026-10-08',createReception:true,creationToken:'reject',receptionPieces:[{name:'Capó',processes:['Pintura']}],initialAmount:101,initialMethod:'Efectivo'});}catch{denied=true;}
  const after=await s.state();const unchanged=JSON.stringify(before)===JSON.stringify(after);
  const backup=await s.storage.export();await s.storage.import(backup);await s.init();const final=await s.state();
  return {sameId:repeated.id===o.id,invoiceId:twice.id===d.invoices[0].id,denied,unchanged,preserved:saved===JSON.stringify(final.orders[0].initialReceipt)&&invoice===JSON.stringify(final.invoices[0]),f:financial(final,final.orders[0]),summary:documentPaymentSummary(final.invoices[0]),backupCount:final.snapshots.filter(x=>x.id==='before-customer-documents-v1').length};
 });
 assert.equal(result.sameId,true);assert.equal(result.invoiceId,true);assert.equal(result.denied,true);assert.equal(result.unchanged,true);assert.equal(result.preserved,true);assert.equal(result.backupCount,1);assert.equal(result.f.collected,60000);assert.equal(result.f.balance,0);assert.deepEqual(result.summary,{final:40000,advances:20000});pass('Reintentos idempotentes, reversión atómica, instantáneas y respaldo/importación conservados');
 for(const route of ['home','orders','production','clients']){await go(route);await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await go('production');await p.locator('.empty-watermark').waitFor();assert.equal(await p.locator('.empty-watermark').evaluate(e=>getComputedStyle(e).pointerEvents),'none');await p.screenshot({path:path.join(out,'empty-watermark.png'),fullPage:true});
 pass('Documentos carta/PDF, móvil 360/390/430, WhatsApp y marca de agua sin interacción');
 assert.deepEqual(h.errors,[]);await writeFile(path.join(out,'documents-results.json'),JSON.stringify({status:'passed',results,result},null,2));
}catch(e){await p.screenshot({path:path.join(out,'documents-failure.png'),fullPage:true}).catch(()=>{});console.error(h.errors);throw e;}
finally{await h.stop();}

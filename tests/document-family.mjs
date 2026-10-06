import assert from 'node:assert/strict';
import {writeFile,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
import {calendarExpiry,warrantyLabel} from '../document-policy.mjs';
import {documentHtml,documentMarkup} from '../documents.mjs';
assert.equal(calendarExpiry('2026-08-31',6),'2027-02-28');
assert.equal(calendarExpiry('2023-08-31',6),'2024-02-29');
assert.equal(calendarExpiry('2024-02-29',1,'years'),'2025-02-28');
assert.equal(warrantyLabel({kind:'custom',label:'6',startDate:'2026-10-05',endDate:'2027-04-05'}),'6 meses');
const h=await start(),p=h.page,checks=[];
const go=async r=>{await p.goto(h.origin+'/index.html#'+r);await p.locator('.top').waitFor();};
try{
 await go('home');await p.clock.setFixedTime(new Date('2026-08-31T12:00:00-04:00'));
 const result=await p.evaluate(async()=>{
 const {TallerService}=await import('./service.mjs'),{PIECE_CATALOG}=await import('./work-model.mjs'),s=new TallerService();
 const makeLogo=(width,height,color)=>{const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,width,height);x.fillStyle='white';x.font='24px Arial';x.fillText('TALLER',4,30);return c.toDataURL('image/png');};const logoA=makeLogo(240,70,'#a82020'),logoB=makeLogo(120,120,'#204aa0'),logoC=makeLogo(70,210,'#387c4a');
 await s.settings({logoData:logoA,phone:'8095551111',whatsapp:'8095551111',instagram:'@taller_a',website:'https://taller-a.example',address:'Dirección comercial A',email:'contacto@taller-a.example',name:'Taller Prueba Documentos',appearance:{theme:'dark',primary:'#5000ca',accent:'#d4bd70',mode:'manual'},warranty:{kind:'months',months:6,conditions:'Condiciones originales de seis meses.'},quoteConditions:'Cotización original; cambios requieren aprobación.'});
 const c=await s.saveClient({name:'Mario Rodríguez',phone:'8095550100',email:'mario@example.test'}),v=await s.saveVehicle({clientId:c.id,brand:'Porche',model:'Cayenne',year:2008,color:'Roja',vin:'VIN-ORIGINAL'});
 const base={clientId:c.id,vehicleId:v.id,total:60000,entryDate:'2026-08-01',dueDate:'2026-08-31',createReception:true,initialAmount:20000,initialMethod:'Efectivo',initialDate:'2026-08-01',receptionPieces:PIECE_CATALOG.map((p,i)=>({name:p.name,processes:i===0?['Pintura','Desabolladura']:['Pintura']}))};
 const o=await s.saveOrder(base),q6=await s.createQuote(o.id),before=JSON.stringify([o.initialReceipt,q6]);
 await s.settings({logoData:logoB,name:'Taller B',whatsapp:'8295552222',instagram:'',website:'',address:'Dirección comercial B',warranty:{kind:'months',months:12,conditions:'Condiciones nuevas de doce meses.'},quoteConditions:'Cotización nueva.'});
 const second=await s.saveOrder({...base,total:0,initialAmount:0,receptionPieces:[]}),q12=await s.createQuote(second.id);
 let d=await s.state();const historicalStable=before===JSON.stringify([d.orders.find(x=>x.id===o.id).initialReceipt,d.quotations.find(x=>x.id===q6.id)]);
 Object.assign(q6,await s.confirmQuote(q6.id));const employee=await s.saveEmployee({name:'EMPLEADO-SECRETO',pieceRate:400});d=await s.state();
 for(const w of d.workAssignments.filter(w=>w.orderId===o.id)){await s.saveWork(o.id,{...w,employeeId:employee.id,rate:400},w.id);await s.workState(w.id,'Terminado');}
 await s.cost(o.id,{amount:9999,description:'COSTO-SECRETO',type:'Materiales',date:'2026-08-31'});
 await s.payment(o.id,{amount:10000,method:'Transferencia',date:'2026-08-15'});await s.payment(o.id,{amount:30000,method:'Tarjeta',date:'2026-08-31'});
 const invoice6=await s.closeOrder(o.id);await s.markFinished(second.id);const invoice12=await s.closeOrder(second.id);
 const custom=await s.saveOrder({...base,total:0,initialAmount:0,receptionPieces:[]});await s.markFinished(custom.id);
 const customInvoice=await s.closeOrder(custom.id,{hasWarranty:'yes',warrantyDuration:'2',warrantyUnit:'years',warrantyConditions:'Garantía personalizada solo para esta orden.'});
 const customQuoteOrder=await s.saveOrder({...base,total:0,initialAmount:0,receptionPieces:[]});
 // Simulate a valid persisted per-order custom agreement, through the transaction layer.
 await s.change(d=>{d.orders.find(x=>x.id===customQuoteOrder.id).warranty={kind:'custom',label:'90 días',conditions:'Personalizada previa'};});
 const customQuote=await s.createQuote(customQuoteOrder.id);
 const legacy=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:5000,entryDate:'2026-08-01'});
 await s.savePart({orderId:legacy.id,description:'Restauración farol',price:1500,status:'Pendiente'});
 const detailed=await s.createQuote(legacy.id,undefined,5000,{mode:'detailed'}),noPrices=await s.createQuote(customQuoteOrder.id,undefined,0,{mode:'detailed'});
 const frozen=JSON.stringify([invoice6,invoice12,customInvoice,q6,o.initialReceipt]);
 await s.settings({logoData:logoC,instagram:'https://instagram.com/taller_c',warranty:{kind:'none'},documents:{style:'compact',colorMode:'custom',color:'#aa5500',showLogo:false,showSignature:false,showPieces:false,quoteMode:'detailed'}});
 d=await s.state();const stableFinal=frozen===JSON.stringify([d.invoices.find(x=>x.id===invoice6.id),d.invoices.find(x=>x.id===invoice12.id),d.invoices.find(x=>x.id===customInvoice.id),d.quotations.find(x=>x.id===q6.id),d.orders.find(x=>x.id===o.id).initialReceipt]);
 const fresh=await s.createQuote(legacy.id);
 return {logoA,logoB,logoC,o,q6,q12,invoice6,invoice12,customInvoice,customQuote,detailed,noPrices,fresh,historicalStable,stableFinal};
 });
 assert.ok(result.historicalStable,"Historical receipt/quote changed");assert.ok(result.stableFinal,"Final snapshot changed");
 assert.equal(result.o.initialReceipt.warranty.months,6);assert.equal(result.q6.warranty.months,6);assert.equal(result.q12.warranty.months,12);assert.equal(result.invoice6.warranty.months,6);assert.equal(result.invoice12.warranty.months,12);
 assert.equal(result.invoice6.warranty.startDate,'2026-08-31');assert.equal(result.invoice6.warranty.endDate,'2027-02-28');assert.equal(result.invoice12.warranty.endDate,'2027-08-31');
 assert.equal(result.customInvoice.warranty.unit,'years');assert.equal(result.customInvoice.warranty.endDate,'2028-08-31');assert.equal(result.customQuote.warranty.duration,90);
 assert.equal(result.invoice6.payments.length,3);assert.equal(result.invoice6.paid,60000);assert.equal(result.invoice6.balance,0);assert.equal(result.invoice6.vehicle.brand,'Porche');assert.equal(result.invoice6.vehicle.vin,'VIN-ORIGINAL');
 assert.equal(result.q6.workshop.logoData,result.logoA);assert.equal(result.q12.workshop.logoData,result.logoB);assert.equal(result.invoice6.workshop.logoData,result.logoB);assert.equal(result.fresh.workshop.logoData,result.logoC);assert.equal(result.q6.workshop.whatsapp,'8095551111');assert.equal(result.q12.workshop.whatsapp,'8295552222');assert.match(documentMarkup(result.q6),/@taller_a/);assert.doesNotMatch(documentMarkup(result.q12),/Instagram:|Web:/);
 const final= documentMarkup(result.invoice6);assert.doesNotMatch(final,/No registrado|OBSERVACIONES|EMPLEADO-SECRETO|COSTO-SECRETO|9,999.00|5,200.00/);assert.match(final,/Pintura completa/);assert.match(final,/13 piezas/);assert.match(final,/mario@example.test/);assert.doesNotMatch(documentMarkup(result.q6),/DETALLE DE VENTA|HISTORIAL DE PAGOS/);
 assert.match(documentMarkup(result.detailed),/1,500.00/);assert.match(documentMarkup(result.noPrices),/No hay precios de venta desglosados/);
 assert.equal(result.fresh.presentation.showSignature,false);assert.equal(result.fresh.quoteMode,'detailed');assert.doesNotMatch(documentMarkup(result.fresh),/class="doc-signature-line"/);
 checks.push('6 → 12 meses para nuevos documentos; recepción/cotización/factura históricas estables; acuerdo personalizado prioritario; cierre usa configuración; meses calendario');
 const outputs=[];
 for(const style of ['classic','modern','compact'])for(const [kind,doc]of [['quote',result.q6],['reception',result.o.initialReceipt],['invoice',result.invoice6]]){
 const html=documentHtml({...doc,presentation:{...doc.presentation,style}}),page=await h.context.newPage();await page.setContent(html);await Promise.all(await page.locator('img').evaluateAll(images=>images.map(i=>i.decode())));assert.equal(await page.locator('.doc-header img').count(),1);assert.equal(await page.locator('.doc-footer img').count(),1);assert.ok(await page.locator('img').evaluateAll(images=>images.every(i=>getComputedStyle(i).objectFit==='contain'&&i.naturalWidth>0)));
 for(const width of [320,390,816]){await page.setViewportSize({width,height:1056});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),style+' '+kind+' '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,style+'-'+kind+'-mobile.png'),fullPage:true});await page.emulateMedia({media:'print'});const file=style+'-'+kind+'.pdf';await page.pdf({path:path.join(out,file),preferCSSPageSize:true,printBackground:true});outputs.push(file);await page.close();
 }
 const long={...result.invoice6,notes:'Observaciones registradas: vehículo conforme.',warranty:{...result.invoice6.warranty,conditions:Array.from({length:35},(_,i)=>'Cláusula '+(i+1)+': Condición de prueba para verificar que el texto extenso fluye entre páginas y no se pierde ni se superpone.').join('\n\n')},works:[...result.invoice6.works,{description:'Restauración',pieces:Array.from({length:80},(_,i)=>'Pieza de prueba adicional '+(i+1))}]};
 const page=await h.context.newPage();await page.setContent(documentHtml(long));await page.pdf({path:path.join(out,'multipage.pdf'),preferCSSPageSize:true,printBackground:true});await page.close();outputs.push('multipage.pdf');
 const vertical=await h.context.newPage();await vertical.setContent(documentHtml({...result.fresh,presentation:{...result.fresh.presentation,showLogo:true}}));await vertical.setViewportSize({width:390,height:844});assert.ok(await vertical.locator('.doc-header img').evaluate(i=>i.getBoundingClientRect().height<=68&&getComputedStyle(i).objectFit==='contain'));await vertical.screenshot({path:path.join(out,'vertical-logo-mobile.png'),fullPage:true});await vertical.close();
 await go('settings');await p.getByLabel('Estilo de documentos',{exact:true}).selectOption('classic');await p.getByRole('button',{name:'Guardar documentos',exact:true}).click();await p.getByText('Preferencias de documentos guardadas.',{exact:true}).waitFor();
 await go('order/'+result.o.id);await p.getByRole('button',{name:'Ver factura',exact:true}).click();await p.locator('.customer-document').waitFor();await p.locator('#dialog').evaluate(el=>el.scrollTop=el.scrollHeight);const close=await p.getByRole('button',{name:'×',exact:true}).boundingBox();assert.ok(close.y>=0&&close.y+close.height<=844);await p.getByRole('button',{name:'×',exact:true}).click();
 await p.reload();await p.locator('.top').waitFor();const persisted=await p.evaluate(async id=>{const d=await new (await import('./service.mjs')).TallerService().state();return {w:d.invoices.find(x=>x.orderId===id).warranty,p:d.payments.length,style:d.settings[0].documents.style};},result.o.id);assert.equal(persisted.w.months,6);assert.equal(persisted.p,3);assert.equal(persisted.style,'classic');assert.deepEqual(h.errors,[]);
 const backup=await p.evaluate(async()=>new (await import('./service.mjs')).TallerService().storage.export());
 const profile=await mkdtemp(path.join(out,'family-profile-'));let context=await h.chromium.launchPersistentContext(profile,{...h.launch,serviceWorkers:'block'}),pp=await context.newPage();
 await pp.goto(h.origin+'/index.html#settings');await pp.locator('.top').waitFor();await pp.getByRole('button',{name:'Restaurar respaldo',exact:true}).click();await pp.locator('#backup-file').setInputFiles({name:'synthetic-documents.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await pp.getByRole('button',{name:'Restaurar y reemplazar',exact:true}).click();await pp.waitForFunction(()=>!document.querySelector('#dialog').open);
 const beforeRestart=await pp.evaluate(async()=>new (await import('./service.mjs')).TallerService().state());await context.close();
 context=await h.chromium.launchPersistentContext(profile,{...h.launch,serviceWorkers:'block'});pp=await context.newPage();await pp.goto(h.origin+'/index.html');await pp.locator('.top').waitFor();const afterRestart=await pp.evaluate(async()=>new (await import('./service.mjs')).TallerService().state());assert.deepEqual(afterRestart,beforeRestart);await context.close();
 checks.push('Respaldo/restauración confirmada y cierre/reapertura del navegador conservan branding, garantías, documentos y configuración');
 checks.push('Tres estilos × tres documentos PDF; móvil/escritorio; múltiples páginas; opcionales ocultos; venta real sin costos; cierre accesible y persistencia');
 await writeFile(path.join(out,'family-results.json'),JSON.stringify({status:'passed',checks,outputs},null,2));checks.forEach(c=>console.log('PASS '+c));
}finally{await h.stop();}

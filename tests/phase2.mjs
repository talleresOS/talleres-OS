import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifacts=process.env.TALLEROS_TEST_OUTPUT||path.join(root,'.test-results');
await mkdir(artifacts,{recursive:true});
const playwright=await import((process.env.TALLEROS_PLAYWRIGHT?pathToFileURL(process.env.TALLEROS_PLAYWRIGHT).href:'playwright'));
const server=createServer(async(req,res)=>{
  try{
    if(req.url==='/blank'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Isolated test</title>');return;}
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'')||'index.html';
    const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error('outside root');
    const type={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'text/plain';
    res.setHeader('content-type',type);res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const launch={headless:true,...(process.env.TALLEROS_BROWSER?{executablePath:process.env.TALLEROS_BROWSER}:{})};
const browser=await playwright.chromium.launch(launch);
const results=[],errors=[];
const record=(name,detail)=>{results.push({name,status:'passed',detail});console.log('PASS '+name);};
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const go=async route=>{await page.goto(origin+'/index.html#'+route);await page.locator('.top').waitFor();};
const act=(name)=>page.getByRole('button',{name,exact:true});
const field=name=>page.getByLabel(name,{exact:true});
const submit=async name=>{await act(name).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);};
const evaluate=async fn=>page.evaluate(fn);
try{
  await go('clients');
  await act('Nuevo cliente').click();await field('Nombre completo').fill('Cliente Prueba RevivAuto');await field('Teléfono').fill('809-555-0101');await submit('Guardar cliente');
  await page.waitForURL('**#client/*');
  await act('Agregar vehículo').click();await field('Marca').fill('Mazda');await field('Modelo').fill('CX9');await field('Año').fill('2020');await field('Placa').fill('TEST-091');await submit('Guardar vehículo');
  await go('employees');await act('Agregar empleado').click();await field('Nombre').fill('David Prueba');await field('Puesto').fill('Pintor');await field('Tarifa por pieza').fill('500');await submit('Guardar empleado');
  await go('orders');await act('Nueva orden').click();await field('Vehículo').selectOption({label:'Mazda · CX9 · TEST-091'});await field('Precio acordado').fill('50000');await field('Notas internas (no salen en factura)').fill('PRIVADO: margen y costo interno');await field('Entrega prevista').fill('2026-12-31');await act('Guardar orden').click();await page.locator('.customer-document').waitFor();await act('Cerrar').click();
  await page.waitForURL('**#order/*');await act('Seleccionar piezas').click();await act('Carro completo').click();await submit('Guardar piezas');
  assert.equal(await act('Seleccionar piezas').count(),1);assert.equal(await act('Rentabilidad').count(),1);
  await act('Asignar trabajo').click();await field('Proceso').selectOption('Pintura');await field('Empleado').selectOption({label:'David Prueba'});await act('Seleccionar todas').click();await field('Tarifa por pieza / monto').fill('500');await submit('Guardar asignación');
  await act('Terminar').click();await act('Terminar trabajo').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
  await act('Cobrar saldo').click();await field('Monto recibido').fill('23000');await submit('Guardar pago');
  assert.equal(await act('Finalizar y entregar').count(),0);assert.match(await page.locator('.status-panel').innerText(),/27[,.]000/);
  record('CASO 2 · pago parcial','RD$23,000 cobrados; RD$27,000 pendientes; entrega no habilitada.');
  await act('Rentabilidad').click();await act('Agregar costo').click();await field('Concepto').fill('Material pintura prueba');await field('Monto total').fill('1000');await submit('Guardar costo');
  await act('Trabajo').click();
  await page.screenshot({path:path.join(artifacts,'01-orden-cobrar-390.png'),fullPage:true});
  await act('Cobrar saldo').click();await field('Método de pago').selectOption('Efectivo');await submit('Guardar pago');
  assert.match(await page.locator('.status-panel').innerText(),/Pago completado/);
  await act('Finalizar y entregar').click();assert.match(await page.locator('#dialog').innerText(),/Cliente Prueba RevivAuto/);await act('Finalizar orden').click();await page.locator('.receipt').waitFor();
  const receipt=await page.locator('.receipt').innerText();
  assert.match(receipt,/REV-0001/);assert.doesNotMatch(receipt,/PRIVADO|ganancia|6500|6,500|Material pintura prueba/i);
  await page.screenshot({path:path.join(artifacts,'02-comprobante-390.png'),fullPage:true});
  const invoiceDownload=page.waitForEvent('download');await act('Descargar').click();const file=await invoiceDownload;assert.match(file.suggestedFilename(),/Factura-REV-0001\.html/);
  await act('×').click();
  record('CASO 1 · flujo completo por interfaz','Cliente → vehículo → orden → pieza → empleado → terminar → abonos → entregar → comprobante.');
  const full=await evaluate(async()=>{
    const {TallerService}=await import('./service.mjs'),{employeeSummary,financial}=await import('./domain.mjs');const s=new TallerService();const d=await s.init();return {employee:employeeSummary(d,d.employees[0].id),finance:financial(d,d.orders[0]),order:d.orders[0],invoice:d.invoices[0]};
  });
  assert.equal(full.employee.generated,6500);assert.equal(full.employee.paid,0);assert.equal(full.employee.balance,6500);assert.equal(full.finance.profit,42500);assert.equal(full.finance.margin,85);
  await go('employees');await page.getByRole('link',{name:/David Prueba/}).click();await act('Registrar pago').click();await field('Monto').fill('3000');await submit('Guardar pago');
  const employeeCheck=await evaluate(async()=>{const {TallerService}=await import('./service.mjs');const {employeeSummary,financial}=await import('./domain.mjs');const s=new TallerService(),d=await s.init();return {employee:employeeSummary(d,d.employees[0].id),finance:financial(d,d.orders[0])};});
  assert.equal(employeeCheck.employee.balance,3500);assert.equal(employeeCheck.finance.profit,42500);
  record('CASO 3 · devengo separado de pago','13 piezas; RD$6,500 devengados; RD$3,000 pagados; RD$3,500 pendientes. Ganancia sin doble costo.');
  await go('home');assert.equal(await page.locator('.cards').getByText('REV-0001',{exact:true}).count(),0);
  await go('production');assert.equal(await page.getByText('REV-0001',{exact:true}).count(),0);
  record('CASO 4 · órdenes cerradas fuera de operación','No aparece en tarjetas de Inicio ni Producción.');
  await go('history');assert.equal(await page.getByText('REV-0001',{exact:true}).count(),1);
  await page.getByRole('link',{name:/REV-0001/}).click();await act('Rentabilidad').click();assert.match(await page.locator('main').innerText(),/42[,.]500/);assert.equal(await act('Agregar costo').count(),0);
  const blocked=await evaluate(async()=>{const {TallerService}=await import('./service.mjs');const s=new TallerService(),d=await s.init();try{await s.payment(d.orders[0].id,{amount:1,method:'Efectivo',date:'2026-09-30'});return false;}catch{return true;}});
  assert.equal(blocked,true);record('CASO 5 · historial y bloqueo','Rentabilidad RD$42,500 / 85%; movimientos y edición bloqueados hasta reapertura.');
  await go('inventory');await act('Nuevo producto').click();await field('Producto').fill('Clear prueba');await field('Cantidad inicial').fill('10');await field('Costo unitario').fill('100');await field('Stock mínimo').fill('3');await submit('Guardar producto');
  await page.waitForURL('**#product/*');await act('Entrada').click();await field('Cantidad').fill('5');await field('Costo unitario de compra').fill('120');await submit('Guardar movimiento');
  await act('Salida').click();await field('Cantidad').fill('4');await submit('Guardar movimiento');
  const inv=await evaluate(async()=>{const {TallerService}=await import('./service.mjs');return (await new TallerService().state()).inventory[0];});assert.equal(inv.quantity,11);assert.equal(inv.unitCost,106.67);
  record('CASO 7 · inventario','10 iniciales + 5 entrada − 4 salida = 11. Costo promedio RD$106.67.');
  await page.reload();await page.locator('.top').waitFor();assert.match(await page.locator('main').innerText(),/11 unidad/);
  record('CASO 8 · persistencia tras recarga','La existencia, órdenes y movimientos sobreviven recargar.');
  await go('monthly');await page.screenshot({path:path.join(artifacts,'03-cierre-mensual-390.png'),fullPage:true});
  for(const width of [360,390,430,1280]){
    await page.setViewportSize({width,height:844});
    for(const route of ['home','orders','production','clients','history','employees','inventory','monthly','settings','more']){
      await go(route);
      const sizing=await evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,last:document.querySelector('main').getBoundingClientRect().bottom}));
      assert.ok(sizing.scroll<=width+1,'Overflow '+route+' @'+width+' '+sizing.scroll);
    }
  }
  record('UX móvil y escritorio','Sin desbordamiento horizontal en 10 pantallas a 360, 390, 430 y 1280 px.');
  // Dedicated real IndexedDB v1 migration fixture; never imports user data.
  const legacyContext=await browser.newContext({serviceWorkers:'block'}),legacyPage=await legacyContext.newPage();await legacyPage.goto(origin+'/blank');
  const migration=await legacyPage.evaluate(async()=>{
    const {MAIN,financial,audit}=await import('./domain.mjs'),{TallerService}=await import('./service.mjs');
    const open=(name,stores)=>new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>stores.forEach(s=>r.result.createObjectStore(s,{keyPath:'id',autoIncrement:name==='talleros2'}));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const write=(db,store,rows)=>new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');rows.forEach(r=>t.objectStore(store).put(r));t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
    const db=await open('talleros2',MAIN),ledger=await open('talleros2-ledger',['accounts','accruals','payments','snapshots']);
    const original={
      settings:[{id:1,workshopId:1,name:'RevivAuto existente',prefix:'REV',orderSequence:42,logoData:'data:image/png;base64,TEST'}],
      clients:[{id:11,workshopId:1,name:'Cliente histórico',phone:'8095551111',unknownField:'conservar'}],
      vehicles:[{id:12,workshopId:1,clientId:11,brand:'Toyota',model:'Prado',plate:'REV-HIST'}],
      orders:[{id:21,workshopId:1,number:'REV-0042',clientId:11,vehicleId:12,entryDate:'2026-08-10',status:'En pintura',total:50000,notes:'original',unknownOrder:{keep:true}},{id:22,workshopId:1,number:'REV-0041',clientId:11,vehicleId:12,status:'Entregada',total:1000}],
      parts:[{id:31,workshopId:1,orderId:21,description:'Capó',status:'Pintura',materialCost:900,laborCost:1000,otherCost:50,laborAssignments:[{employeeId:41,quantity:2,rate:500,total:1000,mode:'Por pieza'}],unknownPart:'keep'},{id:32,workshopId:1,orderId:22,description:'Histórica',status:'Terminada',laborCost:500,laborAssignments:[{employeeId:41,quantity:1,total:500}]}],
      employees:[{id:41,workshopId:1,name:'Empleado existente',pieceRate:500}],
      payments:[{id:51,workshopId:1,orderId:21,amount:10000,date:'2026-09-01',method:'Transferencia'},{id:52,workshopId:1,orderId:21,amount:40000,date:'2026-09-02',voided:true}],
      costs:[{id:61,workshopId:1,orderId:21,amount:300,type:'Otros costos',date:'2026-09-05'}]
    };
    for(const [s,rows]of Object.entries(original))await write(db,s,rows);
    await write(ledger,'accounts',[{id:'account-old',workshopId:1,employeeId:41,number:1,status:'ABIERTA',generated:500,paid:200,balance:300}]);
    await write(ledger,'accruals',[{id:'accrual-old',workshopId:1,employeeId:41,accountId:'account-old',orderId:22,partId:32,total:500,quantity:1,sourceAssignmentId:'old-source',generatedAt:'2026-08-20T12:00:00Z'}]);
    await write(ledger,'payments',[{id:'payment-old',workshopId:1,employeeId:41,accountId:'account-old',amount:200,date:'2026-08-21'}]);
    await write(ledger,'snapshots',[{id:'older-history',workshopId:1,collections:{orders:[{number:'REV-0057'}]}}]);
    db.close();ledger.close();
    const service=new TallerService(),first=await service.init();await service.storage.migrate();const second=await service.state();
    const counts=Object.fromEntries(MAIN.map(s=>[s,[original[s].length,second[s].length]]));
    const before=financial(first,first.orders[0]),after=financial(second,second.orders[0]);
    const created=await service.saveOrder({clientId:11,vehicleId:12,entryDate:'2026-09-30',total:100});
    const migratedWork=second.workAssignments.find(w=>w.legacyPartId===31);await Promise.all([service.workState(migratedWork.id,'Terminado'),service.workState(migratedWork.id,'Terminado')]);
    const afterFinish=await service.state();
    const parallelOrders=await Promise.all([service.saveOrder({clientId:11,vehicleId:12,entryDate:'2026-09-30',total:100}),service.saveOrder({clientId:11,vehicleId:12,entryDate:'2026-09-30',total:100})]);
    const payResults=await Promise.allSettled([service.payment(created.id,{amount:60,date:'2026-09-30',method:'Efectivo'}),service.payment(created.id,{amount:60,date:'2026-09-30',method:'Efectivo'})]);
    const exported=await service.storage.export();const countBefore=(await service.state()).orders.length;
    const invalid=structuredClone(exported);invalid.main.orders.push(invalid.main.orders[0]);let rejected=false;try{await service.storage.import(invalid);}catch{rejected=true;}
    await service.storage.import(exported);const restored=await service.state();
    return {counts,unchanged:before.costs===after.costs,unknown:second.clients[0].unknownField,unknownPart:second.parts[0].unknownPart,unknownOrder:second.orders[0].unknownOrder,number:created.number,snapshots:second.snapshots.length,ledgerCopied:second.ledgerPayments.length,accruals:afterFinish.ledgerAccruals.filter(x=>x.partId===31).length,laborCost:afterFinish.parts.find(p=>p.id===31).laborCost,parallelNumbers:parallelOrders.map(o=>o.number),acceptedPayments:payResults.filter(r=>r.status==='fulfilled').length,rejected,countBefore,countAfter:restored.orders.length,legacyStatus:restored.orders.find(o=>o.id===22).status,legacyClosedAt:restored.orders.find(o=>o.id===22).closedAt};
  });
  assert.ok(Object.values(migration.counts).every(([a,b])=>a===b));assert.equal(migration.unchanged,true);assert.equal(migration.unknown,'conservar');assert.equal(migration.unknownPart,'keep');assert.deepEqual(migration.unknownOrder,{keep:true});assert.equal(migration.number,'REV-0058');assert.equal(migration.snapshots,4);assert.equal(migration.ledgerCopied,1);assert.equal(migration.accruals,1);assert.equal(migration.laborCost,1000);assert.equal(new Set(migration.parallelNumbers).size,2);assert.equal(migration.acceptedPayments,1);assert.equal(migration.rejected,true);assert.equal(migration.countBefore,migration.countAfter);assert.equal(migration.legacyStatus,'Entregada');assert.equal(migration.legacyClosedAt,null);
  record('CASO 9 · migración y concurrencia','Esquema v1 real de IndexedDB: mismos registros y campos; REV-0058 respeta snapshots; ejecución repetida idempotente; doble terminación/cobro y altas simultáneas protegidas; importación atómica.');
  const period=await legacyPage.evaluate(async()=>{
    const {TallerService}=await import('./service.mjs'),{monthly}=await import('./domain.mjs');const service=new TallerService();const d=await service.init();
    const september=monthly(d,'2026-09');const snapshot=await service.closeMonth('2026-08');
    const o=d.orders.find(o=>o.id===21);await service.saveOrder({...o,total:60000},o.id);
    const revised=await service.state();return {september,snapshot:structuredClone(snapshot.metrics),saved:revised.monthlyClosures.find(x=>x.month==='2026-08').metrics,live:monthly(revised,'2026-08')};
  });
  assert.notEqual(period.september.sold,period.september.cash);assert.ok(period.september.receivables>0);assert.deepEqual(period.saved,period.snapshot);assert.notEqual(period.saved.sold,period.live.sold);
  record('CASO 6 · cierre mensual','Vendido, caja y saldo por cobrar separados. Cierre guardado inmutable después de cambiar el precio.');
  await legacyContext.close();
  // Full app/browser shutdown, preserving only an isolated generated browser profile.
  const profile=await mkdtemp(path.join(artifacts,'profile-'));let persistent=await playwright.chromium.launchPersistentContext(profile,{...launch,serviceWorkers:'block'});
  let persistentPage=await persistent.newPage();await persistentPage.goto(origin+'/index.html');await persistentPage.locator('.top').waitFor();
  await persistentPage.evaluate(async()=>{const {TallerService}=await import('./service.mjs');const s=new TallerService();await s.init();await s.saveClient({name:'Persistencia navegador',phone:'123'});});await persistent.close();
  persistent=await playwright.chromium.launchPersistentContext(profile,{...launch,serviceWorkers:'block'});persistentPage=await persistent.newPage();await persistentPage.goto(origin+'/index.html#clients');await persistentPage.getByRole('link',{name:/Persistencia navegador/}).waitFor();await persistent.close();
  record('CASO 8 adicional · cierre completo del navegador','Registro conservado después de terminar y volver a iniciar el proceso del navegador.');
  assert.equal(errors.length,0,errors.join('\n'));record('CASO 10 · duplicaciones y ejecución','Una acción Seleccionar piezas y una pestaña Rentabilidad por orden. Cero errores de JavaScript en el flujo probado.');
  await writeFile(path.join(artifacts,'results.json'),JSON.stringify({passed:results.length,results,errors,migration,executedAt:new Date().toISOString()},null,2));
}catch(error){
  await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});
  await writeFile(path.join(artifacts,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2));
  console.error(error);process.exitCode=1;
}finally{await browser.close();server.close();}

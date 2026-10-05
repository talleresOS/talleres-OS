import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.env.TALLEROS_TEST_OUTPUT||path.join(root,'.test-results');
await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.TALLEROS_PLAYWRIGHT?pathToFileURL(process.env.TALLEROS_PLAYWRIGHT).href:'playwright');
const server=createServer(async(req,res)=>{
  try{const name=new URL(req.url,'http://localhost').pathname.replace(/^\/+/,'')||'index.html';const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error('path');
    res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(name)]||'text/plain');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(path.join(out,'ui-profile-'));
const opts={headless:true,...(process.env.TALLEROS_BROWSER?{executablePath:process.env.TALLEROS_BROWSER}:{}),viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'};
let ctx=await chromium.launchPersistentContext(profile,opts),p=ctx.pages()[0],errors=[];
const results=[],pass=(name,detail)=>{results.push({name,detail,status:'passed'});console.log('PASS '+name);};
const watch=()=>{p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));};watch();
const go=async route=>{await p.goto(origin+'/index.html#'+route);await p.locator('.top').waitFor();};
const button=name=>p.getByRole('button',{name,exact:true});
const field=name=>p.getByLabel(name,{exact:true});
const closed=()=>p.waitForFunction(()=>!document.querySelector('#dialog').open);
const submit=async name=>{await button(name).click();await closed();};
const state=()=>p.evaluate(async()=>{const {TallerService}=await import('./service.mjs');const {financial,employeeSummary,audit}=await import('./domain.mjs');const d=await new TallerService().state();return {d,f:financial(d,d.orders[0]),e:employeeSummary(d,d.employees[0].id),issues:audit(d)};});
const card=name=>p.locator('.piece-card').filter({has:p.getByRole('heading',{name,exact:true})});
const menu=async name=>card(name).getByRole('button',{name:'Opciones de '+name,exact:true}).click();
try{
  await go('settings');
  const seeded=await p.evaluate(async()=>{
    const {TallerService}=await import('./service.mjs'),s=new TallerService();await s.init();
    const c=await s.saveClient({name:'Cliente UI',phone:'809-555-0202'});
    const v=await s.saveVehicle({clientId:c.id,brand:'Lexus',model:'RX',plate:'UI-TEST'});
    const e=await s.saveEmployee({name:'David',role:'Pintor',pieceRate:500,active:true});
    const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:20000,entryDate:'2026-09-30'});
    await s.settings({painterRate:777,name:'RevivAuto'});
    return {order:o.id,employee:e.id};
  });
  await go('order/'+seeded.order);
  for(let i=1;i<=5;i++){
    await button('Agregar pieza').click();await field('Descripción').fill('Pieza '+i);await submit('Guardar pieza');
    await card('Pieza '+i).getByRole('button',{name:'Asignar empleado',exact:true}).click();
    assert.equal(await field('Tarifa por pieza / monto').inputValue(),'500');
    await field('Cantidad de piezas').fill('1');await submit('Guardar asignación');
  }
  let s=await state();assert.equal(s.d.parts.length,5);assert.equal(s.f.labor+s.f.pendingLabor,2500);assert.equal(s.e.pending,5);
  assert.equal(await button('Abrir pieza').count(),0);assert.equal(await button('Terminar').count(),5);assert.equal(await button('Asignar empleado').count(),5);assert.equal(await button('Agregar pieza').count(),1);
  pass('Cinco piezas y asignaciones','David: cinco asignaciones de una pieza × RD$500 = RD$2,500. Acciones directas conservadas.');
  const initialFinance=s.f;
  await menu('Pieza 1');await button('Editar pieza/trabajo').click();
  await field('Descripción').fill('Guardalodo delantero');await field('Proceso').selectOption('Pintura');await field('Responsable de producción').selectOption(String(seeded.employee));await submit('Guardar pieza');
  s=await state();assert.deepEqual(s.f,initialFinance);assert.equal(s.d.parts[0].employeeId,seeded.employee);assert.equal(s.d.parts[0].status,'Pintura');
  await go('production');assert.match(await p.locator('main').innerText(),/Guardalodo delantero[\s\S]*Pintura/);
  await go('order/'+seeded.order);
  await card('Guardalodo delantero').getByRole('button',{name:'Terminar',exact:true}).click();await submit('Terminar trabajo');
  s=await state();assert.equal(s.e.generated,500);assert.equal(s.e.paid,0);assert.equal(s.e.balance,500);assert.equal(s.f.labor+s.f.pendingLabor,2500);
  await menu('Guardalodo delantero');await button('Reabrir pieza').click();await submit('Reabrir');
  assert.match(await card('Guardalodo delantero').innerText(),/Preparación/);
  await card('Guardalodo delantero').getByRole('button',{name:'Terminar',exact:true}).click();await submit('Terminar trabajo');
  s=await state();assert.equal(s.d.ledgerAccruals.length,1);assert.equal(s.e.generated,500);assert.equal(s.f.labor+s.f.pendingLabor,2500);
  pass('Editar, producir, terminar y reabrir','Descripción, proceso y responsable guardados. Reabrir y terminar no duplica devengos ni costos.');
  await button('Agregar pieza').click();await field('Descripción').fill('Agregada por error');await submit('Guardar pieza');
  await menu('Agregada por error');await button('Eliminar pieza/trabajo').click();
  assert.equal(await p.getByRole('heading',{name:'¿Eliminar esta pieza/trabajo de la orden?',exact:true}).count(),1);
  await button('Cancelar').click();await closed();assert.equal(await card('Agregada por error').count(),1);
  await menu('Agregada por error');await button('Eliminar pieza/trabajo').click();await submit('Eliminar');
  assert.equal(await card('Agregada por error').count(),0);assert.equal(await p.locator('.piece-card').count(),5);
  s=await state();assert.equal(s.f.labor+s.f.pendingLabor,2500);assert.equal(s.issues.length,0);assert.equal(s.d.parts.find(x=>x.description==='Agregada por error').archived,true);
  await go('production');assert.doesNotMatch(await p.locator('main').innerText(),/Agregada por error/);
  await go('order/'+seeded.order);await p.getByText('Piezas retiradas (1)',{exact:true}).click();await button('Restaurar').click();await card('Agregada por error').waitFor();
  await menu('Agregada por error');await button('Eliminar pieza/trabajo').click();await submit('Eliminar');
  pass('Eliminación reversible y sin huérfanos','La pieza accidental sale de la orden activa y de producción; restauración probada; importes RD$2,500 intactos.');
  await p.evaluate(async()=>{const {TallerService}=await import('./service.mjs'),s=new TallerService(),d=await s.state();await s.employeePayment(d.ledgerAccounts[0].id,{amount:200,method:'Efectivo',date:'2026-09-30'});});
  await go('order/'+seeded.order);const beforeRemove=await state();
  await menu('Guardalodo delantero');await button('Eliminar pieza/trabajo').click();
  assert.match(await p.locator('#dialog').innerText(),/asignaciones o costos relacionados/);await submit('Eliminar');
  s=await state();assert.deepEqual(s.f,beforeRemove.f);assert.deepEqual(s.d.ledgerAccruals,beforeRemove.d.ledgerAccruals);assert.deepEqual(s.d.ledgerPayments,beforeRemove.d.ledgerPayments);assert.equal(s.e.balance,300);assert.equal(s.issues.length,0);
  await p.getByText('Piezas retiradas (2)',{exact:true}).click();await p.locator('.removed-parts .row').filter({hasText:'Guardalodo delantero'}).getByRole('button',{name:'Restaurar'}).click();
  await card('Guardalodo delantero').waitFor();
  pass('Pieza con pagos relacionados','Advertencia visible; RD$500 devengados, RD$200 pagados y RD$300 pendientes conservados al retirar/restaurar.');
  const grouped=await p.evaluate(async()=>{
    const {TallerService}=await import('./service.mjs'),s=new TallerService(),d=await s.state(),first=d.orders[0];
    const o=await s.saveOrder({clientId:first.clientId,vehicleId:first.vehicleId,total:10000,entryDate:'2026-09-30'});
    const part=await s.savePart({orderId:o.id,description:'Lexus · cinco piezas',status:'Preparación',price:875});
    return {order:o.id,part:part.id};
  });
  await go('order/'+grouped.order);await button('Asignar empleado').click();await field('Cantidad de piezas').fill('5');assert.equal(await field('Tarifa por pieza / monto').inputValue(),'500');await submit('Guardar asignación');
  assert.match(await card('Lexus · cinco piezas').innerText(),/David · RD\$2,500\.00 · asignado/);
  await menu('Lexus · cinco piezas');await button('Editar pieza/trabajo').click();await field('Descripción').fill('Lexus · 5 piezas');await submit('Guardar pieza');
  s=await state();const groupedPart=s.d.parts.find(x=>x.id===grouped.part);assert.equal(groupedPart.price,875);assert.equal(groupedPart.laborAssignments[0].quantity,5);assert.equal(groupedPart.laborAssignments[0].rate,500);assert.equal(groupedPart.laborAssignments[0].total,2500);
  pass('Asignación agrupada original','Una asignación de David: cantidad 5 × tarifa RD$500 = RD$2,500; precio de referencia RD$875 conservado al editar.');
  await go('settings');assert.equal(await field('Tarifa de referencia del pintor').count(),0);
  await p.locator('#logo').setInputFiles(path.join(root,'icon-192.png'));await p.locator('.logo-preview').waitFor();
  const logo=(await state()).d.settings[0].logoData;
  await field('Tema').selectOption('light');await field('Color principal').fill('#2563eb');await field('Color secundario / acento').fill('#087f72');await button('Guardar apariencia').click();await p.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await field('Nombre del taller').fill('RevivAuto UI');await button('Guardar datos').click();await p.waitForFunction(()=>document.querySelector('.eyebrow')?.textContent==='RevivAuto UI');
  s=await state();assert.equal(s.d.settings[0].painterRate,777);assert.equal(s.d.settings[0].logoData,logo);assert.deepEqual(s.d.settings[0].appearance,{theme:'light',primary:'#2563eb',accent:'#087f72'});
  const savedState=JSON.stringify(s.d);
  const rejected=await p.evaluate(async()=>{const {TallerService}=await import('./service.mjs');try{await new TallerService().settings({name:'Invalid',appearance:{theme:'wrong',primary:'red',accent:'#123456'}});return false;}catch{return true;}});
  assert.equal(rejected,true);assert.equal(JSON.stringify((await state()).d),savedState);
  pass('Configuración y logo','Campo general de tarifa retirado; tarifa histórica, logo y asignaciones conservados. Apariencia validada y persistente.');
  for(const theme of ['light','dark']){
    await go('settings');await field('Tema').selectOption(theme);await button('Guardar apariencia').click();await p.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
    for(const width of [360,390,430,1280]){
      await p.setViewportSize({width,height:844});
      for(const route of ['home','orders','order/'+grouped.order,'production','settings']){
        await go(route);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,theme+' '+width+' '+route);
      }
    }
    await p.setViewportSize({width:390,height:844});await go('order/'+grouped.order);await p.screenshot({path:path.join(out,'ui-order-'+theme+'.png'),fullPage:true});
    await button('Asignar empleado').click();assert.equal(await p.evaluate(()=>{const e=document.querySelector('#dialog');return e.scrollWidth<=e.clientWidth+1;}),true);await p.screenshot({path:path.join(out,'ui-modal-'+theme+'.png')});await button('×').click();
    await go('settings');await p.screenshot({path:path.join(out,'ui-settings-'+theme+'.png'),fullPage:true});
  }
  pass('Móvil y temas','Sin desbordes en 360, 390, 430 y 1280 px, cinco pantallas y ambos temas; modales revisados a 390 px.');
  const beforeRestart=await state();await ctx.close();ctx=await chromium.launchPersistentContext(profile,opts);p=ctx.pages()[0];watch();await go('settings');
  const afterRestart=await state();assert.deepEqual(afterRestart,beforeRestart);assert.equal(await field('Tema').inputValue(),'dark');assert.equal(await field('Color principal').inputValue(),'#2563eb');
  const exported=await p.evaluate(async()=>{const {TallerService}=await import('./service.mjs');return new TallerService().storage.export();});
  assert.match(JSON.stringify(exported),/"appearance"/);
  assert.equal(errors.length,0,errors.join('\n'));
  pass('Cierre y reapertura real','Nuevo proceso de navegador conserva datos, colores, tema, logo, asignaciones, devengos y pagos. Exportación incluye apariencia.');
  await writeFile(path.join(out,'ui-results.json'),JSON.stringify({version:'2.2.0',results,errors},null,2));
  console.log('ALL UI CHECKS PASSED');
}catch(error){await p.screenshot({path:path.join(out,'ui-failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await ctx.close();await new Promise(r=>server.close(r));}

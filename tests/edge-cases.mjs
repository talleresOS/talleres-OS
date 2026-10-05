import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.env.TALLEROS_TEST_OUTPUT||path.join(root,'.test-results');await mkdir(out,{recursive:true});
const {chromium}=await import((process.env.TALLEROS_PLAYWRIGHT?pathToFileURL(process.env.TALLEROS_PLAYWRIGHT).href:'playwright'));
let legacy=false;
const server=createServer(async(req,res)=>{
  try{
    if(req.url==='/blank'){res.setHeader('content-type','text/html');res.end('<title>Test</title>');return;}
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'')||'index.html';
    let source=root;if(legacy&&['index.html','app.js','pwa.js','employee-ledger.js','sw.js','styles.css'].includes(name))source=process.env.TALLEROS_LEGACY_SOURCE;
    const file=path.resolve(source,name);if(!file.startsWith(source+path.sep))throw Error('path');
    res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(name)]||'text/plain');
    res.setHeader('cache-control','no-cache');res.end(await readFile(file));
  }catch(e){res.writeHead(404);res.end(e.message);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://localhost:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.TALLEROS_BROWSER?{executablePath:process.env.TALLEROS_BROWSER}:{})});
const results=[];function pass(name,detail){results.push({name,status:'passed',detail});console.log('PASS '+name);}
try{
  const ctx=await browser.newContext({serviceWorkers:'block'}),p=await ctx.newPage();await p.goto(origin+'/blank');
  const result=await p.evaluate(async()=>{
    const {TallerService}=await import('./service.mjs'),{monthly}=await import('./domain.mjs');
    const s=new TallerService();await s.init();
    const c=await s.saveClient({name:'Límite',phone:'123'}),v=await s.saveVehicle({clientId:c.id,brand:'Test',model:'A'});
    const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,entryDate:'2026-08-01',total:150,notes:'SECRETO_INTERNO',customerNotes:'Garantía acordada'});
    await s.cost(o.id,{type:'Materiales',description:'SECRETO_COSTO',amount:20,quantity:1,date:'2026-09-01'});
    await s.payment(o.id,{amount:100,date:'2026-09-02',method:'Efectivo'});
    let d=await s.state();const beforeCancel=monthly(d,'2026-09');await s.cancel(o.id);d=await s.state();const cancelled=monthly(d,'2026-09');
    await s.reopen(o.id);await s.payment(o.id,{amount:50,date:'2026-09-03',method:'Transferencia'});await s.markFinished(o.id);
    const first=await s.closeOrder(o.id),frozen=JSON.stringify(first);
    const backup=await s.storage.export();await s.reopen(o.id);
    await s.saveOrder({...o,total:200,customerNotes:'Nueva nota'},o.id);await s.payment(o.id,{amount:50,date:'2026-09-04',method:'Tarjeta'});await s.markFinished(o.id);
    const second=await s.closeOrder(o.id);d=await s.state();const frozenAfter=JSON.stringify(d.invoices.find(x=>x.id===first.id));
    await s.storage.import(backup);await s.reopen(o.id);await s.markFinished(o.id);const third=await s.closeOrder(o.id);
    const product=await s.saveProduct({name:'Pintura',unit:'litro',quantity:2,unitCost:25,minimum:1,date:'2026-09-01'});
    let overdraw=false;try{await s.inventoryMove(product.id,{kind:'exit',quantity:3,date:'2026-09-30'});}catch{overdraw=true;}
    const concurrent=await Promise.allSettled([s.inventoryMove(product.id,{kind:'exit',quantity:2,date:'2026-09-30'}),s.inventoryMove(product.id,{kind:'exit',quantity:2,date:'2026-09-30'})]);
    await s.closeMonth('2026-08');const exported=await s.storage.export();await s.storage.import(exported);d=await s.state();
    let oldRejected=false;try{const old={...exported,version:1};delete old.phase2;await s.storage.import(old);}catch{oldRejected=true;}
    const nameBefore=d.clients[0].name;try{await s.change(d=>{d.clients[0].name='UNCOMMITTED';throw Error('simulated failure');});}catch{}
    const last=await s.state();
    return {beforeCancel,cancelled,first,second,third,frozen,frozenAfter,overdraw,accepted:concurrent.filter(x=>x.status==='fulfilled').length,stock:last.inventory[0].quantity,oldRejected,snapshots:d.monthlyClosures.length,invoices:d.invoices.length,nameBefore,nameAfter:last.clients[0].name,invoiceCounter:last.settings[0].invoiceSequence};
  });
  assert.equal(result.cancelled.cash,result.beforeCancel.cash);assert.equal(result.cancelled.materials,result.beforeCancel.materials);
  pass('Cancelación conserva caja y costos','Los cobros y costos del mes no desaparecen al cancelar.');
  assert.doesNotMatch(JSON.stringify(result.first),/SECRETO_INTERNO|SECRETO_COSTO|laborCost|profit/);
  const old=JSON.parse(result.frozenAfter);delete old.supersededAt;assert.equal(JSON.stringify(old),result.frozen);
  assert.notEqual(result.first.number,result.second.number);assert.notEqual(result.third.number,result.second.number);assert.equal(result.invoiceCounter,3);
  pass('Comprobantes y numeración tras recuperación','Documentos anteriores conservados, sin información interna; importar una copia antigua no reutiliza números.');
  assert.equal(result.overdraw,true);assert.equal(result.accepted,1);assert.equal(result.stock,0);
  pass('Inventario concurrente','Dos salidas simultáneas no permiten stock negativo.');
  assert.equal(result.oldRejected,true);assert.equal(result.snapshots,1);assert.ok(result.invoices>0);assert.equal(result.nameBefore,result.nameAfter);
  pass('Copias y atomicidad','Backup v2 conserva inventario, comprobantes y cierre. Copia v1 incompleta se rechaza. Fallo intermedio no escribe cambios.');
  await ctx.close();
  if(process.env.TALLEROS_LEGACY_SOURCE){
    legacy=true;
    const c=await browser.newContext({viewport:{width:390,height:844}});let page=await c.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>console.log('PWA error: '+e.message));await page.goto(origin+'/index.html');await page.waitForFunction(()=>window.__pwaRecoveryReady===true);console.log('PWA: original ready');
    await page.evaluate(async()=>{await api.create('clients',{workshopId:1,name:'Dato conservado PWA',phone:'987'});await navigator.serviceWorker.ready;await caches.open('unrelated-cache');});
    await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller!==null&&window.__pwaRecoveryReady===true);
    console.log('PWA: original cached');legacy=false;await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
    await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
    console.log('PWA: update waiting');assert.equal(await page.evaluate(()=>typeof window.__pwaRecoveryReady==='boolean'),true);
    await page.close();await new Promise(r=>setTimeout(r,1200));page=await c.newPage();page.setDefaultTimeout(20000);await page.goto(origin+'/index.html#clients');await page.getByRole('link',{name:/Dato conservado PWA/}).waitFor();
    const updated=await page.evaluate(async()=>{const {TallerService}=await import('./service.mjs');const d=await new TallerService().state();return {migrated:d.meta.some(x=>x.id==='phase2'),old:await caches.has('talleros-shell-v3'),unrelated:await caches.has('unrelated-cache')};});
    assert.equal(updated.migrated,true);assert.equal(updated.old,false);assert.equal(updated.unrelated,true);
    await c.setOffline(true);await page.reload();await page.getByRole('link',{name:/Dato conservado PWA/}).waitFor();
    await page.getByRole('button',{name:'Nuevo cliente',exact:true}).click();await page.getByLabel('Nombre completo',{exact:true}).fill('Guardado sin internet');await page.getByLabel('Teléfono',{exact:true}).fill('555');await page.getByRole('button',{name:'Guardar cliente',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    await page.reload();await page.getByRole('heading',{name:'Guardado sin internet',exact:true}).waitFor();
    pass('Actualización PWA v1 → v2 y offline','SW antiguo real conserva la sesión; la actualización espera el cierre, migra datos y permite leer/escribir/reabrir sin conexión. Respeta otras cachés.');
    await c.close();
  }
  await writeFile(path.join(out,'edge-results.json'),JSON.stringify({results,executedAt:new Date().toISOString()},null,2));
}catch(e){console.error(e);await writeFile(path.join(out,'edge-failure.json'),JSON.stringify({message:e.message,stack:e.stack,results},null,2));process.exitCode=1;}
finally{await browser.close();server.close();}

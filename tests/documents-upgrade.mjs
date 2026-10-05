import assert from 'node:assert/strict';
import {legacySource} from './legacy-source.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,out} from './harness.mjs';
await mkdir(out,{recursive:true});
const names=['index.html','app.js','styles.css','domain.mjs','storage.mjs','service.mjs','work-model.mjs','work-service.mjs','work-ui.mjs','logo-palette.mjs','pwa.js','sw.js','version.json','manifest.json','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
const files=await legacySource('2.3.0',names);
const allowed=[...names,'documents.mjs','documents-style.mjs','document-ui.mjs',"dashboard-ui.mjs","workshop-background.webp","backup.mjs","interface.css","assistant-contract.mjs","assistant-core.mjs","assistant-service.mjs","assistant-provider.mjs","assistant-voice.mjs","assistant-ui.mjs"];let old=true;
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!allowed.includes(name))throw Error('path');res.setHeader('cache-control','no-store');res.setHeader('content-type',({'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'})[path.extname(name)]);res.end(old?files[name]:await readFile(path.join(root,name)));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://localhost:'+server.address().port;
const {chromium}=await import(process.env.TALLEROS_PLAYWRIGHT?pathToFileURL(process.env.TALLEROS_PLAYWRIGHT).href:'playwright'),browser=await chromium.launch({headless:true,...(process.env.TALLEROS_BROWSER?{executablePath:process.env.TALLEROS_BROWSER}:{})}),ctx=await browser.newContext();let p=await ctx.newPage();p.setDefaultTimeout(20000);
try{
 await p.goto(origin);await p.locator('.top').waitFor();await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await p.reload();await p.locator('.top').waitFor();
 const before=await p.evaluate(async()=>{
  const s=new (await import('./service.mjs')).TallerService();await s.init();const c=await s.saveClient({name:'Cliente conservado',phone:'8095554444'}),v=await s.saveVehicle({clientId:c.id,brand:'Honda',model:'Fit'}),e=await s.saveEmployee({name:'Empleado conservado',pieceRate:500});
  const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:12000,entryDate:'2026-09-01',dueDate:'2026-09-10',notes:'PRIVADO'});const pieces=await s.saveOrderPieces(o.id,['hood','bumper-front']);const w=await s.saveWork(o.id,{process:'Pintura',selectedPieceIds:pieces.map(p=>p.id),employeeId:e.id,rate:500});await s.workState(w.id,'Terminado');await s.payment(o.id,{amount:4000,date:'2026-09-01',method:'Efectivo'});await s.payment(o.id,{amount:8000,date:'2026-09-10',method:'Transferencia'});await s.closeOrder(o.id);await s.saveProduct({name:'Material conservado',unit:'Litro',quantity:4,unitCost:500});await s.storage.transact(d=>{d.orders[0].unknown={keep:1};});return s.state();
 });
 old=false;await p.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});await p.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting);await p.close();await new Promise(r=>setTimeout(r,1200));p=await ctx.newPage();await p.goto(origin);await p.locator('.top').waitFor();await p.waitForFunction(async()=> (await caches.keys()).includes('talleros-phase2-3.0.0-visual-20261005b')&&!(await caches.keys()).includes('talleros-phase2-2.3.0'));
 const after=await p.evaluate(async()=>{const s=new (await import('./service.mjs')).TallerService();await s.init();await s.init();return s.state();});
 for(const key of Object.keys(before).filter(k=>!['meta','snapshots'].includes(k)))assert.deepEqual(after[key],before[key],key);
 for(const snap of before.snapshots)assert.deepEqual(after.snapshots.find(x=>x.id===snap.id),snap);
 assert.equal(after.snapshots.filter(x=>x.id==='before-customer-documents-v1').length,1);assert.deepEqual(after.snapshots.find(x=>x.id==='before-customer-documents-v1').payload.orders,before.orders);
 await ctx.setOffline(true);await p.goto(origin+'/index.html#history');await p.getByRole('link',{name:/Honda Fit/}).click();await p.getByRole('button',{name:'Ver factura',exact:true}).click();await p.locator('.customer-document').waitFor();assert.doesNotMatch(await p.locator('.customer-document').innerText(),/PRIVADO|Empleado conservado/);
 await writeFile(path.join(out,'documents-upgrade-results.json'),JSON.stringify({status:'passed',from:'2.3.0',to:'3.0.0',storesUnchanged:true,backupIdempotent:true,oldInvoiceOffline:true},null,2));console.log('PASS Actualización real 2.3.0 → 3.0.0: todos los registros conservados, respaldo único y factura histórica offline.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

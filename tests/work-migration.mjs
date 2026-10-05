import assert from 'node:assert/strict';
import {legacySource} from './legacy-source.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,out} from './harness.mjs';
await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.TALLEROS_PLAYWRIGHT?pathToFileURL(process.env.TALLEROS_PLAYWRIGHT).href:'playwright');
const oldNames=['index.html','app.js','styles.css','domain.mjs','storage.mjs','service.mjs','pwa.js','sw.js','version.json','manifest.json','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
const names=[...oldNames,'work-model.mjs','work-service.mjs','work-ui.mjs','logo-palette.mjs','documents.mjs','documents-style.mjs','document-ui.mjs',"dashboard-ui.mjs","workshop-background.webp","backup.mjs","interface.css","assistant-contract.mjs","assistant-core.mjs","assistant-service.mjs","assistant-provider.mjs","assistant-voice.mjs","assistant-ui.mjs"];
const oldSource=await legacySource('2.2.0',oldNames);
let old=true;
const server=createServer(async(req,res)=>{try{
 const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!names.includes(name))throw Error('path');
 res.setHeader('cache-control','no-cache');res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(name)]);
 res.end(old?oldSource[name]:await readFile(path.join(root,name)));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://localhost:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.TALLEROS_BROWSER?{executablePath:process.env.TALLEROS_BROWSER}:{})}),ctx=await browser.newContext();
let p=await ctx.newPage();p.setDefaultTimeout(20000);
try{
 await p.goto(origin+'/index.html');await p.locator('.top').waitFor();await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await p.reload();await p.locator('.top').waitFor();
 const original=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{financial}=await import('./domain.mjs');const s=new TallerService();await s.init();
  const c=await s.saveClient({name:'Histórico',phone:'8095550123'}),v=await s.saveVehicle({clientId:c.id,brand:'Lexus',model:'G350'}),e=await s.saveEmployee({name:'David',pieceRate:500});
  const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:50000,entryDate:'2026-09-30'});
  const p=await s.savePart({orderId:o.id,description:'Lexus',status:'Preparación',price:345});
  await s.assign(p.id,{employeeId:e.id,quantity:5,rate:500,mode:'Por pieza'});await s.finishPart(p.id);
  let d=await s.state();await s.employeePayment(d.ledgerAccounts[0].id,{amount:1000,method:'Efectivo',date:'2026-09-30'});
  await s.payment(o.id,{amount:25000,method:'Transferencia',date:'2026-09-30'});await s.cost(o.id,{type:'Materiales',description:'Material antiguo',amount:850,quantity:1,date:'2026-09-30'});
  const second=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:12000,entryDate:'2026-09-30'});
  const p2=await s.savePart({orderId:second.id,description:'Trabajo agrupado anterior',status:'Preparación'});
  await s.assign(p2.id,{employeeId:e.id,quantity:5,rate:400,mode:'Por pieza'});
  await s.storage.transact(data=>{data.orders[0].unknownPrivateField={keep:'exact'};data.settings[0].painterRate=777;});
  d=await s.state();return {d,finance:d.orders.map(o=>financial(d,o)),backup:await s.storage.export()};
 });
 old=false;
 await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
 await p.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting);
 await p.close();await new Promise(r=>setTimeout(r,1200));p=await ctx.newPage();p.setDefaultTimeout(20000);await p.goto(origin+'/index.html');await p.locator('.top').waitFor();
 await p.waitForFunction(async()=>{const c=await caches.keys();return c.includes('talleros-phase2-3.0.0-visual-20261005b')&&!c.includes('talleros-phase2-2.2.0');});
 const migrated=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{financial,employeeSummary}=await import('./domain.mjs'),s=new TallerService(),d=await s.init();return {d,finance:d.orders.map(o=>financial(d,o)),employee:employeeSummary(d,d.employees[0].id),recovery:await s.storage.previousModelBackup()};
 });
 for(const store of ['clients','vehicles','parts','employees','payments','costs','ledgerAccounts','ledgerAccruals','ledgerPayments','invoices','monthlyClosures'])assert.deepEqual(migrated.d[store],original.d[store],store+' changed');
 assert.deepEqual(migrated.finance,original.finance);assert.equal(migrated.employee.generated,2500);assert.equal(migrated.employee.paid,1000);assert.equal(migrated.employee.balance,1500);
 assert.equal(migrated.d.vehiclePieces.length,0);assert.equal(migrated.d.workAssignments.length,2);assert.equal(migrated.d.workAssignments[0].unspecifiedQuantity,5);assert.equal(migrated.d.settings[0].painterRate,777);assert.equal(migrated.d.orders[0].unknownPrivateField.keep,'exact');
 assert.equal(migrated.d.snapshots.filter(x=>x.id==='before-work-model-v3').length,1);
 assert.deepEqual(migrated.recovery.main.parts,original.d.parts);assert.deepEqual(migrated.recovery.ledger.payments,original.d.ledgerPayments);assert.equal(migrated.recovery.version,2);
 await p.goto(origin+'/index.html#order/'+original.d.orders[0].id);await p.getByText('5 piezas sin especificar',{exact:true}).waitFor();
 const identification=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{PIECE_CATALOG}=await import('./work-model.mjs'),s=new TallerService(),before=await s.state(),w=before.workAssignments[0];
  const pieces=await s.saveOrderPieces(w.orderId,PIECE_CATALOG.slice(0,5).map(x=>x.id));
  await s.saveWork(w.orderId,{...w,process:'Pintura',selectedPieceIds:pieces.map(p=>p.id)},w.id);
  await s.workState(w.id,'En proceso');await s.workState(w.id,'Terminado');
  const after=await s.state();await s.init();const again=await s.state();
  return {w:after.workAssignments[0],ledgerSame:JSON.stringify(before.ledgerAccruals)===JSON.stringify(after.ledgerAccruals),paymentsSame:JSON.stringify(before.ledgerPayments)===JSON.stringify(after.ledgerPayments),snapshotCount:again.snapshots.length,afterSnapshotCount:after.snapshots.length};
 });
 assert.equal(identification.w.quantity,5);assert.equal(identification.w.total,2500);assert.equal(identification.w.unspecifiedQuantity,0);assert.equal(identification.ledgerSame,true);assert.equal(identification.paymentsSame,true);assert.equal(identification.snapshotCount,identification.afterSnapshotCount);
 const restored=await p.evaluate(async backup=>{
  const {TallerService}=await import('./service.mjs'),s=new TallerService();const before=await s.state(),snapshot=before.snapshots.find(x=>x.id==='before-work-model-v3');
  await s.storage.import(backup);const after=await s.state();return {snapshotSame:JSON.stringify(snapshot)===JSON.stringify(after.snapshots.find(x=>x.id==='before-work-model-v3')),works:after.workAssignments,originals:after.parts,payments:after.ledgerPayments};
 },original.backup);
 assert.equal(restored.snapshotSame,true);assert.equal(restored.works.length,2);assert.deepEqual(restored.originals,original.d.parts);assert.deepEqual(restored.payments,original.d.ledgerPayments);
 await ctx.setOffline(true);await p.reload();await p.getByText('5 piezas sin especificar',{exact:true}).waitFor();
 await writeFile(path.join(out,'work-migration-results.json'),JSON.stringify({status:'passed',from:'2.2.0',to:'3.0.0',schema:'2 → 3',cases:[9,10],historicalDataPreserved:true,noInventedPieces:true,accruals:2500,paid:1000,balance:1500,offline:true,importV2:true,originalSnapshotPreserved:true},null,2));
 console.log('PASS Migración real 2.2.0 → 3.0.0: registros y finanzas históricas idénticos, cinco piezas sin especificar, identificación segura, importación v2 e inicio offline.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

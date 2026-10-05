import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
const h=await start(),p=h.page;const button=name=>p.getByRole('button',{name,exact:true});
try{
 await p.goto(h.origin);await p.locator('.top').waitFor();
 const result=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{STORES}=await import('./domain.mjs'),s=new TallerService();await s.init();
  const c=await s.saveClient({name:'Respaldo integral',phone:'8095550101'}),v=await s.saveVehicle({clientId:c.id,brand:'Honda',model:'Civic'});
  const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:60000,entryDate:'2026-10-01',dueDate:'2026-10-08',createReception:true,receptionPieces:[{name:'Pintura completa',processes:['Preparación']}],initialAmount:20000,initialMethod:'Efectivo'});
  await s.saveProduct({name:'Lija 480',unit:'unidad',quantity:10,unitCost:65,minimum:2,date:'2026-10-01'});
  await s.change(d=>{d.clients[0].unknownFutureField={keep:'original'};});
  const exported=await s.storage.export(),before=JSON.stringify(await s.state()),preview=await s.storage.previewImport(exported),checks={};
  for(const [key,mutate] of Object.entries({tampered:b=>b.main.clients[0].name='Changed',future:b=>b.backupFormatVersion=99,missingIntegrity:b=>delete b.integrity})){const bad=structuredClone(exported);mutate(bad);try{await s.storage.import(bad);checks[key]=false;}catch{checks[key]=before===JSON.stringify(await s.state());}}
  for(const [key,mutate] of Object.entries({duplicate:b=>b.main.clients.push({...b.main.clients[0]}),missingCollection:b=>delete b.main.payments,orphan:b=>b.main.orders[0].vehicleId=98765,invalidAmount:b=>b.main.payments[0].amount='invalid',futureSchema:b=>b.version=99})){const bad=structuredClone(exported);delete bad.integrity;delete bad.backupFormatVersion;mutate(bad);try{await s.storage.import(bad);checks[key]=false;}catch{checks[key]=before===JSON.stringify(await s.state());}}
  await s.saveClient({name:'Creado después de revisar',phone:'8095550102'});const current=JSON.stringify(await s.state());
  try{await s.storage.import(exported,{expectedState:preview.expectedState});checks.stale=false;}catch{checks.stale=current===JSON.stringify(await s.state());}
  const legacy=structuredClone(exported);delete legacy.integrity;delete legacy.backupFormatVersion;const legacyPreview=await s.storage.previewImport(legacy);
  return {exported,checks,verified:preview.verified,legacyVerified:legacyPreview.verified,count:STORES.length,collections:Object.keys(s.storage.validate(exported)).length};
 });
 assert.ok(Object.values(result.checks).every(Boolean),JSON.stringify(result.checks));assert.equal(result.verified,true);assert.equal(result.legacyVerified,false);assert.equal(result.count,result.collections);assert.equal(result.exported.backupFormatVersion,2);assert.equal(result.exported.version,3);
 await p.goto(h.origin+'/#settings');await button('Respaldos').click();const download=p.waitForEvent('download');await button('Exportar respaldo').click();assert.match((await download).suggestedFilename(),/^TallerOS-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
 const load=async()=>{await button('Restaurar respaldo').click();await p.locator('#backup-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(result.exported))});await button('Restaurar y reemplazar').waitFor();};
 await load();assert.match(await p.locator('#dialog').innerText(),/SHA-256 verificada/);assert.match(await p.locator('#dialog').innerText(),/Comprobantes iniciales/);await button('Cancelar').click();
 assert.equal(await p.evaluate(async()=> (await new (await import('./service.mjs')).TallerService().state()).clients.length),2);
 await p.setViewportSize({width:320,height:700});await load();await p.locator('#dialog').screenshot({path:path.join(out,'backup-preview-mobile.png')});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await button('Restaurar y reemplazar').click();await p.locator('#dialog').waitFor({state:'hidden'});
 const restored=await p.evaluate(async()=>{const s=new (await import('./service.mjs')).TallerService(),d=await s.state(),recovery=await s.storage.previousImportBackup();return {clients:d.clients.length,extra:d.clients[0].unknownFutureField,pieces:d.vehiclePieces.length,payments:d.payments.map(p=>p.amount),stock:d.inventory[0].quantity,recoveryClients:recovery.main.clients.length,recoveryVerified:(await s.storage.previewImport(recovery)).verified};});
 assert.deepEqual(restored,{clients:1,extra:{keep:'original'},pieces:13,payments:[20000],stock:10,recoveryClients:2,recoveryVerified:true});
 await p.reload();await p.locator('.top').waitFor();await button('Exportar recuperación anterior').waitFor();assert.deepEqual(h.errors,[]);await writeFile(path.join(out,'backup-results.json'),JSON.stringify({status:'passed',checks:result.checks,restored},null,2));console.log('PASS Respaldos: integridad, esquema, corrupción, relaciones, concurrencia entre revisión/confirmación, resumen móvil, cancelar, restaurar, recuperación anterior y persistencia.');
}finally{await h.stop();}

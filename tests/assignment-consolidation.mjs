import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
const h=await start(),p=h.page;
const button=text=>p.getByRole('button',{name:text,exact:true});
try{
 await p.goto(h.origin);await p.locator('.top').waitFor();
 await p.evaluate(async()=>{const s=new (await import('./service.mjs')).TallerService();await s.init();const c=await s.saveClient({name:'Selección editable',phone:'8095550100'});await s.saveVehicle({clientId:c.id,brand:'Toyota',model:'Corolla'});await s.saveEmployee({name:'Carlos',pieceRate:400});});
 await p.reload();await button('Nueva orden').click();await p.getByLabel('Vehículo',{exact:true}).selectOption('1');
 await p.getByLabel('Precio acordado',{exact:true}).fill('60000');await p.getByLabel('Entrega prevista',{exact:true}).fill('2026-12-31');
 await button('Pintura completa · 13 piezas').click();assert.equal(await p.locator('.reception-piece').count(),13);
 await button('Pintura completa · 13 piezas').click();assert.equal(await p.locator('.reception-piece').count(),13);
 await p.locator('.reception-piece').filter({has:p.getByLabel('Pieza',{exact:true})}).last().getByRole('button',{name:'Quitar pieza',exact:true}).click();
 assert.equal(await p.locator('.reception-piece').count(),12);
 await button('Guardar orden').click();await p.locator('.customer-document').waitFor();await button('Cerrar').click();
 await button('Asignar empleado').click();await p.getByLabel('Empleado',{exact:true}).selectOption('1');await button('Quitar selección').click();
 for(const name of ['Puerta delantera izquierda','Puerta delantera derecha','Puerta trasera izquierda','Puerta trasera derecha'])await p.getByLabel(name,{exact:true}).check();
 assert.match(await p.locator('.work-total').innerText(),/1,600.00/);await button('Guardar asignación').click();await p.locator('#dialog').waitFor({state:'hidden'});
 const r=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{worksFor}=await import('./work-model.mjs'),{financial}=await import('./domain.mjs');const s=new TallerService(),d=await s.state(),o=d.orders[0];
  const receipt=JSON.stringify(o.initialReceipt),jobs=worksFor(d,o.id),assigned=jobs.find(w=>w.employeeId),pending=jobs.find(w=>!w.employeeId);
  let duplicate=false;try{await s.saveWork(o.id,{...assigned,selectedPieceIds:[assigned.selectedPieceIds[0]]});}catch{duplicate=true;}
  const prep=await s.saveWork(o.id,{process:'Preparación',employeeId:1,selectedPieceIds:assigned.selectedPieceIds,rate:300});
  await s.retireOrderPiece(assigned.selectedPieceIds[0]);let now=await s.state();
  const after=worksFor(now,o.id).filter(w=>w.employeeId).map(w=>[w.process,w.quantity,w.total]);
  const frozen=worksFor(now,o.id).find(w=>w.process==='Pintura'&&w.employeeId);await s.workState(frozen.id,'Terminado');
  const beforeBlocked=JSON.stringify(await s.state());let blocked=false;try{await s.retireOrderPiece(frozen.selectedPieceIds[0]);}catch{blocked=true;}
  const atomic=beforeBlocked===JSON.stringify(await s.state());
  const free=worksFor(await s.state(),o.id).find(w=>!w.employeeId);await s.cancelWork(free.id);await s.saveWork(o.id,{...free,selectedPieceIds:[free.selectedPieceIds[0]]});
  let restoreBlocked=false;try{await s.cancelWork(free.id,true);}catch{restoreBlocked=true;}
  now=await s.state();return {initial:jobs.map(w=>[w.quantity,w.total]).sort((a,b)=>a[0]-b[0]),duplicate,after,blocked,atomic,restoreBlocked,receiptPreserved:receipt===JSON.stringify(now.orders[0].initialReceipt),labor:financial(now,now.orders[0]).labor};
 });
 assert.deepEqual(r.initial,[[4,1600],[8,0]]);assert.equal(r.duplicate,true);assert.deepEqual(r.after.sort(),[['Pintura',3,1200],['Preparación',3,900]].sort());assert.equal(r.blocked,true);assert.equal(r.atomic,true);assert.equal(r.restoreBlocked,true);assert.equal(r.receiptPreserved,true);assert.equal(r.labor,1200);
 await p.reload();await p.locator('.top').waitFor();await p.getByText('Corregir una pieza',{exact:true}).click();await p.screenshot({path:path.join(out,'pieces-correction-mobile.png'),fullPage:true});
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(h.errors,[]);
 await writeFile(path.join(out,'assignment-consolidation-results.json'),JSON.stringify({status:'passed',...r},null,2));console.log('PASS Asignaciones: selección editable 13→12, 4 puertas + 8 pendientes, procesos independientes, duplicados/restauración protegidos, retiro atómico y devengos/comprobante conservados.');
}finally{await h.stop();}

import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
const h=await start();
try{
 await h.page.goto(h.origin);await h.page.locator('.top').waitFor();
 const result=await h.page.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{prepareIntent}=await import('./assistant-core.mjs'),{financial,employeeSummary,audit}=await import('./domain.mjs'),{migrateFullPaint,PIECE_CATALOG}=await import('./work-model.mjs');
  const s=new TallerService();await s.init();
  const c=await s.saveClient({name:'Mario prueba IA',phone:'8095550100'}),v=await s.saveVehicle({clientId:c.id,brand:'Toyota',model:'Corolla'}),e=await s.saveEmployee({name:'Carlos',pieceRate:400});
  const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:60000,entryDate:'2026-10-01',dueDate:'2026-10-08',createReception:true,initialAmount:20000,initialMethod:'Efectivo',receptionPieces:[{name:'Pintura completa',processes:['Preparación','Pintura']}]});
  let d=await s.state();const initial={pieces:d.vehiclePieces.length,quantities:d.workAssignments.map(w=>w.quantity),receipt:o.initialReceipt.works,payments:d.payments.length};
  const read=prepareIntent(d,{action:'order.balance',order:'Toyota'}),context=read.context;
  const follow=prepareIntent(d,{action:'order.balance'},context);
  const missing=prepareIntent(d,{action:'payment.add',amount:5000},context);
  const prepare=async i=>prepareIntent(await s.state(),i,context);
  const proposal=await prepare({action:'payment.add',amount:5000,method:'Efectivo'}),before=JSON.stringify(await s.state());
  const afterPrepare=JSON.stringify(await s.state())===before;
  await Promise.all([s.executeAssistant(proposal),s.executeAssistant(proposal)]);
  const afterPayment=await s.state();
  const stale=await prepare({action:'payment.add',amount:1000,method:'Transferencia'});await s.payment(o.id,{amount:1000,method:'Efectivo',date:'2026-10-03'});let rejected=false;try{await s.executeAssistant(stale);}catch{rejected=true;}
  const inv=await prepare({action:'inventory.receive',product:'Lija 480',quantity:10,unitCost:65,unit:'unidad'});await s.executeAssistant(inv);
  const more=await prepare({action:'inventory.receive',product:'Lijas 480',quantity:5,unitCost:80});await s.executeAssistant(more);
  await s.executeAssistant(await prepare({action:'cost.add',amount:1500,description:'Materiales Toyota',filter:'materials'}));
  const assign=await prepare({action:'work.assign',employee:'Carlos',process:'Pintura',pieces:'todas',rate:400});await s.executeAssistant(assign);
  const assigned=(await s.state()).workAssignments.find(w=>w.process==='Pintura');
  await s.executeAssistant(await prepare({action:'work.finish',process:'Pintura',pieces:'todas'}));
  const finish=(await s.state()).workAssignments.find(w=>w.process==='Pintura');await s.workState(finish.id,'En proceso');await s.workState(finish.id,'Terminado');
  const state=await s.state(),employee=employeeSummary(state,e.id),summary=financial(state,state.orders[0]);
  const queries=['orders.list','work.list','reports.month','reports.receivables','inventory.low'].map(action=>prepareIntent(state,{action}).kind);
  const employeeCard=prepareIntent(state,{action:'employee.balance',employee:'Carlos'});
  const backup=await s.storage.export();await s.storage.import(backup);s.storage.close();await s.init();
  const restored=await s.state();
  // Synthetic 2.4.1 macros: unfinished can expand; frozen finance and documents stay exact.
  const legacy=structuredClone(state);legacy.meta=legacy.meta.filter(x=>x.id!=='full-paint-13-v1');legacy.snapshots=[];
  legacy.orders=[{id:90,workshopId:1,lifecycle:'production',initialReceipt:{keep:true}},{id:91,workshopId:1,lifecycle:'closed',initialReceipt:{keep:true}}];
  legacy.vehiclePieces=[90,91].map(id=>({id:'macro'+id,workshopId:1,orderId:id,catalogId:'old'+id,name:'Pintura completa'}));
  legacy.workAssignments=[90,91].map(id=>({id:'w'+id,workshopId:1,orderId:id,process:'Pintura',employeeId:e.id,quantity:1,selectedPieceIds:['macro'+id],rate:400,total:400,mode:'Por pieza',status:id===90?'Pendiente':'Terminado',ledgerState:id===90?'pending':'generated',sourceAssignmentId:'original'+id}));
  const oldDocs=JSON.stringify(legacy.orders.map(o=>o.initialReceipt)),oldLedger=JSON.stringify(legacy.ledgerAccruals),oldClosed=JSON.stringify(legacy.workAssignments[1]);
  migrateFullPaint(legacy);migrateFullPaint(legacy);
  let invalid=false;try{prepareIntent(state,{action:'delete.all'});}catch{invalid=true;}
  return {initial,read,follow,missing,afterPrepare,afterPayment:{payments:afterPayment.payments.length,amount:afterPayment.payments.at(-1).amount,events:afterPayment.events.filter(e=>e.source==='assistant').length},rejected,assigned,queries,employeeCard,employee,summary,inventory:state.inventory,actions:state.events.filter(e=>e.source==='assistant'),persisted:JSON.stringify(restored.inventory)===JSON.stringify(state.inventory),invalid,issues:audit(restored),migration:{q:legacy.workAssignments[0].quantity,total:legacy.workAssignments[0].total,pieces:legacy.vehiclePieces.filter(p=>p.orderId===90&&!p.retired).length,snapshots:legacy.snapshots.length,closed:oldClosed===JSON.stringify(legacy.workAssignments[1]),documents:oldDocs===JSON.stringify(legacy.orders.map(o=>o.initialReceipt)),ledger:oldLedger===JSON.stringify(legacy.ledgerAccruals)}};
 });
 assert.equal(result.initial.pieces,13);assert.deepEqual(result.initial.quantities,[13,13]);assert.equal(result.initial.payments,1);
 assert.equal(result.read.context.orderId,result.follow.context.orderId);assert.equal(result.missing.field,'method');assert.equal(result.afterPrepare,true);assert.deepEqual(result.afterPayment,{payments:2,amount:5000,events:1});assert.equal(result.rejected,true);
 assert.equal(result.assigned.quantity,13);assert.equal(result.assigned.total,5200);assert.equal(result.employee.generated,5200);assert.equal(result.employee.pieces,13);assert.equal(result.summary.materials,1500);assert.equal(result.summary.labor,5200);assert.equal(result.summary.balance,34000);
 assert.equal(result.inventory.length,1);assert.equal(result.inventory[0].quantity,15);assert.equal(result.inventory[0].unitCost,70);assert.equal(result.actions.length,6);assert.ok(result.queries.every(k=>k==='answer'));assert.equal(result.persisted,true);assert.equal(result.invalid,true);assert.deepEqual(result.issues,[]);
 assert.deepEqual(result.migration,{q:13,total:5200,pieces:13,snapshots:1,closed:true,documents:true,ledger:true});assert.deepEqual(h.errors,[]);
 await writeFile(path.join(out,'assistant-model-results.json'),JSON.stringify({status:'passed',...result},null,2));console.log('PASS Asistente: datos reales, contexto, confirmación, idempotencia concurrente, propuesta obsoleta, inventario, costos, 13 × 400, devengos, migración protegida y persistencia.');
}finally{await h.stop();}

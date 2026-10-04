import assert from 'node:assert/strict';
import {start} from './harness.mjs';
const h=await start();
try{
 await h.page.goto(h.origin);await h.page.locator('.top').waitFor();
 const r=await h.page.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{prepareIntent}=await import('./assistant-core.mjs'),{PIECE_CATALOG}=await import('./work-model.mjs');const s=new TallerService();await s.init();
  const c=await s.saveClient({name:'Prueba ambigua',phone:'8095550100'}),e=await s.saveEmployee({name:'Carlos',pieceRate:400});
  const orders=[];for(const model of ['Corolla','Yaris']){const v=await s.saveVehicle({clientId:c.id,brand:'Toyota',model});orders.push(await s.saveOrder({clientId:c.id,vehicleId:v.id,total:60000,entryDate:'2026-10-01',dueDate:'2026-10-08',createReception:true,receptionPieces:[{name:'Pintura completa',processes:['Preparación']}] }));}
  let d=await s.state();const ambiguous=prepareIntent(d,{action:'payment.add',order:'Toyota',amount:5000,method:'Efectivo'});
  const wrong=prepareIntent(d,{action:'payment.add',order:'Lexus',amount:5000,method:'Efectivo'},{orderId:orders[0].id});
  const unrecognized=prepareIntent(d,{action:'inventory.receive',product:'Lijas',quantity:10});
  const p=prepareIntent(d,{action:'work.assign',order:orders[0].number,employee:'Carlos',process:'Preparación',pieces:'puerta'});await s.executeAssistant(p);
  d=await s.state();const works=d.workAssignments.filter(w=>w.orderId===orders[0].id&&w.process==='Preparación'&&!w.cancelled);
  const before=JSON.stringify(d);let duplicate=false;try{prepareIntent(d,{action:'work.assign',order:orders[0].number,employee:'Carlos',process:'Preparación',pieces:'puerta'});}catch{duplicate=true;}
  const proposal=prepareIntent(d,{action:'payment.add',order:orders[0].number,amount:5000,method:'Efectivo'});proposal.command={method:'deleteEverything',args:[]};await s.executeAssistant(proposal);
  const after=await s.state();
  const partial=prepareIntent(after,{action:'work.finish',order:orders[0].number,process:'Preparación',pieces:'Puerta delantera derecha'});await s.executeAssistant(partial);
  const partialState=await s.state(),earned=partialState.ledgerAccruals.reduce((n,a)=>n+a.total,0),remaining=partialState.workAssignments.filter(w=>w.process==='Preparación'&&w.employeeId&&w.status!=='Terminado'&&!w.cancelled).reduce((n,w)=>n+w.quantity,0);
  const expire=prepareIntent(partialState,{action:'payment.add',order:orders[0].number,amount:5000,method:'Efectivo'});expire.createdAt-=11*60000;let expired=false;try{await s.executeAssistant(expire);}catch{expired=true;}
  const ids=works.flatMap(w=>w.selectedPieceIds);
  return {ambiguous:ambiguous.kind,choices:ambiguous.options.length,wrong:wrong.kind,wrongChoices:wrong.options.length,unrecognized:unrecognized.text,works:works.map(w=>({quantity:w.quantity,total:w.total,employee:!!w.employeeId})),unique:new Set(ids).size,duplicates:ids.length-new Set(ids).size,duplicate,partial:partial.kind,earned,remaining,expired,payments:after.payments.length,amount:after.payments[0].amount};
 });
 assert.equal(r.ambiguous,'question');assert.equal(r.choices,2);assert.equal(r.wrong,'question');assert.equal(r.wrongChoices,0);assert.equal(r.unrecognized,'¿De qué grano son las lijas?');assert.deepEqual(r.works.sort((a,b)=>a.quantity-b.quantity),[{quantity:4,total:1600,employee:true},{quantity:9,total:0,employee:false}]);assert.equal(r.unique,13);assert.equal(r.duplicates,0);assert.equal(r.duplicate,true);assert.equal(r.partial,'proposal');assert.equal(r.earned,400);assert.equal(r.remaining,3);assert.equal(r.expired,true);assert.equal(r.payments,1);assert.equal(r.amount,5000);
 assert.deepEqual(h.errors,[]);console.log('PASS Seguridad: Toyota ambiguo, contexto explícito no sustituido, grano faltante, 4 puertas + 9 pendientes sin duplicar, comando adulterado ignorado, finalización parcial de 1 puerta con 3 pendientes y vencimiento.');
}finally{await h.stop();}


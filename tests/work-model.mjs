import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
const h=await start(),{page:p,origin}=h;
try{
 await p.goto(origin+'/index.html');await p.locator('.top').waitFor();
 const result=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{financial,employeeSummary,finished,audit}=await import('./domain.mjs'),{PIECE_CATALOG,fullCar,worksFor}=await import('./work-model.mjs');
  const s=new TallerService();await s.init();
  const c=await s.saveClient({name:'Cliente Lexus',phone:'8095550101'}),v=await s.saveVehicle({clientId:c.id,brand:'Lexus',model:'G350'});
  const david=await s.saveEmployee({name:'David',pieceRate:500}),francisco=await s.saveEmployee({name:'Francisco',pieceRate:300}),painter=await s.saveEmployee({name:'Carlos',pieceRate:400});
  const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:50000,entryDate:'2026-10-01'});
  const ids=['bumper-front','fender-front-left','door-front-left','door-rear-left','quarter-left'];
  const pieces=await s.saveOrderPieces(o.id,ids),all=pieces.map(p=>p.id),one=[pieces.find(p=>p.catalogId==='fender-front-left').id];
  const a=await s.saveWork(o.id,{process:'Desabolladura',employeeId:david.id,selectedPieceIds:one,rate:500,mode:'Por pieza'});
  const b=await s.saveWork(o.id,{process:'Preparación',employeeId:francisco.id,selectedPieceIds:all,rate:300,mode:'Por pieza'});
  const z=await s.saveWork(o.id,{process:'Pintura',employeeId:painter.id,selectedPieceIds:all,rate:400,mode:'Por pieza'});
  const initial=[a.total,b.total,z.total],quantities=[a.quantity,b.quantity,z.quantity];
  await s.saveWork(o.id,{...b,selectedPieceIds:all.slice(0,4)},b.id);let d=await s.state();
  const edited=[a,b,z].map(source=>d.workAssignments.find(w=>w.id===source.id).total);
  await s.workState(a.id,'Terminado');d=await s.state();
  const statuses=[a,b,z].map(source=>d.workAssignments.find(w=>w.id===source.id).status),allFinished=finished(d,d.orders[0]);
  const account=d.ledgerAccounts.find(x=>x.employeeId===david.id);
  await s.employeePayment(account.id,{amount:200,method:'Efectivo',date:'2026-10-01'});
  const before=await s.state();await s.cancelWork(a.id);await s.cancelWork(a.id,true);await s.workState(a.id,'En proceso');
  const pendingOnReopen=employeeSummary(await s.state(),david.id).pending;
  await s.workState(a.id,'Terminado');await s.workState(a.id,'Terminado');
  d=await s.state();
  const preserved=JSON.stringify(before.ledgerPayments)===JSON.stringify(d.ledgerPayments)&&JSON.stringify(before.ledgerAccruals)===JSON.stringify(d.ledgerAccruals);
  let locked=false;try{await s.saveWork(o.id,{...a,rate:999},a.id);}catch{locked=true;}
  await s.cancelWork(b.id);const afterCancel=financial(await s.state(),o);await s.cancelWork(b.id,true);
  const second=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:20000,entryDate:'2026-10-01'});
  let car=await s.saveOrderPieces(second.id,fullCar(d.settings[0]));const fullCount=car.length;
  car=await s.saveOrderPieces(second.id,PIECE_CATALOG.slice(0,12).map(x=>x.id));
  const twelve=await s.saveWork(second.id,{process:'Pintura',employeeId:painter.id,selectedPieceIds:car.map(x=>x.id),rate:400,mode:'Por pieza'});
  const davidFive=await s.saveWork(second.id,{process:'Desabolladura',employeeId:david.id,selectedPieceIds:car.slice(0,5).map(x=>x.id),rate:500,mode:'Por pieza'});
  await s.settings({fullCarPieceIds:PIECE_CATALOG.slice(0,11).map(x=>x.id)});
  const configured=fullCar((await s.state()).settings[0]).length;
  await s.settings({warranty:{kind:'months',months:6,conditions:'Garantía de pintura.'},quoteConditions:'Precio en RD$.',name:'Taller prueba'});
  const quote=await s.createQuote(o.id);
  await s.settings({warranty:{kind:'months',months:12,conditions:'Nueva garantía'}});
  await s.confirmQuote(quote.id);
  await s.payment(o.id,{amount:20000,method:'Efectivo',date:'2026-10-01'});
  await s.workState(b.id,'Terminado');await s.workState(z.id,'Terminado');
  let deniedBalance=false;try{await s.closeOrder(o.id);}catch{deniedBalance=true;}
  await s.payment(o.id,{amount:30000,method:'Transferencia',date:'2026-10-01'});
  const receipt=await s.closeOrder(o.id),final=await s.state();
  let deniedClosed=false;try{await s.workState(a.id,'En proceso');}catch{deniedClosed=true;}
  const quoteLeak=JSON.stringify(quote),invoiceLeak=JSON.stringify(receipt);
  // Price history and re-confirmation preserve warranty snapshots.
  const q2=await s.createQuote(second.id,'Nueva propuesta',19000);await s.confirmQuote(q2.id);
  const prev=(await s.state()).orders.find(x=>x.id===second.id);
  await s.saveOrder({...prev,total:18000},second.id);
  const priceOrder=(await s.state()).orders.find(x=>x.id===second.id);
  const noWarranty=await s.settings({warranty:{kind:'none',conditions:''}});
  const q3=await s.createQuote(second.id);
  const fixed=await s.saveWork(second.id,{process:'Soldadura',employeeId:david.id,selectedPieceIds:car.slice(0,2).map(p=>p.id),mode:'Monto fijo',rate:777});
  let crossOrderRejected=false;try{await s.saveWork(second.id,{process:'Brillado',employeeId:david.id,selectedPieceIds:one,rate:500});}catch{crossOrderRejected=true;}
  const emptyOrder=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:1000,entryDate:'2026-10-01'});
  const coverage=await s.saveOrderPieces(emptyOrder.id,ids.slice(0,2));
  const only=await s.saveWork(emptyOrder.id,{process:'Preparación',employeeId:david.id,selectedPieceIds:[coverage[0].id],rate:500});
  await Promise.all([s.workState(only.id,'Terminado'),s.workState(only.id,'Terminado')]);
  const coverageState=await s.state(),coverageFinished=finished(coverageState,coverageState.orders.find(o=>o.id===emptyOrder.id));
  await s.cancelWork(only.id);await s.saveOrderPieces(emptyOrder.id,[]);await s.markFinished(emptyOrder.id);
  const emptyState=await s.state(),emptyFinished=finished(emptyState,emptyState.orders.find(o=>o.id===emptyOrder.id));
  const palette=await import('./logo-palette.mjs');const invalidLogo=await palette.paletteFromLogo('data:image/png;base64,invalid');
  const backup=await s.storage.export(),beforeImport=await s.state();await s.storage.import(backup);const afterImport=await s.state();
  return {initial,quantities,edited,statuses,allFinished,preserved,locked,pendingOnReopen,afterCancel,employee:employeeSummary(final,david.id),fullCount,twelve,davidFive,configured,quote,receipt,quoteLeak,invoiceLeak,deniedBalance,deniedClosed,order:final.orders[0],priceOrder,q3,fixed,crossOrderRejected,coverageFinished,emptyFinished,invalidLogo,issues:audit(final),backupVersion:backup.version,preservedImport:JSON.stringify(beforeImport.workAssignments)===JSON.stringify(afterImport.workAssignments)};
 });
 assert.deepEqual(result.initial,[500,1500,2000]);assert.deepEqual(result.quantities,[1,5,5]);assert.deepEqual(result.edited,[500,1200,2000]);
 assert.deepEqual(result.statuses,['Terminado','Pendiente','Pendiente']);assert.equal(result.allFinished,false);
 assert.equal(result.preserved,true);assert.equal(result.locked,true);assert.equal(result.employee.generated,500);assert.equal(result.employee.paid,200);assert.equal(result.employee.balance,300);assert.equal(result.afterCancel.pendingLabor,2000);
 assert.equal(result.fullCount,13);assert.equal(result.twelve.quantity,12);assert.equal(result.twelve.total,4800);assert.equal(result.davidFive.total,2500);assert.equal(result.configured,11);
 assert.equal(result.quote.warranty.months,6);assert.equal(result.receipt.warranty.months,6);assert.equal(result.order.warranty.months,6);
 assert.doesNotMatch(result.quoteLeak,/David|Francisco|Carlos|employeeId|ledger|laborCost|profit/);assert.doesNotMatch(result.invoiceLeak,/David|Francisco|Carlos|employeeId|ledger|laborCost|profit/);
 assert.equal(result.deniedBalance,true);assert.equal(result.deniedClosed,true);assert.equal(result.order.lifecycle,'closed');assert.equal(result.priceOrder.agreementStale,true);assert.equal(result.priceOrder.priceHistory.length,2);assert.equal(result.q3.warranty.kind,'none');assert.equal(result.issues.length,0);assert.equal(result.backupVersion,3);assert.equal(result.preservedImport,true);
 assert.equal(result.fixed.total,777);assert.equal(result.crossOrderRejected,true);assert.equal(result.coverageFinished,false);assert.equal(result.emptyFinished,true);assert.equal(result.invalidLogo.fallback,true);assert.equal(result.pendingOnReopen,1);
 assert.equal(h.errors.length,0,h.errors.join('\n'));
 await writeFile(path.join(out,'work-model-results.json'),JSON.stringify({status:'passed',cases:[1,2,3,4,5,6,7,8,11,12,13],result},null,2));
 console.log('PASS Modelo: selección independiente, 500/1500/2000, editar 5→4, carro 13→12, 5×500, cancelación, devengo idempotente, cotización, garantía y entrega.');
}catch(e){console.error('PAGE ERRORS',h.errors);console.error((await p.locator('body').innerText()).slice(0,1000));throw e;}
finally{await h.stop();}

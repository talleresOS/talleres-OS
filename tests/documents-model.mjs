import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ink,documentMarkup} from '../documents.mjs';
import {start,out} from './harness.mjs';
// Test actual contrast against both configurable surfaces, including midtones.
const lum=hex=>{const [r,g,b]=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;};
for(const c of ['#ffffff','#000000','#ffff00','#777777','#757575','#ff0000','#0000ff','#12fafa']){const a=lum(c),b=lum(ink(c));assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,c);}
const hostile=documentMarkup({kind:'reception',workshop:{name:'<script>alert(1)</script>',appearance:{primary:'red;position:fixed',accent:'#ffffff'}},client:{},vehicle:{},works:[{description:'Pintura',pieces:['Capó']},{description:'Pintura',pieces:['Capó','Puerta']}],payments:[],paid:0,balance:100,total:100});
assert.doesNotMatch(hostile,/<script>/);assert.equal((hostile.match(/<li>Capó<\/li>/g)||[]).length,1);assert.ok(hostile.includes('--doc-primary:#263749'));
const h=await start(),{page:p,origin}=h;
try{
 await p.goto(origin+'/blank');
 const result=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{balance,paid,documentPaymentSummary}=await import('./domain.mjs');const s=new TallerService();await s.init();
  const c=await s.saveClient({name:'Prueba de pagos',phone:'8095550101'}),v=await s.saveVehicle({clientId:c.id,brand:'Honda',model:'Civic'});
  const base={clientId:c.id,vehicleId:v.id,total:60000,entryDate:'2026-10-01',dueDate:'2026-10-08',createReception:true,receptionPieces:[],initialMethod:'Efectivo',initialDate:'2026-10-01'};
  const o=await s.saveOrder({...base,creationToken:'three-payments',initialAmount:20000});
  await s.payment(o.id,{amount:10000,date:'2026-10-05',method:'Transferencia'});let d=await s.state();const intermediate={paid:paid(d,o.id),balance:balance(d,o)};
  await s.payment(o.id,{amount:30000,date:'2026-10-10',method:'Tarjeta'});await s.markFinished(o.id);const invoice=await s.closeOrder(o.id,{hasWarranty:'no',finalNotes:'Sin garantía acordada'});
  const zero=await s.saveOrder({...base,creationToken:'zero',initialAmount:0});const full=await s.saveOrder({...base,creationToken:'full',initialAmount:60000});await s.markFinished(full.id);const fullInvoice=await s.closeOrder(full.id,{hasWarranty:'no'});
  const editable=await s.saveOrder({...base,creationToken:'editable',initialAmount:20000});
  await s.saveOrder({...editable,dueDate:'2026-10-12',workConditions:'Acuerdo actualizado',receptionNotes:'Golpe previo'},editable.id);
  await s.payment(editable.id,{amount:15000,date:'2026-10-01',method:'Otro'},editable.initialPaymentId);d=await s.state();const corrected={paid:paid(d,editable.id),balance:balance(d,editable)};
  await s.voidMovement('payments',editable.initialPaymentId);const voided=paid(await s.state(),editable.id);await s.voidMovement('payments',editable.initialPaymentId,true);await s.voidMovement('payments',editable.initialPaymentId,true);
  const warrantyOrder=await s.saveOrder({...base,total:0,creationToken:'warranty-invalid',initialAmount:0});await s.markFinished(warrantyOrder.id);
  const before=await s.state();let invalid=false;try{await s.closeOrder(warrantyOrder.id,{hasWarranty:'yes',warrantyDuration:'6 meses',warrantyStart:'2026-10-10',warrantyEnd:'2026-09-10'});}catch{invalid=true;}
  d=await s.state();return {intermediate,invoice,summary:documentPaymentSummary(invoice),zero:zero.initialReceipt,zeroPayments:d.payments.filter(p=>p.orderId===zero.id).length,full:documentPaymentSummary(fullInvoice),corrected,voided,restored:paid(d,editable.id),paymentCount:d.payments.filter(p=>p.orderId===editable.id).length,changed:d.orders.find(o=>o.id===editable.id),original:editable.initialReceipt,invalid,unchanged:JSON.stringify(before)===JSON.stringify(d)};
 });
 assert.deepEqual(result.intermediate,{paid:30000,balance:30000});assert.equal(result.invoice.payments.length,3);assert.equal(result.invoice.paid,60000);assert.equal(result.invoice.balance,0);assert.deepEqual(result.summary,{final:30000,advances:30000});assert.equal(result.zeroPayments,0);assert.equal(result.zero.paid,0);assert.equal(result.zero.balance,60000);assert.deepEqual(result.full,{final:0,advances:60000});assert.deepEqual(result.corrected,{paid:15000,balance:45000});assert.equal(result.voided,0);assert.equal(result.restored,15000);assert.equal(result.paymentCount,1);assert.equal(result.changed.dueDate,'2026-10-12');assert.deepEqual(result.changed.initialReceipt,result.original);assert.equal(result.invalid,true);assert.equal(result.unchanged,true);assert.deepEqual(h.errors,[]);
 await writeFile(path.join(out,'documents-model-results.json'),JSON.stringify({status:'passed',result,contrast:'WCAG 4.5:1'},null,2));console.log('PASS Pagos 20+10+30, abono cero/total, corrección/anulación/restauración, fecha editable, instantánea original, contraste y HTML seguro.');
}finally{await h.stop();}

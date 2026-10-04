import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
import {createAssistantServer} from '../server/server.mjs';
const h=await start(),p=h.page;
const server=createAssistantServer({origins:[h.origin],accessCode:'intake-test-only-code',provider:async({message,draft})=>({intent:message==='cliente'?{action:'client.create',client:'Mario Rodríguez'}:message==='8095551234'?{...draft,phone:message}:message==='vehiculo'?{action:'vehicle.create',brand:'Honda',model:'Civic',year:'2011',color:'Gris',plate:'A123456'}:{action:'order.create',amount:60000,initialAmount:20000,method:'Efectivo',date:'2026-10-01',dueDate:'2026-10-08',pieces:'Pintura completa',conditions:'Pintar las piezas acordadas.',receptionNotes:'Rayón en bumper.'},model:'controlled-test'})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const button=text=>p.getByRole('button',{name:text,exact:true}),label=text=>p.getByLabel(text,{exact:true});
const send=async text=>{await label('Mensaje para mi asistente').fill(text);await button('Enviar').click();await p.waitForFunction(()=>!document.querySelector('.assistant-compose button[type=submit]').disabled);};
try{
 await p.goto(h.origin);await p.locator('.top').waitFor();await button('Abrir mi asistente').click();await button('Conexión').click();await label('Dirección del servidor').fill('http://127.0.0.1:'+server.address().port);await label('Código de conexión del propietario').fill('intake-test-only-code');await button('Conectar asistente').click();await p.getByText('Asistente conectado. Puedes escribir o dictar.',{exact:true}).waitFor();
 await send('cliente');await p.getByText('¿Cuál es su teléfono?',{exact:true}).waitFor();await send('8095551234');await button('Cancelar').click();
 assert.equal(await p.evaluate(async()=> (await new (await import('./service.mjs')).TallerService().state()).clients.length),0);
 await send('cliente');await send('8095551234');await button('Confirmar').click();await p.getByText('Cliente registrado.',{exact:true}).waitFor();
 await send('vehiculo');assert.match(await p.locator('.assistant-message').last().innerText(),/Mario Rodríguez/);await button('Confirmar').click();await p.getByText('Vehículo registrado.',{exact:true}).waitFor();
 await send('orden');assert.match(await p.locator('.assistant-message').last().innerText(),/40,000.00/);await button('Confirmar').click();await p.locator('.customer-document').waitFor();
 const initial=await p.locator('.customer-document').innerText();assert.match(initial,/Mario Rodríguez/);assert.match(initial,/Honda/);assert.match(initial,/20,000.00/);assert.match(initial,/40,000.00/);assert.match(initial,/08\/10\/2026/);await p.screenshot({path:path.join(out,'assistant-created-receipt.png'),fullPage:true});await button('Cerrar').click();
 const r=await p.evaluate(async()=>{
  const {TallerService}=await import('./service.mjs'),{prepareIntent}=await import('./assistant-core.mjs'),{financial,employeeSummary}=await import('./domain.mjs');const s=new TallerService();let d=await s.state();const o=d.orders[0],receipt=JSON.stringify(o.initialReceipt),context={orderId:o.id};
  const e=await s.saveEmployee({name:'Carlos',pieceRate:400});
  const execute=async intent=>{const p=prepareIntent(await s.state(),intent,context);if(p.kind!=='proposal')throw Error(p.text);return s.executeAssistant(p);};
  await execute({action:'work.assign',process:'Pintura',pieces:'pintura completa',employee:'Carlos'});
  await execute({action:'work.start',process:'Pintura',pieces:'bonete'});
  let state=await s.state();const started=state.workAssignments.filter(w=>w.status==='En proceso').map(w=>w.quantity);
  const done=prepareIntent(state,{action:'work.finish',process:'Pintura',pieces:'bonete'},context);await Promise.all([s.executeAssistant(done),s.executeAssistant(done)]);
  const one=employeeSummary(await s.state(),e.id);
  await execute({action:'work.finish',process:'Pintura',pieces:'todas'});const all=employeeSummary(await s.state(),e.id);
  // Use a configured existing process, keeping the original receipt immutable.
  await execute({action:'work.add',pieces:'Retrovisor derecho',process:'Brillado'});
  await execute({action:'work.assign',pieces:'Retrovisor derecho',process:'Brillado',employee:'Carlos',rate:200});
  await execute({action:'work.finish',pieces:'Retrovisor derecho',process:'Brillado'});
  await execute({action:'payment.add',amount:40000,method:'Transferencia',date:'2026-10-08'});
  state=await s.state();const beforeClose=financial(state,state.orders[0]),unchanged=receipt===JSON.stringify(state.orders[0].initialReceipt);
  const invoice=await s.closeOrder(o.id,{hasWarranty:'yes',warrantyDuration:'6 meses',warrantyStart:'2026-10-08',warrantyEnd:'2027-04-08',warrantyConditions:'Garantía acordada de prueba.'});
  const backup=await s.storage.export();await s.storage.import(backup);d=await s.state();
  return {started,one:one.generated,all:all.generated,beforeClose,unchanged,payments:d.payments.map(p=>p.amount),pieces:d.vehiclePieces.length,invoice,closed:d.orders[0].lifecycle,clients:d.clients.length,vehicles:d.vehicles.length,audit:d.events.filter(e=>e.source==='assistant').map(e=>e.action)};
 });
 assert.deepEqual(r.started,[1]);assert.equal(r.one,400);assert.equal(r.all,5200);assert.equal(r.beforeClose.labor,5400);assert.equal(r.beforeClose.balance,0);assert.equal(r.unchanged,true);assert.deepEqual(r.payments,[20000,40000]);assert.equal(r.pieces,14);assert.equal(r.closed,'closed');assert.equal(r.clients,1);assert.equal(r.vehicles,1);assert.doesNotMatch(JSON.stringify(r.invoice),/Carlos|employeeId|laborCost|profit/);
 await p.reload();await p.locator('.top').waitFor();await button('Ver factura').click();await p.locator('.customer-document').waitFor();assert.match(await p.locator('.customer-document').innerText(),/PAGADO/);assert.match(await p.locator('.customer-document').innerText(),/6 meses/);await p.screenshot({path:path.join(out,'assistant-intake-final-invoice.png'),fullPage:true});
 assert.deepEqual(h.errors,[]);await writeFile(path.join(out,'assistant-intake-results.json'),JSON.stringify({status:'passed',provider:'controlled; OpenAI live blocked by account quota',result:r},null,2));console.log('PASS Asistente: altas cliente/vehículo/orden por UI, cancelar, contexto, comprobante, 13 piezas, avance parcial 1×400 sin duplicados, saldo final, garantía, factura, backup y recarga.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await h.stop();}

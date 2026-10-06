import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
import {createAssistantServer} from '../server/server.mjs';
const h=await start(),p=h.page,requests=[];
const fixtures={
 'Muéstrame el Toyota':{action:'order.summary',order:'Toyota'},
 '¿Cuánto debe?':{action:'order.balance'},
 'Regístrale RD$5,000':{action:'payment.add',amount:5000},
 'Agrega 10 lijas 480 al inventario.':{action:'inventory.receive',product:'Lija 480',quantity:10,unit:'unidad'},
 '65 pesos cada una':{action:'inventory.receive',product:'Lija 480',quantity:10,unit:'unidad',unitCost:65},
 'Registra 1500 de materiales para el Toyota':{action:'cost.add',order:'Toyota',amount:1500,description:'Materiales',filter:'materials'},
 'Asigna la pintura completa a Carlos por 400 la pieza':{action:'work.assign',order:'Toyota',employee:'Carlos',process:'Pintura',pieces:'pintura completa',rate:400},
 'Termina la pintura del Toyota':{action:'work.finish',order:'Toyota',process:'Pintura',pieces:'todas'},
 '¿Cuánto facturé este mes?':{action:'reports.month'},
 'El Toyota pagó los 35000 restantes por transferencia':{action:'payment.add',order:'Toyota',amount:35000,method:'Transferencia'}
};
const server=createAssistantServer({origins:[h.origin],accessCode:'only-synthetic-test',provider:async body=>{requests.push(body);if(!fixtures[body.message])throw Error('Missing fixture');return {intent:fixtures[body.message]};}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const button=name=>p.getByRole('button',{name,exact:true});const label=name=>p.getByLabel(name,{exact:true});
const send=async text=>{await label('Mensaje para mi asistente').fill(text);await p.locator('.assistant-compose').getByRole('button',{name:'Enviar',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#assistant-status').textContent!=='Revisando…');};
const state=()=>p.evaluate(async()=>new (await import('./service.mjs')).TallerService().state());
try{
 await p.addInitScript(()=>{window.SpeechRecognition=class{start(){this.onstart?.();this.onresult?.({results:[[{transcript:'¿Cuánto debe?'}]]});this.onend?.();}abort(){this.onend?.();}};});
 await p.goto(h.origin);await p.locator('.top').waitFor();await p.clock.setFixedTime(new Date('2026-10-03T12:00:00-04:00'));
 await p.evaluate(async()=>{const s=new (await import('./service.mjs')).TallerService();const c=await s.saveClient({name:'Mario UI IA',phone:'8095550100'});await s.saveVehicle({clientId:c.id,brand:'Toyota',model:'Corolla',year:'2011',color:'Gris'});await s.saveEmployee({name:'Carlos',pieceRate:400});});
 await p.goto(h.origin+'/#orders');await button('Nueva orden').click();await label('Vehículo').selectOption({label:'Toyota · Corolla'});await label('Precio acordado').fill('60000');await label('Fecha de entrada').fill('2026-10-01');await label('Entrega prevista').fill('2026-10-08');await label('Abono inicial').fill('20000');await button('Pintura completa · 13 piezas').click();await button('Guardar orden').click();await p.locator('.customer-document').waitFor();assert.match(await p.locator('.customer-document').innerText(),/40,000.00/);await button('Cerrar').click();await p.waitForURL('**#order/*');
 assert.equal((await state()).vehiclePieces.length,13);
 await button('Abrir mi asistente').click();await button('Conexión').click();await label('Dirección del servidor').fill('http://127.0.0.1:'+server.address().port);await label('Código de conexión del propietario').fill('only-synthetic-test');await button('Conectar asistente').click();await p.getByText('Asistente conectado. Puedes escribir o dictar.',{exact:true}).waitFor();
 await send('Muéstrame el Toyota');await send('¿Cuánto debe?');assert.match(await p.locator('.assistant-message').last().innerText(),/40,000.00/);
 await send('Regístrale RD$5,000');await p.locator('.assistant-options').getByRole('button',{name:'Efectivo',exact:true}).click();await button('Confirmar').waitFor();assert.equal((await state()).payments.length,1);await button('Cancelar').click();assert.equal((await state()).payments.length,1);
 await send('Regístrale RD$5,000');await p.locator('.assistant-options').getByRole('button',{name:'Efectivo',exact:true}).click();await button('Confirmar').click();await p.getByText('Pago registrado.',{exact:true}).first().waitFor();assert.equal((await state()).payments.length,2);
 await send('Agrega 10 lijas 480 al inventario.');await p.getByText('¿Cuál fue el costo por unidad?',{exact:true}).waitFor();await send('65 pesos cada una');await button('Confirmar').click();await p.waitForFunction(async()=> (await new (await import('./service.mjs')).TallerService().state()).inventory.length===1);
 assert.equal((await state()).inventory[0].quantity,10);assert.ok(requests.at(-1).draft.product==='Lija 480');
 await send('Registra 1500 de materiales para el Toyota');await button('Confirmar').click();await p.waitForFunction(async()=> (await new (await import('./service.mjs')).TallerService().state()).costs.length===1);
 await send('Asigna la pintura completa a Carlos por 400 la pieza');assert.match(await p.locator('.assistant-message').last().innerText(),/5,200.00/);await button('Confirmar').click();await p.waitForFunction(async()=> (await new (await import('./service.mjs')).TallerService().state()).workAssignments[0].total===5200);
 await send('Termina la pintura del Toyota');await button('Confirmar').click();await p.getByText('Trabajo terminado.',{exact:true}).first().waitFor();
 await send('¿Cuánto facturé este mes?');assert.match(await p.locator('.assistant-message').last().innerText(),/60,000.00/);
 await button('Dictar mensaje').click();assert.equal(await label('Mensaje para mi asistente').inputValue(),'¿Cuánto debe?');await label('Mensaje para mi asistente').fill('');
 await send('El Toyota pagó los 35000 restantes por transferencia');await button('Confirmar').click();await p.waitForFunction(async()=> (await new (await import('./service.mjs')).TallerService().state()).payments.length===3);
 await button('Actividad').click();await p.getByText('Últimas acciones confirmadas',{exact:true}).waitFor();await p.screenshot({path:path.join(out,'assistant-dark-mobile.png')});await button('Cerrar asistente').click();
 await button('Finalizar y entregar').click();await label('Tiene garantía').selectOption('yes');await label('Duración de garantía').fill('6 meses');await label('Condiciones de garantía').fill('Solo acuerdo de prueba.');await button('Finalizar orden').click();await p.locator('.customer-document').waitFor();assert.match(await p.locator('.customer-document').innerText(),/PAGADO/);assert.doesNotMatch(await p.locator('.customer-document').innerText(),/Carlos|5,200.00|1,500.00/);await button('Cerrar').click();
 await p.reload();await p.locator('.top').waitFor();assert.equal((await state()).orders[0].lifecycle,'closed');assert.equal((await state()).events.filter(e=>e.source==='assistant').length,6);
 const sizing=[];
 for(const theme of ['dark','light']){
  await p.evaluate(async theme=>{await new (await import('./service.mjs')).TallerService().settings({appearance:{theme,primary:'#367fe8',accent:'#ee765c'}});},theme);
  for(const width of [320,390,430,1280]){
   await p.setViewportSize({width,height:844});
   for(const route of ['home','orders','production','clients','employees','inventory','monthly','settings','history','order/1']){
    await p.goto(h.origin+'/#'+route);await p.locator('.top').waitFor();const dimensions=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(dimensions.scroll<=width+1,theme+' '+width+' '+route);sizing.push({theme,width,route,...dimensions});
   }
  }
  await p.setViewportSize({width:390,height:844});await p.goto(h.origin+'/#home');await p.locator('.top').waitFor();await p.screenshot({path:path.join(out,'home-'+theme+'-mobile.png')});await button('Abrir mi asistente').click();await button('Vehículos pendientes').click();await p.screenshot({path:path.join(out,'assistant-'+theme+'-query.png')});await button('Cerrar asistente').click();
 }
 await p.setViewportSize({width:390,height:360});await button('Abrir mi asistente').click();await label('Mensaje para mi asistente').fill('Prueba de espacio del teclado');const rect=await p.locator('.assistant-compose button[type=submit]').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=360);await p.screenshot({path:path.join(out,'assistant-keyboard.png')});
 assert.deepEqual(h.errors,[]);await writeFile(path.join(out,'assistant-ui-results.json'),JSON.stringify({status:'passed',provider:'controlled provider; live OpenAI requires API balance',voice:'simulated adapter',sizing,requests:requests.length},null,2));console.log('PASS UI: recepción 13 piezas, contexto, consultas, preguntas cortas, cancelar/confirmar, pagos, stock, costos, asignar/terminar, factura final, historial, recarga, voz simulada y 80 vistas claro/oscuro.');
}catch(e){await p.screenshot({path:path.join(out,'assistant-ui-failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await h.stop();}

import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {start,out} from './harness.mjs';
const h=await start(),p=h.page,checks=[];
const go=async r=>{await p.goto(h.origin+'/index.html#'+r);await p.locator('.top').waitFor();};
const state=()=>p.evaluate(async()=>new (await import('./service.mjs')).TallerService().state());
try{
 await go('home');
 await p.evaluate(async()=>{
 const s=new (await import('./service.mjs')).TallerService();await s.settings({name:'Estudio Motor',appearance:{theme:'dark',primary:'#eec567',accent:'#69c9c1',mode:'manual'}});
 const c=await s.saveClient({name:'Mario Rodríguez',phone:'8095550100'}),v=await s.saveVehicle({clientId:c.id,brand:'Toyota',model:'Corolla',year:2011,color:'Gris',plate:'PRUEBA-13'});
 const e=await s.saveEmployee({name:'Carlos',pieceRate:400});
 const o=await s.saveOrder({clientId:c.id,vehicleId:v.id,total:60000,entryDate:'2026-10-01',dueDate:'2026-10-08',createReception:true,initialAmount:20000,initialDate:'2026-10-01',initialMethod:'Efectivo',receptionPieces:[{name:'Capó',processes:['Desabolladura','Preparación','Pintura']},{name:'Puerta delantera derecha',processes:['Desabolladura','Preparación','Pintura']}]});
 const d=await s.state();if(!d.payments.length)await s.payment(o.id,{amount:20000,date:'2026-10-01',method:'Efectivo'});
 await s.cost(o.id,{type:'Materiales',description:'Clear de prueba',amount:4800,quantity:1,date:'2026-10-01'});
 const w=(await s.state()).workAssignments.find(x=>x.process==='Desabolladura');await s.saveWork(o.id,{...w,employeeId:e.id,rate:400},w.id);await s.workState(w.id,'Terminado');
 });
 await p.clock.setFixedTime(new Date('2026-10-05T12:00:00-04:00'));await p.reload();await p.locator('.top').waitFor();
 const before=JSON.stringify(await state());
 assert.match(await p.locator('[data-metric="finance"]').innerText(),/40,000.00/);
 assert.match(await p.locator('[data-metric="monthly"]').innerText(),/20,000.00/);
 assert.ok((await p.locator('.process-bar').first().innerText()).includes('2/2'));
 assert.equal(await p.locator('.process-track .complete').count(),1);
 const search=p.getByLabel('Buscar en todo el taller');await search.fill('rodriguez');assert.ok(await p.locator('#global-results a').count()>=2);await search.press('Escape');assert.equal(await p.locator('#global-results').isVisible(),false);
 await p.getByRole('button',{name:'Registrar pago',exact:true}).click();await p.locator('#dialog [data-action="pay"]').click();await p.getByLabel('Monto recibido',{exact:true}).fill('5000');await p.getByRole('button',{name:'Cancelar',exact:true}).click();
 assert.equal(JSON.stringify(await state()),before);
 for(const [route,content] of [['vehicles','Toyota'],['payments','20,000.00'],['expenses','Clear de prueba']]){await go(route);assert.ok((await p.locator('main').innerText()).includes(content));}
 assert.equal(JSON.stringify(await state()),before);checks.push('Dashboard, progreso, búsqueda y accesos usan datos reales; navegar/cancelar no modifica registros');
 for(const theme of ['dark','light']){
 await p.evaluate(async theme=>{const s=new (await import('./service.mjs')).TallerService();await s.settings({appearance:{theme,primary:'#eec567',accent:'#69c9c1',mode:'manual'}});},theme);
 for(const width of [320,375,390,430,1280,1440]){
 await p.setViewportSize({width,height:width>800?1000:844});
 for(const route of ['home','vehicles','payments','expenses','orders','clients','production','employees','inventory','monthly','settings','more']){
 await go(route);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+' '+width+' '+route);if(width<=800)assert.ok(await p.locator('#global-search').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),'Mobile search must avoid iOS focus zoom');
 }
 if(width===390||width===1440){await go('home');await p.screenshot({path:path.join(out,'visual-'+theme+'-'+width+'.png'),fullPage:true});}
 }
 }
 await go('home');await p.getByRole('button',{name:'Cambiar a modo oscuro'}).click();await p.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await p.reload();await p.locator('.top').waitFor();assert.equal(await p.locator('html').getAttribute('data-theme'),'dark');assert.equal((await state()).payments.length,1);
 assert.deepEqual(h.errors,[]);checks.push('12 vistas × 6 anchos × 2 temas sin desbordes; tema y pagos persisten tras recargar');
 await writeFile(path.join(out,'visual-results.json'),JSON.stringify({checks,status:'passed'},null,2));checks.forEach(x=>console.log('PASS '+x));
}finally{await h.stop();}

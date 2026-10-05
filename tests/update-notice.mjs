import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {VERSION} from '../domain.mjs';
import {root,out} from './harness.mjs';
await mkdir(out,{recursive:true});let old=true;const currentCache=(await readFile(path.join(root,'sw.js'),'utf8')).match(/const CACHE='([^']+)'/)[1];
const server=createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html',file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error('path');let body=await readFile(file);if(name==='sw.js'&&old)body=Buffer.from(body.toString().replace("const CACHE='"+currentCache+"'","const CACHE='talleros-before-update-notice'"));res.setHeader('cache-control','no-cache');res.setHeader('content-type',({'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'text/plain');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://localhost:'+server.address().port;
const {chromium}=await import(process.env.TALLEROS_PLAYWRIGHT?pathToFileURL(process.env.TALLEROS_PLAYWRIGHT).href:'playwright'),browser=await chromium.launch({headless:true,...(process.env.TALLEROS_BROWSER?{executablePath:process.env.TALLEROS_BROWSER}:{})}),ctx=await browser.newContext({viewport:{width:390,height:844}});let p=await ctx.newPage();p.setDefaultTimeout(15000);
try{
 await p.goto(origin+'/index.html#clients');await p.locator('.top').waitFor();await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await p.reload();await p.locator('.top').waitFor();
 await p.getByRole('button',{name:'Nuevo cliente',exact:true}).click();await p.getByLabel('Nombre completo',{exact:true}).fill('Formulario conservado');await p.getByLabel('Teléfono',{exact:true}).fill('8095551111');
 old=false;await p.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});await p.locator('#update-notice').waitFor();assert.equal(await p.getByLabel('Nombre completo',{exact:true}).inputValue(),'Formulario conservado');assert.equal(await p.locator('#dialog').evaluate(e=>e.open),true);assert.match(await p.locator('#update-notice').innerText(),/cierra todas las pestañas/);
 await p.getByRole('button',{name:'Guardar cliente',exact:true}).click();await p.waitForURL('**#client/*');await p.close();await new Promise(r=>setTimeout(r,1200));p=await ctx.newPage();await p.goto(origin+'/index.html#clients');await p.getByRole('link',{name:/Formulario conservado/}).waitFor();
 const cachesAfter=await p.evaluate(()=>caches.keys());assert.ok(cachesAfter.includes(currentCache));assert.ok(!cachesAfter.includes('talleros-before-update-notice'));assert.equal(await p.locator('#update-notice').count(),0);
 await ctx.setOffline(true);await p.reload();await p.getByRole('link',{name:/Formulario conservado/}).waitFor();await writeFile(path.join(out,'update-notice-results.json'),JSON.stringify({status:'passed',formPreserved:true,newCache:VERSION,offline:true},null,2));console.log('PASS Aviso de actualización: formulario intacto, cambio de caché tras cerrar y persistencia offline.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

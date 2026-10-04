import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const out=process.env.TALLEROS_TEST_OUTPUT||path.join(root,'.test-results');
export async function start({serviceWorkers='block'}={}){
 await mkdir(out,{recursive:true});
 const {chromium}=await import(process.env.TALLEROS_PLAYWRIGHT?pathToFileURL(process.env.TALLEROS_PLAYWRIGHT).href:'playwright');
 const server=createServer(async(req,res)=>{try{
  if(req.url==='/blank'){res.setHeader('content-type','text/html');res.end('<title>Test</title>');return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.split('/').some(s=>s.startsWith('.')||s==='server'||s==='local-backups'))throw Error('private path');
  const file=path.resolve(root,pathname.replace(/^\/+/,'')||'index.html');if(!file.startsWith(root+path.sep))throw Error('path');
  res.setHeader('content-type',({'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://localhost:'+server.address().port;
 const launch={headless:true,executablePath:process.env.TALLEROS_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'};
 const browser=await chromium.launch(launch),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 return {browser,context,page,origin,errors,chromium,launch,stop:async()=>{await browser.close();await new Promise(r=>server.close(r));}};
}

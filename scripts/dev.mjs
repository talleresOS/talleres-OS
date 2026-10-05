// Local runtime without Codex, cloud tooling, frameworks or third-party dependencies.
import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import '../prepare-release.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=await realpath(path.join(root,'dist'));
try{process.loadEnvFile(path.join(root,'server','.env.local'));}catch(e){if(e.code!=='ENOENT')throw e;}
const port=Number(process.env.DEV_PORT)||4173;
process.env.ASSISTANT_ALLOWED_ORIGINS=[process.env.ASSISTANT_ALLOWED_ORIGINS,'http://localhost:'+port,'http://127.0.0.1:'+port].filter(Boolean).join(',');
const {default:assistant}=await import('../api/assistant.mjs');
const manifest=JSON.parse(await readFile(path.join(dist,'release-manifest.json'),'utf8'));
const allowed=new Set([...Object.keys(manifest.files),'release-manifest.json']);
const types={'.html':'text/html; charset=utf-8','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),match=url.pathname.match(/^\/api\/assistant\/(session|interpret)$/);
    if(match){req.url='/api/assistant?action='+match[1];await assistant(req,res);return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const name=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
    if(!allowed.has(name)){res.writeHead(404);res.end('No disponible');return;}
    const file=await realpath(path.join(dist,name));if(!file.startsWith(dist+path.sep))throw Error('Private path');
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{if(!res.headersSent)res.writeHead(500);res.end('No se pudo completar la solicitud.');}
});
server.listen(port,'127.0.0.1',()=>console.log('TallerOS local: http://localhost:'+port+' · Solo dist es público. Ctrl+C para detener.'));

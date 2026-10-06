import {copyFileSync,mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.dirname(fileURLToPath(import.meta.url)),out=path.join(base,'dist');mkdirSync(out,{recursive:true});
const files=["document-policy.mjs","dashboard-ui.mjs","workshop-background.webp","interface.css","assistant-contract.mjs","assistant-core.mjs","assistant-service.mjs","assistant-provider.mjs","assistant-voice.mjs","assistant-ui.mjs",'index.html','styles.css','app.js','domain.mjs','storage.mjs','backup.mjs','service.mjs','work-model.mjs','work-service.mjs','work-ui.mjs','logo-palette.mjs','documents.mjs','documents-style.mjs','document-ui.mjs','pwa.js','sw.js','version.json','manifest.webmanifest','manifest.json','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
const hashes={};for(const file of files){const content=readFileSync(path.join(base,file));if(/sk-[A-Za-z0-9_-]{30,}/.test(content.toString()))throw Error('Publicación detenida: posible credencial en '+file);copyFileSync(path.join(base,file),path.join(out,file));hashes[file]=createHash('sha256').update(content).digest('hex');}
for(const entry of readdirSync(out))if(entry!=='release-manifest.json'&&!files.includes(entry))throw Error('Publicación detenida: archivo no autorizado en dist: '+entry);
writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify({files:hashes},null,2));
console.log(JSON.stringify({directory:out,files:files.length,version:JSON.parse(readFileSync(path.join(base,'version.json'),'utf8')).version}));

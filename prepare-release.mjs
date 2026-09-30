import {copyFileSync,mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const base=decodeURIComponent(root),out=path.join(base,'dist');mkdirSync(out,{recursive:true});
const files=['index.html','styles.css','app.js','domain.mjs','storage.mjs','service.mjs','pwa.js','sw.js','version.json','manifest.webmanifest','manifest.json','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
const hashes={};for(const file of files){copyFileSync(path.join(base,file),path.join(out,file));hashes[file]=createHash('sha256').update(readFileSync(path.join(out,file))).digest('hex');}
writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify({files:hashes},null,2));
console.log(JSON.stringify({directory:out,files:files.length,version:JSON.parse(readFileSync(path.join(base,'version.json'),'utf8')).version}));

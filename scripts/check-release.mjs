import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {VERSION} from '../domain.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),read=f=>readFileSync(path.join(root,f),'utf8');
const version=JSON.parse(read('version.json')),pkg=JSON.parse(read('package.json')),manifest=JSON.parse(read('dist/release-manifest.json'));
if(version.version!==VERSION||pkg.version!==VERSION||version.database.version!==3)throw Error('Versiones o esquema inconsistentes.');
const files=Object.keys(manifest.files),actual=readdirSync(path.join(root,'dist'));
if(actual.length!==files.length+1||actual.some(f=>f!=='release-manifest.json'&&!files.includes(f)))throw Error('Archivo inesperado en dist.');
const privatePath=/(^|\/)(server|api|tests|scripts|docs|local-backups|node_modules|\.[^/]+)(\/|$)|TallerOS-(backup|copia|recuperacion)-|\.local\.json$/;
const sw=read('sw.js');
for(const file of files){
 if(privatePath.test(file))throw Error('Ruta privada en dist: '+file);
 const source=readFileSync(path.join(root,file)),publicFile=readFileSync(path.join(root,'dist',file));
 const hash=b=>createHash('sha256').update(b).digest('hex');
 if(hash(source)!==manifest.files[file]||hash(publicFile)!==manifest.files[file])throw Error('Build desactualizado: '+file);
 if(!file.endsWith('.png')&&(/sk-[A-Za-z0-9_-]{30,}/.test(source.toString())||source.toString().includes('OPENAI_API_KEY')))throw Error('Posible secreto/configuración del servidor en frontend: '+file);
 if(file!=='sw.js'&&!sw.includes('./'+file))throw Error('Falta archivo público en precaché: '+file);
}
for(const file of ['.env.example','server/.env.example'])for(const line of read(file).split(/\r?\n/))if(line.trim()&&!line.startsWith('#')&&!/^[A-Z_]+=$/.test(line))throw Error('La plantilla de entorno debe contener solo nombres vacíos: '+file);
const config=JSON.parse(read('vercel.json'));if(config.outputDirectory!=='dist')throw Error('Vercel debe servir exclusivamente dist.');
console.log('PASS Release '+version.build+': '+files.length+' assets íntegros, caché completo, esquema 3 y plantillas sin valores.');

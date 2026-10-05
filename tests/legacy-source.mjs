import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
export async function legacySource(version,names){
  if(!['2.2.0','2.3.0'].includes(version))throw Error('Fixture no disponible.');
  const fixture=JSON.parse(await readFile(new URL('./fixtures/source-'+version+'.json',import.meta.url),'utf8'));
  const decoded=gunzipSync(Buffer.from(fixture.data,'base64'));
  if(createHash('sha256').update(decoded).digest('hex')!==fixture.sha256)throw Error('Fixture histórico alterado.');
  const files=JSON.parse(decoded);return Object.fromEntries(names.map(name=>{if(!files[name])throw Error('Falta archivo histórico '+name);return [name,Buffer.from(files[name],'base64')];}));
}

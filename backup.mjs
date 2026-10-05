import {MAIN,STORES,VERSION,audit,find} from './domain.mjs';
// Database schema stays at 3. Envelope revision 2 adds integrity, not a data migration.
export const BACKUP_FORMAT_VERSION=2;
export const backupFilename=(date=new Date())=>'TallerOS-backup-'+[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')+'-'+String(date.getHours()).padStart(2,'0')+String(date.getMinutes()).padStart(2,'0')+'.json';
function canonical(value,depth=0){
  if(depth>80)throw Error('El respaldo contiene una estructura demasiado profunda.');
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(v=>canonical(v,depth+1)).join(',')+']';
  return '{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}';
}
async function checksum(payload){
  const {integrity,...data}=payload;
  if(!globalThis.crypto?.subtle)throw Error('Abre TallerOS mediante HTTPS o localhost para verificar el respaldo.');
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(data)));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function sealBackup(payload){
  const data=JSON.parse(JSON.stringify({...payload,backupFormatVersion:BACKUP_FORMAT_VERSION}));
  data.integrity={algorithm:'SHA-256',value:await checksum(data)};return data;
}
export async function verifyBackup(payload){
  if(payload?.backupFormatVersion!==undefined&&payload.backupFormatVersion!==BACKUP_FORMAT_VERSION)throw Error('La versión del archivo de respaldo no es compatible. Usa la versión de TallerOS que lo creó.');
  if(payload?.backupFormatVersion===BACKUP_FORMAT_VERSION){
    if(payload.integrity?.algorithm!=='SHA-256'||!/^[a-f0-9]{64}$/.test(payload.integrity?.value||''))throw Error('Falta la verificación de integridad del respaldo.');
    if(typeof payload.appVersion!=='string'||!payload.exportedAt||!Number.isFinite(Date.parse(payload.exportedAt)))throw Error('Los metadatos del respaldo están dañados.');
  }
  if(payload?.integrity){if(payload.integrity.algorithm!=='SHA-256'||await checksum(payload)!==payload.integrity.value)throw Error('El respaldo está dañado o fue modificado. No se restauró ningún dato.');return true;}
  return false;
}
export function backupPayload(d,extra={}){
  return {format:'TallerOS-backup',version:3,appVersion:VERSION,workshopId:1,exportedAt:new Date().toISOString(),main:Object.fromEntries(MAIN.map(s=>[s,d[s]])),ledger:{accounts:d.ledgerAccounts,accruals:d.ledgerAccruals,payments:d.ledgerPayments},phase2:Object.fromEntries(STORES.filter(s=>!MAIN.includes(s)&&!s.startsWith('ledger')).map(s=>[s,d[s]||[]])),...extra};
}
export function validateBackupData(d){
  for(const s of STORES)for(const row of d[s]){
    if(Array.isArray(row)||row===null||typeof row!=='object'||!(typeof row.id==='string'&&row.id.trim()||typeof row.id==='number'&&Number.isFinite(row.id)))throw Error('Registro inválido en '+s+'.');
  }
  if(d.settings.length!==1)throw Error('El respaldo debe contener la configuración de un taller.');
  for(const [store,fields] of Object.entries({orders:['total'],payments:['amount'],costs:['amount'],inventory:['quantity','minimum','unitCost'],workAssignments:['quantity','rate','total'],ledgerAccruals:['total'],ledgerPayments:['amount']})){
    for(const row of d[store])for(const field of fields){const value=row[field];if(value!==undefined&&value!==null&&(!(typeof value==='number'||typeof value==='string'&&value.trim())||!Number.isFinite(Number(value))||Number(value)<0))throw Error('Valor económico inválido en '+store+': '+field+'.');}
  }
  const relation=(rows,field,store)=>{for(const row of rows)if(!find(d,store,row[field]))throw Error('Referencia ausente en '+field+' del registro '+row.id+'.');};
  relation(d.vehicles,'clientId','clients');relation(d.orders,'clientId','clients');relation(d.orders,'vehicleId','vehicles');
  for(const o of d.orders)if(String(find(d,'vehicles',o.vehicleId).clientId)!==String(o.clientId))throw Error('El vehículo de una orden pertenece a otro cliente.');
  relation([...d.parts,...d.payments,...d.costs,...d.workAssignments,...d.invoices],'orderId','orders');
  for(const w of d.workAssignments)if(w.employeeId&&!find(d,'employees',w.employeeId))throw Error('Empleado de una asignación ausente.');
  for(const m of d.inventoryMoves)if(!find(d,'inventory',m.productId))throw Error('Producto de un movimiento de inventario ausente.');
  return d;
}
export function backupOverview(d){
  const counts=[['Clientes',d.clients.length],['Vehículos',d.vehicles.length],['Órdenes',d.orders.length],['Piezas físicas',d.vehiclePieces.length],['Piezas históricas',d.parts.length],['Procesos/asignaciones',d.workAssignments.length],['Empleados',d.employees.length],['Pagos de clientes',d.payments.length],['Gastos/costos',d.costs.length],['Productos',d.inventory.length],['Movimientos de inventario',d.inventoryMoves.length],['Comprobantes iniciales',d.orders.filter(o=>o.initialReceipt).length],['Facturas',d.invoices.length],['Garantías por orden',d.orders.filter(o=>o.warranty?.kind&&o.warranty.kind!=='none').length],['Cuentas de empleados',d.ledgerAccounts.length],['Devengos',d.ledgerAccruals.length],['Pagos a empleados',d.ledgerPayments.length],['Cotizaciones',d.quotations.length],['Cierres mensuales',d.monthlyClosures.length],['Eventos',d.events.length],['Instantáneas',d.snapshots.length]];
  return {counts,warnings:audit(d).map(x=>x.message+' Registro '+x.id)};
}

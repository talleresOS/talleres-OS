// Physical vehicle pieces and independent work assignments.
export const PROCESSES=['Desabolladura','Preparación','Pintura','Brillado','Armado/desarmado','Soldadura','Plásticos','Otro','Pulido','Restauración'];
export const WORK_STATES=['Pendiente','En proceso','Terminado'];
export const PIECE_CATALOG=[
 ['bumper-front','Bumper delantero'],['bumper-rear','Bumper trasero'],['hood','Capó'],
 ['fender-front-left','Guardalodo delantero izquierdo'],['fender-front-right','Guardalodo delantero derecho'],
 ['door-front-left','Puerta delantera izquierda'],['door-front-right','Puerta delantera derecha'],
 ['door-rear-left','Puerta trasera izquierda'],['door-rear-right','Puerta trasera derecha'],
 ['quarter-left','Guardalodo/lateral trasero izquierdo'],['quarter-right','Guardalodo/lateral trasero derecho'],
 ['trunk','Tapa de baúl/compuerta'],['roof','Techo']
].map(([id,name])=>({id,name}));
export const catalog=s=>[...PIECE_CATALOG,...(s.customPieces||[])];
export const fullCar=s=>s.fullCarPieceIds||PIECE_CATALOG.map(p=>p.id);
export const isFullPaint=name=>String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='pintura completa';
// Painting the full car always means the existing 13 standard physical pieces.
// The workshop's optional custom "carro completo" selection remains independent.
export function expandReceptionPieces(items){
  if(!Array.isArray(items))return items;
  const expanded=new Map();
  for(const item of items){
    const full=isFullPaint(item.name);
    for(const name of full?PIECE_CATALOG.map(p=>p.name):[String(item.name||'').trim()]){
      const key=name.toLocaleLowerCase(),old=expanded.get(key);
      if(old&&!full&&!old.full)throw Error('Una pieza está repetida. Selecciona sus procesos en una misma fila.');
      expanded.set(key,{name,processes:[...new Set([...(old?.processes||[]),...(item.processes||[]),...(full?['Pintura']:[])])],full:full||old?.full});
    }
  }
  return [...expanded.values()];
}
export function migrateFullPaint(d,at=new Date().toISOString()){
  if(d.meta.some(x=>x.id==='full-paint-13-v1'))return false;
  d.snapshots.push({id:'before-full-paint-13-v1',workshopId:1,createdAt:at,reason:'Antes de normalizar pintura completa y habilitar asistente',payload:structuredClone(Object.fromEntries(Object.entries(d).filter(([s])=>s!=='snapshots')))});
  for(const o of d.orders.filter(o=>o.workshopId===1)){
    const macros=d.vehiclePieces.filter(p=>p.orderId===o.id&&!p.retired&&isFullPaint(p.name));
    const jobs=worksFor(d,o.id,true).filter(w=>w.selectedPieceIds.some(id=>macros.some(p=>p.id===id))||!w.selectedPieceIds.length&&w.quantity===1&&isFullPaint(w.legacyDescription));
    if(!macros.length&&!jobs.length)continue;
    const protectedOrder=o.archived||o.deleted||o.deletedAt||['closed','cancelled'].includes(o.lifecycle)||['Entregada','Cerrada','Cancelada','Cerrada / Entregada'].includes(o.status);
    if(protectedOrder||jobs.some(w=>workFrozen(w)||w.cancelled||w.status==='Terminado'||d.ledgerAccruals.some(a=>a.sourceAssignmentId===w.sourceAssignmentId))){
      o.fullPaintHistoricalNotice='Pintura completa histórica: se conservan cantidad e importes originales; no se recalculan devengos ni pagos.';continue;
    }
    const standard=PIECE_CATALOG.map(c=>{
      let p=d.vehiclePieces.find(p=>p.orderId===o.id&&p.catalogId===c.id);
      if(!p){p={id:crypto.randomUUID(),workshopId:1,orderId:o.id,catalogId:c.id,name:c.name,retired:false,createdAt:at};d.vehiclePieces.push(p);}
      p.retired=false;return p.id;
    });
    for(const w of jobs){
      w.selectedPieceIds=[...new Set([...w.selectedPieceIds.filter(id=>!macros.some(p=>p.id===id)),...standard])];
      w.quantity=w.selectedPieceIds.length;w.unspecifiedQuantity=0;
      if(w.process==='Trabajo anterior')w.process='Pintura';
      w.total=w.employeeId?Math.round((w.mode==='Por pieza'?w.quantity*w.rate:w.rate)*100)/100:0;
      w.fullPaintExpandedAt=at;
    }
    for(const p of macros){p.retired=true;p.expandedInto=[...standard];p.retiredAt=at;}
    o.fullPaintExpandedAt=at;
  }
  d.meta.push({id:'full-paint-13-v1',workshopId:1,at});return true;
}
export const worksFor=(d,orderId,includeCancelled=false)=>(d.workAssignments||[]).filter(w=>Number(w.orderId)===Number(orderId)&&(includeCancelled||!w.cancelled)).sort((a,b)=>(PROCESSES.includes(a.process)?PROCESSES.indexOf(a.process):99)-(PROCESSES.includes(b.process)?PROCESSES.indexOf(b.process):99)||String(a.createdAt).localeCompare(String(b.createdAt))||a.id.localeCompare(b.id));
export const piecesFor=(d,orderId,includeRetired=false)=>{
  const rank=id=>{const index=PIECE_CATALOG.findIndex(p=>p.id===id);return index<0?99:index;};
  return (d.vehiclePieces||[]).filter(p=>Number(p.orderId)===Number(orderId)&&(includeRetired||!p.retired)).sort((a,b)=>rank(a.catalogId)-rank(b.catalogId)||a.name.localeCompare(b.name));
};
export const workPieceNames=(d,w)=>(w.selectedPieceIds||[]).map(id=>d.vehiclePieces.find(p=>p.id===id)?.name||'Pieza conservada');
export const workFrozen=w=>w.ledgerState==='generated'||w.ledgerState==='legacy'||w.ledgerCostAlreadyCounted;
export const oldAssignmentMapped=(d,p,a)=>(d.workAssignments||[]).some(w=>w.legacyPartId===p.id&&w.sourceAssignmentId===a.sourceAssignmentId);
export function migrateWorkModel(d,at=new Date().toISOString()){
  if(d.meta.some(x=>x.id==='work-model-v3'))return false;
  const snapshotId=d.snapshots.some(s=>s.id==='before-work-model-v3')?'before-work-model-v3-'+crypto.randomUUID():'before-work-model-v3';
  d.snapshots.push({id:snapshotId,workshopId:1,createdAt:at,reason:'Copia completa antes de separar piezas y procesos',payload:structuredClone(Object.fromEntries(Object.entries(d).filter(([s])=>s!=='snapshots')))});
  for(const o of d.orders.filter(x=>x.workshopId===1))o.workModelVersion=3;
  for(const p of d.parts.filter(x=>x.workshopId===1)){
    const rows=p.laborAssignments?.length?p.laborAssignments:[null];
    rows.forEach(a=>{
      const source=a?.sourceAssignmentId||'legacy-unassigned-'+p.id,id='work-'+p.id+'-'+source;
      if(d.workAssignments.some(w=>w.id===id))return;
      d.workAssignments.push({
        id,workshopId:1,orderId:p.orderId,process:'Trabajo anterior',legacyDescription:a?.work||p.description,
        legacyStage:p.status,legacyResponsibleId:p.employeeId||null,legacyPartId:p.id,
        sourceAssignmentId:source,employeeId:a?.employeeId||null,selectedPieceIds:[],
        unspecifiedQuantity:a?Number(a.quantity)||0:1,quantity:a?Number(a.quantity)||0:1,
        rate:a?Number(a.rate)||0:0,mode:a?.mode||'Por pieza',total:a?Number(a.total)||0:0,role:a?.role||'',
        ledgerState:a?.ledgerState||'unassigned',ledgerCostAlreadyCounted:!!a?.ledgerCostAlreadyCounted,
        accrualId:a?.accrualId||d.ledgerAccruals.find(x=>x.sourceAssignmentId===source)?.id||null,
        status:p.status==='Terminada'?'Terminado':p.status==='Pendiente'?'Pendiente':'En proceso',
        cancelled:!!p.archived,completedAt:p.completedAt||null,createdAt:at,migrated:true
      });
    });
  }
  d.meta.push({id:'work-model-v3',workshopId:1,version:3,migratedAt:at});
  return true;
}

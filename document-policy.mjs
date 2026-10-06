// Shared customer-document policy. No storage access and no mutation of historical snapshots.
const text=v=>String(v??'').trim();
const validDate=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;const d=new Date(v+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v;};
export function calendarExpiry(start,duration,unit='months'){
 if(!validDate(start)||!Number.isInteger(Number(duration))||Number(duration)<=0)return '';
 const [y,m,day]=start.split('-').map(Number),d=new Date(Date.UTC(y,m-1,day,12));
 if(unit==='days')d.setUTCDate(day+Number(duration));
 else {const months=Number(duration)*(unit==='years'?12:1);d.setUTCDate(1);d.setUTCMonth(m-1+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));}
 return d.toISOString().slice(0,10);
}
export function parseDuration(label,unit){
 const m=text(label).toLowerCase().match(/^(\d+)\s*(mes(?:es)?|año(?:s)?|dia(?:s)?|día(?:s)?)?$/);
 if(!m)return null;const u=m[2]?(m[2].startsWith('mes')?'months':m[2].startsWith('año')?'years':'days'):unit;
 const count=Number(m[1]);return ['months','years','days'].includes(u)&&count>0&&count<=1200?{duration:count,unit:u}:null;
}
export function normalizeWarranty(w){
 if(!w||w.kind==='none')return {kind:'none'};
 let parsed=w.kind==='months'?parseDuration(w.months,'months'):parseDuration(w.duration??w.label,w.unit);
 // Legacy numeric text only gains a unit when its OWN stored dates prove it.
 if(!parsed&&/^\d+$/.test(text(w.label))&&w.startDate&&w.endDate)for(const unit of ['months','years','days'])if(calendarExpiry(w.startDate,Number(w.label),unit)===w.endDate){parsed={duration:Number(w.label),unit};break;}
 const value={kind:parsed?.unit==='months'?'months':'custom',label:text(w.label),conditions:text(w.conditions)};
 if(parsed){Object.assign(value,parsed);if(parsed.unit==='months')value.months=parsed.duration;}
 if(validDate(w.startDate))value.startDate=w.startDate;if(validDate(w.endDate))value.endDate=w.endDate;
 return value;
}
export function warrantyLabel(w){
 const n=normalizeWarranty(w);if(n.kind==='none')return 'Sin garantía';
 if(n.duration){const units={months:['mes','meses'],years:['año','años'],days:['día','días']};return n.duration+' '+units[n.unit][n.duration===1?0:1];}
 return /^\d+$/.test(n.label)?n.label+' (unidad no registrada)':n.label||'Duración no especificada';
}
export function resolveWarranty(settings,order={}){
 const own=order.warranty,valid=own&&(own.kind==='none'||own.kind==='months'&&Number(own.months)>0||own.kind==='custom'&&text(own.label));
 return {...normalizeWarranty(valid?own:settings?.warranty),source:valid?'order':'workshop'};
}
export function deliveryWarranty(w,deliveryDate){
 const result=normalizeWarranty(w);if(result.kind==='none')return result;
 result.startDate=deliveryDate;if(result.duration)result.endDate=calendarExpiry(deliveryDate,result.duration,result.unit);
 return result;
}
export function documentPresentation(v={}){
 return {style:['classic','modern','compact'].includes(v.style)?v.style:'modern',colorMode:v.colorMode==='custom'?'custom':'workshop',color:/^#[a-f0-9]{6}$/i.test(v.color||'')?v.color:'#263749',showLogo:v.showLogo!==false,showSignature:v.showSignature!==false,quoteMode:v.quoteMode==='detailed'?'detailed':'summary',showPieces:v.showPieces!==false};
}

export function workshopSnapshot(s={}){
 const fields=['name','logoData','phone','whatsapp','instagram','address','website','email','document'];
 return {...Object.fromEntries(fields.filter(k=>s[k]!==undefined).map(k=>[k,structuredClone(s[k])])),appearance:structuredClone(s.appearance||{})};
}

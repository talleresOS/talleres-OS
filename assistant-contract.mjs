// Provider-independent intent contract. No arbitrary SQL, code, URLs or store writes.
export const ACTIONS=['order.summary','order.balance','order.costs','order.profit','orders.list','work.list','inventory.low','inventory.list','employee.balance','reports.month','reports.receivables','client.create','vehicle.create','order.create','work.add','payment.add','cost.add','inventory.receive','work.assign','work.start','work.finish','clarify'];
export const TEXT_FIELDS=['order','employee','product','pieces','process','method','date','month','description','unit','filter','question','client','phone','whatsapp','vehicle','brand','model','year','color','plate','dueDate','paymentDate','conditions','receptionNotes'];
export const NUMBER_FIELDS=['amount','quantity','unitCost','rate','initialAmount'];
export const intentSchema={type:'object',additionalProperties:false,properties:{action:{type:'string',enum:ACTIONS},...Object.fromEntries(TEXT_FIELDS.map(k=>[k,{type:['string','null']}])),...Object.fromEntries(NUMBER_FIELDS.map(k=>[k,{type:['number','null']}]))},required:['action',...TEXT_FIELDS,...NUMBER_FIELDS]};
export function validateIntent(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!ACTIONS.includes(value.action))throw Error('No pude interpretar una acción disponible. Inténtalo con otras palabras.');
  if(Object.keys(value).some(k=>!intentSchema.required.includes(k)))throw Error('La respuesta contiene campos no permitidos.');
  const out={action:value.action};
  for(const k of TEXT_FIELDS){const v=value[k]??null;if(v!==null&&(typeof v!=='string'||v.length>600))throw Error('Texto de acción inválido.');out[k]=v?.trim()||null;}
  for(const k of NUMBER_FIELDS){const v=value[k]??null;if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e10))throw Error('Importe o cantidad inválidos.');out[k]=v;}
  return out;
}

export async function logoKey(source){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function paletteFromLogo(source){
  const fallback=['#eec567','#69c9c1','#202936','#f6f8fc','#b8c4d5'];
  try{
    const image=new Image();image.src=source;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,64,64);ctx.drawImage(image,0,0,64,64);
    const pixels=ctx.getImageData(0,0,64,64).data,bins=new Map();
    for(let i=0;i<pixels.length;i+=4){
      if(pixels[i+3]<150)continue;
      const rgb=[pixels[i],pixels[i+1],pixels[i+2]],max=Math.max(...rgb),min=Math.min(...rgb);
      if(max<24||min>238)continue;
      const key=rgb.map(x=>Math.round(x/32)*32).join(',');
      const bin=bins.get(key)||{count:0,rgb:[0,0,0]};bin.count++;rgb.forEach((x,i)=>bin.rgb[i]+=x);bins.set(key,bin);
    }
    const colors=[...bins.values()].map(b=>({count:b.count,rgb:b.rgb.map(x=>Math.round(x/b.count))})).sort((a,b)=>b.count-a.count);
    const picked=[];
    for(const c of colors){if(picked.every(p=>Math.hypot(...c.rgb.map((x,i)=>x-p[i]))>62))picked.push(c.rgb);if(picked.length===5)break;}
    if(!picked.length)return {colors:fallback,fallback:true};
    picked.sort((a,b)=>(Math.max(...b)-Math.min(...b))-(Math.max(...a)-Math.min(...a)));
    const toHex=rgb=>'#'+rgb.map(x=>Math.max(0,Math.min(255,x)).toString(16).padStart(2,'0')).join('');
    const result=picked.map(toHex);
    const base=picked[0];
    for(const [target,weight] of [[255,.35],[0,.35],[255,.85],[0,.75]]){
      const shade=toHex(base.map(v=>Math.round(v+(target-v)*weight)));
      if(result.length<5&&!result.includes(shade))result.push(shade);
    }
    return {colors:result.slice(0,5),fallback:false};
  }catch{return {colors:fallback,fallback:true};}
}

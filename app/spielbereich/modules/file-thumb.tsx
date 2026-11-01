"use client";
/* eslint-disable @next/next/no-img-element -- Protected existing file endpoints. */
import type {CSSProperties} from 'react';

/**
 * Small previews instead of full originals in lists, pickers and cards. The server answers ?size=thumb with the stored
 * preview, or with the original while none exists yet. In that case the browser that just loaded the original scales
 * it down once and stores the preview (only accepted for files the person may manage), so the next list is light.
 */
const THUMB=360;
const tried=new Set<string>();
export const thumbUrl=(id:string)=>'/api/files?id='+encodeURIComponent(id)+'&size=thumb';

async function backfill(img:HTMLImageElement,id:string){
 const w=img.naturalWidth,h=img.naturalHeight;
 if(tried.has(id)||!w||!h||Math.max(w,h)<=THUMB*1.5)return;
 tried.add(id);
 try{
  const scale=THUMB/Math.max(w,h),canvas=document.createElement('canvas');
  canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',.82));
  if(!blob||blob.type!=='image/webp')return; // Browsers without WebP encoding simply keep the original.
  await fetch('/api/files?thumb='+encodeURIComponent(id),{method:'POST',headers:{'Content-Type':'image/webp'},body:blob});
 }catch{/* A preview is a convenience; the original keeps working. */}
}

export function ThumbImage({id,className,style,alt=''}:{id:string;className?:string;style?:CSSProperties;alt?:string}){
 return <img className={className} style={style} src={thumbUrl(id)} alt={alt} loading="lazy" decoding="async" onLoad={e=>void backfill(e.currentTarget,id)}/>;
}

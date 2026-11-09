import {env} from 'cloudflare:workers';
import {database,HttpError,type Actor} from './access';
import {galleryFiles,sharedImages} from './live-participants';
import type {LegacyRecordRow} from '@/domain/legacy';

/**
 * Player gallery (4c): the images characters of this campaign shared with the group in their Charakterprofil.
 * Only shared images, only characters the group may see, files only from the character's owner.
 */
async function galleryRows(a:Actor){
 if(a.status!=='active')throw new HttpError(403,'Die Galerie steht freigegebenen Mitgliedern offen.');
 const rows=await database().prepare("SELECT r.* FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.campaign_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET' AND COALESCE(e.default_visibility,'')<>'sl_secret' AND (EXISTS (SELECT 1 FROM json_each(r.body,'$.characterMedia') m WHERE json_extract(m.value,'$.shared')=1) OR (json_extract(r.body,'$.presentation.published')=1 AND json_array_length(r.body,'$.presentation.gallery')>0)) ORDER BY r.title,r.id").bind(a.campaignId).all<LegacyRecordRow>();
 return rows.results.filter(r=>{const b=JSON.parse(r.body);return b.archived!==true&&b.recoveryOnly!==true&&b.lifecycleStatus!=='ARCHIVED';});
}

export async function campaignGallery(a:Actor){
 const characters=[];
 for(const row of await galleryRows(a)){
  const entries=sharedImages(JSON.parse(row.body));
  const files=await galleryFiles(a,row.owner_id,entries.map(e=>e.fileId));
  const images=entries.filter(e=>files.some(f=>f.id===e.fileId)).map(e=>({caption:e.caption,portrait:e.portrait,url:'/api/character-gallery?'+new URLSearchParams({characterId:row.id,fileId:e.fileId})}));
  if(images.length)characters.push({id:row.id,name:row.title,images:images.sort((x,y)=>Number(y.portrait)-Number(x.portrait))});
 }
 return {characters};
}

export async function campaignGalleryImage(a:Actor,characterId:string,fileId:string){
 const row=(await galleryRows(a)).find(r=>r.id===characterId);
 if(!row||!sharedImages(JSON.parse(row.body)).some(e=>e.fileId===fileId))throw new HttpError(404,'Bild nicht verfügbar.');
 const [file]=await galleryFiles(a,row.owner_id,[fileId]);
 const image=file&&env.BUCKET?await env.BUCKET.get(file.key):null;
 if(!image)throw new HttpError(404,'Bild nicht verfügbar.');
 return new Response(image.body,{headers:{'Content-Type':file.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}

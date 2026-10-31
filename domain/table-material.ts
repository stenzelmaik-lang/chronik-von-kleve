import {z} from 'zod';

/** Personal preparation uses existing private records, not a second document store. */
export const materialContext='table-material';
export const materialKinds=['document','handout','image','pdf','audio','video'] as const;
export const handoutPageSchema=z.object({id:z.string().uuid(),fileId:z.string().min(1).max(160),title:z.string().max(200)}).strict();
export const handoutPagesMax=20;
export const materialSchema=z.object({
 title:z.string().trim().min(1,'Bitte einen Titel eingeben.').max(200),
 kind:z.enum(materialKinds),
 text:z.string().max(50000),
 fileId:z.string().max(160),
 pages:z.array(handoutPageSchema).max(handoutPagesMax).default([]).refine(v=>new Set(v.map(p=>p.id)).size===v.length,'Seiten benötigen eindeutige IDs.'),
}).strict().superRefine((d,ctx)=>{
 if(d.pages.length&&(d.kind!=='handout'||!!d.fileId))ctx.addIssue({code:'custom',path:['pages'],message:'Ein Seitenpaket ist ein Handout; bitte keine zusätzliche Einzeldatei zuordnen.'});
 if(!['document','handout'].includes(d.kind)&&!d.fileId)ctx.addIssue({code:'custom',path:['fileId'],message:'Bitte eine passende Datei auswählen.'});
});
export type MaterialDraft=z.infer<typeof materialSchema>;
export type TableMaterial=MaterialDraft & {id:string;version:number;updatedAt:string;ownerId:string};
export const materialLabels:Record<MaterialDraft['kind'],string>={document:'Dokument zum Ausfüllen',handout:'Text / Handout',image:'Bild / Polaroid',pdf:'PDF-Unterlage',audio:'Audio',video:'Video'};
export function materialMimeMatches(kind:MaterialDraft['kind'],mime:string){
 return kind==='image'?mime.startsWith('image/'):kind==='pdf'?mime==='application/pdf':kind==='audio'?mime.startsWith('audio/'):kind==='video'?mime.startsWith('video/'):mime==='application/pdf'||mime.startsWith('image/');
}

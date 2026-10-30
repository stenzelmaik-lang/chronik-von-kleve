import {z} from 'zod';
import type {Actor,Entity} from './types';

const rectSchema=z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1),w:z.number().min(.1).max(.65),h:z.number().min(.13).max(.85)}).strict().refine(r=>r.x+r.w<=1.00001&&r.y+r.h<=1.00001,'Objekt muss auf der Bühne bleiben.');
const base={id:z.string().min(1).max(160),title:z.string().max(200),rect:rectSchema};
const note=z.object({...base,kind:z.literal('note'),visibility:z.enum(['private','group']),ownerId:z.string().min(1),ownerName:z.string().max(200),content:z.string().max(3000),revision:z.number().int().positive()}).strict();
/** How a file-backed table object is staged: photo card, cassette player, screen or paper. */
export const stageMediaKinds=['image','audio','video','pdf'] as const;
export type StageMedia=typeof stageMediaKinds[number];
export function stageMediaOf(mime:string):StageMedia|undefined{return mime.startsWith('image/')?'image':mime.startsWith('audio/')?'audio':mime.startsWith('video/')?'video':mime==='application/pdf'?'pdf':undefined;}
const object=z.object({...base,kind:z.enum(['npc','document']),visibility:z.enum(['sl','group']),sourceId:z.string().min(1).max(160),sourceKind:z.enum(['entity','file']),sourceVersion:z.number().int().positive().optional(),sourceToken:z.string().regex(/^[a-f0-9]{64}$/).optional(),media:z.enum(stageMediaKinds).optional(),recipients:z.array(z.string()).max(30).nullable()}).strict();
// The scene backdrop is the shared ground of the table for the whole round. It is
// separate from released photos and from the narration event.
const backdrop=z.object({fileId:z.string().min(1).max(160),title:z.string().max(200),sceneId:z.string().max(160)}).strict();
export const stageSchema=z.object({format:z.literal(1),version:z.number().int().nonnegative(),objects:z.array(z.union([note,object])).max(160),backdrop:backdrop.nullable().optional(),sceneId:z.string().max(160).optional()}).strict();
export type StageBackdrop=z.infer<typeof backdrop>;
export type StageState=z.infer<typeof stageSchema>;
export type StageObject=StageState['objects'][number];
export type Rect=z.infer<typeof rectSchema>;
export const emptyStage=():StageState=>({format:1,version:0,objects:[]});
export function stageVisible(o:StageObject,a:Pick<Actor,'id'|'gm'>){return a.gm||(o.kind==='note'?o.ownerId===a.id||o.visibility==='group':o.visibility==='group'&&(o.recipients===null||o.recipients.includes(a.id)));}
export function constrainRect(r:Rect):Rect{const w=Math.max(.1,Math.min(.65,r.w)),h=Math.max(.13,Math.min(.85,r.h));return {x:Math.max(0,Math.min(1-w,r.x)),y:Math.max(0,Math.min(1-h,r.y)),w,h};}
export function fitNoteRect(r:Rect,b:{w:number;h:number}){return constrainRect({...r,w:Math.max(r.w,200/Math.max(1,b.w)),h:Math.max(r.h,235/Math.max(1,b.h))});}
export const stageCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('add'),kind:z.enum(['note','npc','document']),sourceId:z.string().min(1).max(160).optional(),sourceKind:z.enum(['entity','file']).optional(),title:z.string().trim().min(1).max(200).optional(),visible:z.boolean().optional(),recipients:z.array(z.string()).max(30).nullable().optional()}).strict(),
 z.object({action:z.literal('backdrop'),fileId:z.string().min(1).max(160).nullable()}).strict(),
 z.object({action:z.literal('activateScene'),sceneId:z.string().min(1).max(160)}).strict(),
 z.object({action:z.literal('move'),id:z.string(),rect:rectSchema,expectedRevision:z.number().int().positive().optional()}).strict(),
 z.object({action:z.literal('edit'),id:z.string(),content:z.string().max(3000),expectedRevision:z.number().int().positive()}).strict(),
 z.object({action:z.literal('visibility'),id:z.string(),visibility:z.enum(['private','group']).optional(),visible:z.boolean().optional(),expectedRevision:z.number().int().positive().optional(),recipients:z.array(z.string()).max(30).nullable().optional()}).strict(),
 z.object({action:z.literal('remove'),id:z.string(),expectedRevision:z.number().int().positive().optional()}).strict(),
]);
export type StageCommand=z.infer<typeof stageCommandSchema>;
export async function stageSourceToken(e:Pick<Entity,'type'|'title'|'content'>){
 const visible=e.type==='NPC'?String(e.content.image_primary||e.content.image||''):String(e.content.text||'');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([e.type,e.title,visible])));
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
/** Initial placement per staged medium; a slight offset keeps several photos readable. */
function placement(media:StageMedia|undefined,count:number){
 // Zones: photos left, screen centre, papers right, cassette bottom centre.
 const shift=(count%4)*.035;
 if(media==='image')return {x:.04+shift,y:.08+shift,w:.17,h:.4};
 if(media==='audio')return {x:.3+shift,y:.64,w:.26,h:.27};
 if(media==='video')return {x:.27+shift,y:.08,w:.36,h:.46};
 return {x:.68+shift/2,y:.06+shift,w:.22,h:.6};
}
export function changeStageObjects(state:StageState,a:Pick<Actor,'id'|'name'|'gm'>,c:StageCommand,source?:{title:string;kind:'npc'|'document';sourceId:string;sourceKind:'entity'|'file';sourceVersion?:number;sourceToken?:string;media?:StageMedia},resolvedBackdrop?:StageBackdrop|null){
 const next=structuredClone(state);
 if(c.action==='backdrop'||c.action==='activateScene'){
  if(!a.gm)throw Object.assign(Error('Nur die Spielleitung wechselt den Schauplatz.'),{status:403});
  next.backdrop=resolvedBackdrop??null;
  if(c.action==='activateScene'){
   // A scene change clears the previous scene's table material. Player notes stay.
   next.sceneId=c.sceneId;next.objects=next.objects.filter(o=>o.kind==='note');
  }
 }else if(c.action==='add'){
  if(c.kind==='note'){
   if(next.objects.filter(o=>o.kind==='note'&&o.ownerId===a.id).length>=30)throw Object.assign(Error('Höchstens 30 eigene Notizzettel pro Sitzung.'),{status:400});
   next.objects.push({id:crypto.randomUUID(),kind:'note',title:'Notizzettel',visibility:'private',ownerId:a.id,ownerName:a.name,content:'',revision:1,rect:{x:.18,y:.18,w:.16,h:.27}});
  }else{
   if(!a.gm)throw Object.assign(Error('Nur die Spielleitung legt Originalobjekte auf.'),{status:403});
   if(!source)throw Object.assign(Error('Originalobjekt nicht verfügbar.'),{status:404});
   let placed=next.objects.find(o=>o.kind!=='note'&&o.sourceId===source.sourceId&&o.sourceKind===source.sourceKind);
   // Files may carry the prepared material title; original dossiers keep their own title.
   if(!placed){placed={id:crypto.randomUUID(),...source,...(c.title&&source.sourceKind==='file'?{title:c.title}:{}),visibility:'sl',recipients:null,rect:placement(source.media,next.objects.filter(o=>o.kind!=='note').length)};next.objects.push(placed);}
   // "Auf den Tisch legen" may release in the same step; otherwise it stays SL-only.
   if(c.visible!==undefined&&placed.kind!=='note'){placed.visibility=c.visible?'group':'sl';placed.recipients=c.recipients??null;}
  }
 }else{
  const o=next.objects.find(o=>o.id===c.id);
  if(!o)throw Object.assign(Error('Bühnenobjekt nicht verfügbar.'),{status:404});
  if(o.kind==='note'){
   if(o.ownerId!==a.id)throw Object.assign(Error('Nur die erstellende Person verändert den Zettel. SL hat Leserecht.'),{status:403});
   if(c.expectedRevision!==o.revision)throw Object.assign(Error('Notizzettel inzwischen geändert.'),{status:409});
   if(c.action==='edit')o.content=c.content;
   else if(c.action==='move')o.rect=c.rect;
   else if(c.action==='visibility'){if(!c.visibility)throw Object.assign(Error('Notizsichtbarkeit fehlt.'),{status:400});o.visibility=c.visibility;}
   else next.objects=next.objects.filter(item=>item.id!==o.id);
   o.revision++;
  }else{
   if(!a.gm)throw Object.assign(Error('Nur die Spielleitung verändert die gemeinsame Bühne.'),{status:403});
   if(c.action==='move')o.rect=c.rect;
   else if(c.action==='visibility'){if(c.visible===undefined)throw Object.assign(Error('Freigabe fehlt.'),{status:400});o.visibility=c.visible?'group':'sl';o.recipients=c.recipients??null;}
   else if(c.action==='remove')next.objects=next.objects.filter(item=>item.id!==o.id);
   else throw Object.assign(Error('Originalinhalte werden hier nicht bearbeitet.'),{status:400});
  }
 }
 next.version++;return stageSchema.parse(next);
}

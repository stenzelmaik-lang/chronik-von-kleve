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
// Second-screen direction (Regie im Zweitfenster): table-wide effects, background music and pager
// messages. All optional, so stored stages from before stay valid without a migration.
// Order is the layering order on the table (later effects lie above earlier ones). New effects are only appended.
export const stageEffects=['rain','fog','storm','snow','embers','darkness','flicker'] as const;
export type StageEffect=typeof stageEffects[number];
const music=z.object({fileId:z.string().min(1).max(160),title:z.string().max(200),key:z.string().min(1).max(64)}).strict();
/** YouTube music: only the video id is stored, never a file. Players load the official embed after their own consent. */
export const youtubeIdPattern=/^[A-Za-z0-9_-]{11}$/;
const youtube=z.object({videoId:z.string().regex(youtubeIdPattern),title:z.string().max(200),key:z.string().min(1).max(64)}).strict();
const youtubeHosts=['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtube-nocookie.com','youtube-nocookie.com'];
/** Video id from a YouTube link (watch, youtu.be, embed, shorts, live, nocookie) or a bare id; anything else is undefined. */
export function youtubeVideoId(input:string):string|undefined{
 const value=input.trim();if(youtubeIdPattern.test(value))return value;
 let url:URL;try{url=new URL(/^[a-z]+:\/\//i.test(value)?value:'https://'+value);}catch{return undefined;}
 if(!['https:','http:'].includes(url.protocol)||!youtubeHosts.includes(url.hostname.toLowerCase()))return undefined;
 const parts=url.pathname.split('/').filter(Boolean);
 const id=url.hostname.toLowerCase()==='youtu.be'?parts[0]:parts[0]==='watch'||!parts.length?url.searchParams.get('v'):['embed','shorts','live','v'].includes(parts[0])?parts[1]:undefined;
 return id&&youtubeIdPattern.test(id)?id:undefined;
}
export const pagerTextMax=280,pagerTitleMax=80,pagerSenderMax=80,pagerKeep=30;
/** Pager message contract. Regie sends spontaneously; a prepared message (e.g. from the Command Center) may bring its own id. */
export const pagerPriorities=['normal','hoch'] as const;
export const pagerOrigins=['regie','vorbereitet'] as const;
const recipientList=z.array(z.string().min(1).max(160)).min(1).max(30);
const pagerAck=z.object({id:z.string().min(1).max(160),at:z.string().max(40)}).strict();
const pager=z.object({id:z.string().min(1).max(160),text:z.string().min(1).max(pagerTextMax),at:z.string().max(40),recipients:recipientList.nullable(),
 // Optional since the first version of the field: in-world sender, title, priority, origin and server-side acknowledgements.
 title:z.string().max(pagerTitleMax).optional(),sender:z.string().max(pagerSenderMax).optional(),priority:z.enum(pagerPriorities).optional(),origin:z.enum(pagerOrigins).optional(),acks:z.array(pagerAck).max(30).optional()}).strict();
export const stageSchema=z.object({format:z.literal(1),version:z.number().int().nonnegative(),objects:z.array(z.union([note,object])).max(160),backdrop:backdrop.nullable().optional(),sceneId:z.string().max(160).optional(),effects:z.array(z.enum(stageEffects)).max(stageEffects.length).optional(),music:music.nullable().optional(),pagers:z.array(pager).max(pagerKeep).optional(),youtube:youtube.nullable().optional()}).strict();
export type StageYoutube=z.infer<typeof youtube>;
export type StageMusic=z.infer<typeof music>;
export type StagePager=z.infer<typeof pager>;
/** A pager message reaches the whole round (null) or exactly the listed players; the GM sees every message. */
export function pagerVisible(p:StagePager,a:Pick<Actor,'id'|'gm'>){return a.gm||p.recipients===null||p.recipients.includes(a.id);}
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
 z.object({action:z.literal('effects'),effects:z.array(z.enum(stageEffects)).max(stageEffects.length)}).strict(),
 z.object({action:z.literal('music'),fileId:z.string().min(1).max(160).nullable()}).strict(),
 // A link or id starts YouTube music for the round (null stops it). The server keeps the id only.
 z.object({action:z.literal('youtube'),video:z.string().trim().min(1).max(300).nullable(),title:z.string().trim().max(200).optional()}).strict(),
 z.object({action:z.literal('pager'),id:z.string().uuid().optional(),text:z.string().trim().min(1).max(pagerTextMax),title:z.string().trim().max(pagerTitleMax).optional(),sender:z.string().trim().max(pagerSenderMax).optional(),priority:z.enum(pagerPriorities).optional(),origin:z.enum(pagerOrigins).optional(),recipients:recipientList.nullable()}).strict(),
 z.object({action:z.literal('pagerAck'),id:z.string().min(1).max(160)}).strict(),
 z.object({action:z.literal('pagerWithdraw'),id:z.string().min(1).max(160)}).strict(),
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
export function changeStageObjects(state:StageState,a:Pick<Actor,'id'|'name'|'gm'>,c:StageCommand,source?:{title:string;kind:'npc'|'document';sourceId:string;sourceKind:'entity'|'file';sourceVersion?:number;sourceToken?:string;media?:StageMedia},resolvedBackdrop?:StageBackdrop|null,resolvedMusic?:StageMusic|null,now=new Date().toISOString()){
 const next=structuredClone(state);
 if(c.action==='pagerAck'){
  // Acknowledgement: only a recipient confirms, once; the GM reads who has confirmed.
  const p=next.pagers?.find(p=>p.id===c.id);
  if(!p||a.gm||!pagerVisible(p,a))throw Object.assign(Error('Pager-Nachricht nicht verfügbar.'),{status:404});
  if(p.acks?.some(x=>x.id===a.id))return state;
  p.acks=[...p.acks||[],{id:a.id,at:now}];
 }else if(c.action==='effects'||c.action==='music'||c.action==='youtube'||c.action==='pager'||c.action==='pagerWithdraw'){
  if(!a.gm)throw Object.assign(Error('Nur die Spielleitung steuert Effekte, Musik und Pager.'),{status:403});
  if(c.action==='effects')next.effects=stageEffects.filter(e=>c.effects.includes(e));
  else if(c.action==='music'){if(c.fileId&&!resolvedMusic)throw Object.assign(Error('Musik nicht verfügbar.'),{status:404});next.music=c.fileId?resolvedMusic:null;}
  else if(c.action==='youtube'){
   if(c.video===null)next.youtube=null;
   else{const videoId=youtubeVideoId(c.video);if(!videoId)throw Object.assign(Error('Kein gültiger YouTube-Link.'),{status:400});
    // A fresh key per start lets everyone restart the track, even when the same video is chosen again.
    next.youtube={videoId,title:(c.title||'').trim()||'YouTube-Musik',key:crypto.randomUUID().replaceAll('-','').slice(0,16)};}
  }
  else if(c.action==='pager'){
   // A prepared message is played with its own (element) id, so the same message is never sent twice.
   if(c.origin==='vorbereitet'&&!c.id)throw Object.assign(Error('Vorbereitete Pager-Nachrichten brauchen ihre ID.'),{status:400});
   if(c.id&&next.pagers?.some(p=>p.id===c.id))throw Object.assign(Error('Diese Pager-Nachricht wurde bereits gesendet.'),{status:409});
   next.pagers=[...next.pagers||[],{id:c.id||crypto.randomUUID(),text:c.text,at:now,recipients:c.recipients?[...new Set(c.recipients)]:null,...(c.title?{title:c.title}:{}),...(c.sender?{sender:c.sender}:{}),...(c.priority&&c.priority!=='normal'?{priority:c.priority}:{}),origin:c.origin||'regie'}].slice(-pagerKeep);
  }
  else{if(!next.pagers?.some(p=>p.id===c.id))throw Object.assign(Error('Pager-Nachricht nicht verfügbar.'),{status:404});next.pagers=next.pagers.filter(p=>p.id!==c.id);}
 }else if(c.action==='backdrop'||c.action==='activateScene'){
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

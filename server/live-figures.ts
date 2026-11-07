import {database,gmOnly,HttpError,type Actor} from './access';
import {readSetting,mutateSetting} from './settings-store';
import {listFigureTemplates} from './figure-templates';
import {resolveFigureTemplate} from '@/domain/figure-templates';
import {readLiveRoom} from './live-game';
import {resolveFigure,typeById,tierById,nextLabel,MAX_LIVE_FIGURES,MAX_SPAWN,STANDARD_FIGURES_VERSION,type LiveFigure,type FigureStatePatch,type TierId} from '@/domain/standard-figures';

/**
 * Standard figures of one evening live in the existing `settings` table (no migration, not reachable through the records API).
 * Everything is GM only: players never receive values, notes or images of a figure from here.
 */
type State={rev:number;figures:LiveFigure[];requests:string[]};
export type AssetLink={id:string;typeId:string;tierId:TierId|null;fileId:string;label:string;role:'fullbody'|'portrait'|'token'|'scene'};
const figuresKey=(campaignId:string,sessionId:string)=>`live-figures:${campaignId}:${sessionId}`;
const assetsKey=(campaignId:string)=>`standard-figure-assets:${campaignId}`;
const empty=():State=>({rev:0,figures:[],requests:[]});

const readRaw=readSetting;
const mutate=<T>(key:string,parse:(raw:string|null)=>T,apply:(state:T)=>T)=>mutateSetting(key,parse,apply,'Die Figuren wurden gleichzeitig geändert. Bitte erneut versuchen.');
const parseState=(raw:string|null):State=>{try{const s=raw?JSON.parse(raw):null;return s&&Array.isArray(s.figures)?{rev:Number(s.rev)||0,figures:s.figures,requests:Array.isArray(s.requests)?s.requests:[]}:empty();}catch{return empty();}};
const parseAssets=(raw:string|null):AssetLink[]=>{try{const s=raw?JSON.parse(raw):[];return Array.isArray(s)?s:[];}catch{return [];}};

async function gate(a:Actor,sessionId:string){gmOnly(a);await readLiveRoom(a,sessionId);}

export async function listFigures(a:Actor,sessionId:string){
 await gate(a,sessionId);
 const [raw,assets]=await Promise.all([readRaw(figuresKey(a.campaignId,sessionId)),readRaw(assetsKey(a.campaignId))]);
 return {figures:parseState(raw).figures,assets:parseAssets(assets),version:STANDARD_FIGURES_VERSION};
}

export type FigureCommand=
 |{action:'spawn';sessionId:string;requestId:string;typeId:string;tierId:string;count:number;imageFileId?:string;templateId?:string}
 |{action:'update';sessionId:string;id:string;patch:FigureStatePatch}
 |{action:'retire';sessionId:string;id:string}
 |{action:'linkAsset';sessionId:string;typeId:string;tierId:string|null;fileId:string;label:string;role:AssetLink['role']}
 |{action:'unlinkAsset';sessionId:string;assetId:string};

async function imageOwned(a:Actor,fileId:string){
 if(!fileId)return;
 const f=await database().prepare('SELECT mime FROM files WHERE id=? AND campaign_id=?').bind(fileId,a.campaignId).first<{mime:string}>();
 if(!f||!f.mime.startsWith('image/'))throw new HttpError(400,'Bild nicht verfügbar oder keine Bilddatei.');
}

export async function changeFigures(a:Actor,c:FigureCommand){
 await gate(a,c.sessionId);
 const key=figuresKey(a.campaignId,c.sessionId);
 if(c.action==='spawn'){
  const type=typeById(c.typeId),tier=tierById(c.tierId);
  if(!type||!tier)throw new HttpError(400,'Unbekannte Figur oder Stufe.');
  if(!Number.isInteger(c.count)||c.count<1||c.count>MAX_SPAWN)throw new HttpError(400,`Anzahl 1 bis ${MAX_SPAWN}.`);
  await imageOwned(a,c.imageFileId||'');
  const template=c.templateId?(await listFigureTemplates(a)).find(item=>item.id===c.templateId):null;
  if(c.templateId&&!template)throw new HttpError(404,'Die gewählte Figurenvorlage ist nicht verfügbar.');
  if(template&&(template.typeId!==c.typeId||template.tierId!==c.tierId))throw new HttpError(400,'Vorlage und Basisfigur stimmen nicht überein.');
  const stats=template?resolveFigureTemplate(template):resolveFigure(c.typeId,c.tierId)!,stamp=new Date().toISOString();
  const state=await mutate(key,parseState,s=>{
   if(s.requests.includes(c.requestId))return s; // double click or retry: already created
   if(s.figures.length+c.count>MAX_LIVE_FIGURES)throw new HttpError(409,`Höchstens ${MAX_LIVE_FIGURES} Figuren gleichzeitig.`);
   const added:LiveFigure[]=[];
   for(let i=0;i<c.count;i++)added.push({id:crypto.randomUUID(),typeId:type.id,tierId:tier.id,label:nextLabel(template?.name||type.name,[...s.figures,...added]),stats,hurt:0,willpower:stats.willpower,blood:stats.bloodMax,note:'',imageFileId:c.imageFileId||'',createdAt:stamp});
   return {rev:s.rev+1,figures:[...s.figures,...added],requests:[...s.requests,c.requestId].slice(-30)};
  });
  return {figures:state.figures};
 }
 if(c.action==='update'){
  const p=c.patch;
  if(p.imageFileId!==undefined)await imageOwned(a,p.imageFileId);
  const state=await mutate(key,parseState,s=>{
   const f=s.figures.find(x=>x.id===c.id);if(!f)throw new HttpError(404,'Figur nicht gefunden.');
   const next={...f};
   if(p.label!==undefined)next.label=String(p.label).trim().slice(0,60)||f.label;
   if(p.hurt!==undefined){if(!Number.isInteger(p.hurt)||p.hurt<0||p.hurt>7)throw new HttpError(400,'Gesundheit 0 bis 7.');next.hurt=p.hurt;}
   if(p.willpower!==undefined){if(!Number.isInteger(p.willpower)||p.willpower<0||p.willpower>10)throw new HttpError(400,'Willenskraft 0 bis 10.');next.willpower=p.willpower;}
   if(p.blood!==undefined){if(f.stats.bloodMax===null)throw new HttpError(400,'Diese Figur hat keinen Blutvorrat.');const blood=p.blood;if(blood===null||!Number.isInteger(blood)||blood<0||blood>f.stats.bloodMax)throw new HttpError(400,'Blutvorrat außerhalb des Bereichs.');next.blood=blood;}
   if(p.note!==undefined)next.note=String(p.note).slice(0,2000);
   if(p.imageFileId!==undefined)next.imageFileId=p.imageFileId;
   return {...s,rev:s.rev+1,figures:s.figures.map(x=>x.id===c.id?next:x)};
  });
  return {figures:state.figures};
 }
 if(c.action==='retire'){
  const state=await mutate(key,parseState,s=>({...s,rev:s.rev+1,figures:s.figures.filter(x=>x.id!==c.id)}));
  return {figures:state.figures};
 }
 // Asset links only reference files that already exist in the gallery; unlinking never deletes the file.
 const ak=assetsKey(a.campaignId);
 if(c.action==='linkAsset'){
  if(!typeById(c.typeId)||(c.tierId!==null&&!tierById(c.tierId)))throw new HttpError(400,'Unbekannte Figur oder Stufe.');
  await imageOwned(a,c.fileId);
  const label=c.label.trim().slice(0,80)||'Bild';
  const next=await mutate(ak,parseAssets,list=>{
   if(list.length>=300)throw new HttpError(409,'Zu viele Bildverknüpfungen.');
   if(list.some(x=>x.typeId===c.typeId&&x.fileId===c.fileId&&x.tierId===c.tierId))return list;
   return [...list,{id:crypto.randomUUID(),typeId:c.typeId,tierId:c.tierId as TierId|null,fileId:c.fileId,label,role:c.role}];
  });
  return {assets:next};
 }
 const next=await mutate(ak,parseAssets,list=>list.filter(x=>x.id!==c.assetId));
 return {assets:next};
}

/** One live figure for the table (GM only); used to put it on the stage like an NPC. */
export async function readFigure(a:Actor,sessionId:string,figureId:string){
 await gate(a,sessionId);
 const figure=parseState(await readRaw(figuresKey(a.campaignId,sessionId))).figures.find(f=>f.id===figureId);
 if(!figure)throw new HttpError(404,'Figur nicht gefunden.');
 return figure;
}

import {database,canRead,HttpError,type Actor} from './access';
import {liveFile} from './live-game';
import {displayAssetStates} from './display-assets';
import {richTextToPlainText} from '@/domain/location-rich-text';
import {effectiveEffect,effectProblem,materialTypeInfo,type SceneMaterial} from '@/domain/material-system';
import type {SceneElement,SceneView} from '@/domain/story-scene';
import type {StageMaterial,StageMedia} from '@/domain/live-stage';

const textTypes:SceneMaterial['type'][]=['letter','dossier','other'];
type FileRow={id:string;name:string;mime:string;owner_id:string;visibility:string};
async function readableFiles(a:Actor,ids:string[]){
 const unique=[...new Set(ids.filter(Boolean))];if(!unique.length)return [] as FileRow[];
 const rows=await database().prepare(`SELECT id,name,mime,owner_id,visibility FROM files WHERE campaign_id=? AND id IN (${unique.map(()=>'?').join(',')})`).bind(a.campaignId,...unique).all<FileRow>();
 return rows.results.filter(f=>canRead(a,f));
}

/**
 * Builds the table object for one prepared material: all files in their order as pages (or the single file), the
 * display asset states copied as file ids, and the effective opening effect. The GM note and, except for letters
 * and dossiers, the element text (the GM's cue) are never copied, so they cannot reach a player snapshot.
 */
export async function materialStageSource(a:Actor,scene:SceneView,element:SceneElement,sourceId:string){
 const m=element.material!;
 if(m.type==='pager')throw new HttpError(400,'Pager-Nachrichten spielst du im Pager-Bereich der Regie aus.');
 if(m.type==='backdrop')throw new HttpError(400,'Einen Szenenhintergrund zeigst du mit „Als Hintergrund zeigen“.');
 const rows=await readableFiles(a,m.files.map(f=>f.fileId));
 const files=m.files.flatMap((f,i)=>{const row=rows.find(r=>r.id===f.fileId);return row?[{id:f.id,fileId:row.id,title:(f.title||materialTypeInfo[m.type].label+' '+(i+1)).slice(0,200),mime:row.mime}]:[];});
 const text=textTypes.includes(m.type)&&richTextToPlainText(element.text).trim()?element.text:undefined;
 if(!files.length&&!text)throw new HttpError(400,'„'+element.title+'“ hat noch keine verfügbare Datei.');
 const asset=await displayAssetStates(a,m.assetId);
 const stateRows=asset?await readableFiles(a,asset.states.map(s=>s.fileId)):[];
 const states=(asset?.states||[]).filter(s=>stateRows.some(r=>r.id===s.fileId&&r.mime.startsWith('image/'))).map(s=>({key:s.key,fileId:s.fileId}));
 let soundFileId:string|undefined;
 if(m.effect.soundFileId){try{const f=await liveFile(a,m.effect.soundFileId);if(f.mime.startsWith('audio/'))soundFileId=f.id;}catch{/* a missing sound is simply left out */}}
 const open=effectiveEffect(m.effect.open,{states:states.map(s=>s.key),files:files.length});
 const material:StageMaterial={type:m.type,display:m.display,effect:{open,close:m.effect.close,speed:m.effect.speed,afterClose:m.effect.afterClose,sound:!!soundFileId},states,...(soundFileId?{soundFileId}:{}),...(open!==m.effect.open?{requested:m.effect.open}:{})};
 const base={title:element.title,kind:'document' as const,sourceId,sourceKind:'record' as const,sourceVersion:scene.version,ownerId:a.id,material,...(text?{documentContent:text}:{})};
 const single=files.length===1?files[0]:undefined;
 // Audio and video use the existing players with their single file; images and pages use the page reader.
 if(single&&(m.type==='audio'||m.type==='video'||single.mime==='application/pdf'||m.type==='image'))
  return {...base,sourceFileId:single.fileId,media:(single.mime.startsWith('image/')?'image':single.mime.startsWith('audio/')?'audio':single.mime.startsWith('video/')?'video':'pdf') as StageMedia};
 if(files.length)return {...base,media:'pages' as const,pages:files.map(f=>({id:f.id,fileId:f.fileId,title:f.title}))};
 return base;
}

/** The private Regie list of a scene's materials (pager messages have their own block). GM only. */
export async function regieMaterials(a:Actor,scene:SceneView){
 const elements=scene.document.elements.filter(e=>e.material&&e.material.type!=='pager');
 const rows=await readableFiles(a,elements.flatMap(e=>[...e.material!.files.map(f=>f.fileId),e.material!.effect.soundFileId]));
 const out=[];
 for(const e of elements){
  const m=e.material!,asset=await displayAssetStates(a,m.assetId);
  const files=m.files.map((f,i)=>{const row=rows.find(r=>r.id===f.fileId);return {id:f.id,fileId:row?f.fileId:'',title:f.title||materialTypeInfo[m.type].label+' '+(i+1),mime:row?.mime||'',missing:!row};});
  const states=asset?.states.map(s=>({key:s.key,label:s.label,fileId:s.fileId}))||[];
  const context={states:states.map(s=>s.key),files:files.filter(f=>!f.missing).length};
  out.push({id:'scene-material:'+scene.id+':'+e.id,elementId:e.id,title:e.title,type:m.type,display:m.display,effect:m.effect,effective:effectiveEffect(m.effect.open,context),problem:effectProblem(m.effect.open,context),
   files,asset:asset?{title:asset.title,states}:null,assetMissing:!!m.assetId&&!asset,sound:!!m.effect.soundFileId&&rows.some(r=>r.id===m.effect.soundFileId),
   caption:textTypes.includes(m.type)?e.text:'',cue:textTypes.includes(m.type)?'':e.text,note:m.note});
 }
 return out;
}

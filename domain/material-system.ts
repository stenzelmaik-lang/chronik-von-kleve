import {z} from 'zod';

/**
 * Universal game material (Spielmaterial 3.0). A material is an existing scene element with an optional
 * `material` block: its kind of material, an ordered list of file references, a display asset, how it is shown
 * and how it opens. No second media store: files stay in /api/files, scene materials stay in the scene document.
 * Older elements without the block keep working; `materialOf` derives the same view for them.
 */
export const materialTypes=['image','letter','dossier','audio','video','pager','backdrop','other'] as const;
export type MaterialType=typeof materialTypes[number];
/** Scene element kind each material type is stored as, so older builds and lists still understand the element. */
export const materialElementKind={image:'image',letter:'handout',dossier:'handout',audio:'audio',video:'video',pager:'pager',backdrop:'image',other:'object'} as const satisfies Record<MaterialType,string>;
export type MaterialAccept='image'|'audio'|'video'|'document'|'none';

/** Opening effects. `needs` names asset states the effect animates; without them the fallback is offered. */
export const materialEffectIds=['instant','fade','unfold','open-book','unseal','slide-out','fan','page-turn','lay-out'] as const;
export type MaterialEffectId=typeof materialEffectIds[number];
export const materialCloseEffects=['instant','fade','close'] as const;
export type MaterialCloseEffect=typeof materialCloseEffects[number];
export const materialSpeeds=['slow','normal','fast'] as const;
export const materialDisplays=['single','stack','book','spread','grid'] as const;
export type MaterialDisplay=typeof materialDisplays[number];
export const materialAfterClose=['closed','open'] as const;

export const materialEffects:Record<MaterialEffectId,{label:string;hint:string;needs:('closed'|'open')[];minFiles:number;fallback:MaterialEffectId}>={
 instant:{label:'Sofort',hint:'Ohne Animation – der Inhalt ist direkt da.',needs:[],minFiles:0,fallback:'instant'},
 fade:{label:'Einblenden',hint:'Der Inhalt blendet weich ein. Funktioniert immer.',needs:[],minFiles:0,fallback:'instant'},
 unfold:{label:'Aufklappen',hint:'Die Darstellung klappt vom geschlossenen in den geöffneten Zustand.',needs:['closed','open'],minFiles:0,fallback:'fade'},
 'open-book':{label:'Aufschlagen',hint:'Der Deckel schlägt wie bei einem Buch oder einer Mappe auf.',needs:['closed'],minFiles:0,fallback:'fade'},
 unseal:{label:'Entsiegeln',hint:'Das Siegel bricht, danach erscheint der geöffnete Zustand.',needs:['closed','open'],minFiles:0,fallback:'fade'},
 'slide-out':{label:'Herausgleiten',hint:'Der Inhalt gleitet aus dem Umschlag oder der Hülle.',needs:['closed'],minFiles:0,fallback:'fade'},
 fan:{label:'Auffächern',hint:'Mehrere Inhalte fächern sich wie ein Kartenstapel auf.',needs:[],minFiles:2,fallback:'fade'},
 'page-turn':{label:'Umblättern',hint:'Seiten werden wie in einem Buch umgeblättert.',needs:[],minFiles:2,fallback:'fade'},
 'lay-out':{label:'Auslegen',hint:'Alle Inhalte werden nacheinander auf den Tisch gelegt.',needs:[],minFiles:2,fallback:'fade'},
};
export const materialCloseLabels:Record<MaterialCloseEffect,string>={instant:'Sofort schließen',fade:'Ausblenden',close:'Schließeffekt (zurück in die Darstellung)'};
export const materialSpeedLabels:Record<typeof materialSpeeds[number],string>={slow:'Langsam',normal:'Normal',fast:'Schnell'};
export const materialSpeedFactor:Record<typeof materialSpeeds[number],number>={slow:1.7,normal:1,fast:.55};
export const materialDisplayLabels:Record<MaterialDisplay,string>={single:'Einzelansicht',stack:'Stapel zum Durchblättern',book:'Mappe / Buch (Einzelseite)',spread:'Doppelseite',grid:'Ausgelegt nebeneinander'};
export const materialAfterCloseLabels:Record<typeof materialAfterClose[number],string>={closed:'Wieder geschlossen darstellen',open:'Geöffnet liegen lassen'};

export const materialTypeInfo:Record<MaterialType,{label:string;hint:string;accept:MaterialAccept;multiple:boolean;assetKinds:DisplayAssetKind[];effects:MaterialEffectId[];displays:MaterialDisplay[];defaultEffect:MaterialEffectId;defaultDisplay:MaterialDisplay;assetRole:string}>={
 image:{label:'Bild / Polaroid',hint:'Ein Foto oder mehrere Bilder als Stapel. Optional mit eigenem Rahmen.',accept:'image',multiple:true,assetKinds:['frame','envelope'],effects:['instant','fade','slide-out','fan','lay-out','unfold'],displays:['single','stack','grid'],defaultEffect:'fade',defaultDisplay:'single',assetRole:'Rahmen'},
 letter:{label:'Brief / Handout',hint:'Ein Brief, Zettel oder eine Unterlage – Text, Bild- oder PDF-Seiten.',accept:'document',multiple:true,assetKinds:['envelope','folder'],effects:['instant','fade','unseal','unfold','slide-out','page-turn'],displays:['single','book','spread'],defaultEffect:'fade',defaultDisplay:'single',assetRole:'Umschlag'},
 dossier:{label:'Akte / Paket',hint:'Mehrere Seiten oder Fotos in fester Reihenfolge, z. B. eine Geheimakte oder ein Paket.',accept:'image',multiple:true,assetKinds:['folder','envelope','book'],effects:['instant','fade','open-book','unseal','unfold','slide-out','fan','page-turn','lay-out'],displays:['book','spread','stack','grid','single'],defaultEffect:'fade',defaultDisplay:'book',assetRole:'Umschlag / Mappe'},
 audio:{label:'Audio',hint:'Eine Tonaufnahme im vorhandenen Player. Jede Person regelt ihre Lautstärke selbst.',accept:'audio',multiple:false,assetKinds:['device'],effects:['instant','fade','unfold','slide-out'],displays:['single'],defaultEffect:'fade',defaultDisplay:'single',assetRole:'Abspielgerät'},
 video:{label:'Video',hint:'Ein Video im vorhandenen Player, optional mit eigenem Bildschirmrahmen.',accept:'video',multiple:false,assetKinds:['screen'],effects:['instant','fade','unfold'],displays:['single'],defaultEffect:'fade',defaultDisplay:'single',assetRole:'Bildschirmrahmen'},
 pager:{label:'Pager-Nachricht',hint:'Eine Nachricht für den ULTIO-Pager. Zustellung, Quittung und Empfänger bleiben wie gewohnt.',accept:'none',multiple:false,assetKinds:[],effects:['instant'],displays:['single'],defaultEffect:'instant',defaultDisplay:'single',assetRole:''},
 backdrop:{label:'Szenenhintergrund',hint:'Ein Hintergrundbild als eigene Bühnenebene. Wetter und Licht bleiben erhalten.',accept:'image',multiple:false,assetKinds:['backdrop'],effects:['instant','fade'],displays:['single'],defaultEffect:'fade',defaultDisplay:'single',assetRole:'Hintergrund aus der Asset-Galerie'},
 other:{label:'Sonstiges',hint:'Ein Gegenstand oder Material, das in keine andere Art passt.',accept:'document',multiple:true,assetKinds:['other','envelope','folder','frame'],effects:['instant','fade','unfold','slide-out','lay-out'],displays:['single','stack','grid'],defaultEffect:'fade',defaultDisplay:'single',assetRole:'Darstellung'},
};

/** Display assets of the GM: one stored file per state, reusable by any number of materials. */
export const displayAssetContext='display-asset';
export const displayAssetKinds=['envelope','folder','book','frame','device','screen','backdrop','other'] as const;
export type DisplayAssetKind=typeof displayAssetKinds[number];
export const displayAssetKindLabels:Record<DisplayAssetKind,string>={envelope:'Umschlag',folder:'Mappe / Akte',book:'Buch',frame:'Bilderrahmen',device:'Abspielgerät',screen:'Bildschirmrahmen',backdrop:'Szenenhintergrund',other:'Sonstiges'};
export const displayAssetStateMax=8;
export const displayAssetStateLabels:Record<string,string>={closed:'Geschlossen',open:'Geöffnet'};
const stateKey=z.string().regex(/^[a-z0-9-]{1,30}$/,'Ungültiger Zustand.');
export const displayAssetStateSchema=z.object({key:stateKey,label:z.string().trim().max(60),fileId:z.string().min(1).max(160)}).strict();
export const displayAssetSchema=z.object({
 title:z.string().trim().min(1,'Bitte einen Namen eingeben.').max(120),
 kind:z.enum(displayAssetKinds),
 states:z.array(displayAssetStateSchema).min(1).max(displayAssetStateMax)
  .refine(v=>new Set(v.map(s=>s.key)).size===v.length,'Jeder Zustand darf nur einmal vorkommen.')
  .refine(v=>v.some(s=>s.key==='closed'),'Der Zustand „Geschlossen“ ist Pflicht.'),
 tags:z.array(z.string().trim().min(1).max(40)).max(10).default([]),
}).strict();
export type DisplayAssetDraft=z.infer<typeof displayAssetSchema>;
export type DisplayAsset=DisplayAssetDraft&{id:string;version:number;updatedAt:string;ownerId:string};
export const emptyDisplayAsset=(kind:DisplayAssetKind='envelope'):DisplayAssetDraft=>({title:'',kind,states:[],tags:[]});

export const materialFilesMax=20;
const materialFileSchema=z.object({id:z.string().uuid(),fileId:z.string().max(160),title:z.string().trim().max(200)}).strict();
export const materialEffectSchema=z.object({
 open:z.enum(materialEffectIds).default('fade'),close:z.enum(materialCloseEffects).default('fade'),speed:z.enum(materialSpeeds).default('normal'),
 soundFileId:z.string().max(160).default(''),afterClose:z.enum(materialAfterClose).default('closed'),
}).strict();
export type MaterialEffect=z.infer<typeof materialEffectSchema>;
/** Optional block on a scene element. `files` is the ordered media list; the element's own fileId mirrors the first file. */
export const sceneMaterialSchema=z.object({
 type:z.enum(materialTypes),
 files:z.array(materialFileSchema).max(materialFilesMax).default([]).refine(v=>new Set(v.map(f=>f.id)).size===v.length,'Dateieinträge brauchen eindeutige IDs.'),
 assetId:z.string().max(100).default(''),
 display:z.enum(materialDisplays).default('single'),
 effect:materialEffectSchema.default({open:'fade',close:'fade',speed:'normal',soundFileId:'',afterClose:'closed'}),
 note:z.string().max(3000).default(''),
}).strict();
export type SceneMaterial=z.infer<typeof sceneMaterialSchema>;
export type MaterialFile=SceneMaterial['files'][number];

type ElementLike={kind:string;title:string;text:string;fileId:string;referenceId?:string;material?:SceneMaterial};
/** Material types the overview shows; other scene building blocks (checks, clues, dialogues …) keep their own editor. */
export function isMaterialElement(e:Pick<ElementLike,'kind'|'material'>){return !!e.material||['image','handout','audio','video','pager'].includes(e.kind);}
export function materialTypeOf(e:Pick<ElementLike,'kind'|'material'>):MaterialType{
 if(e.material)return e.material.type;
 return e.kind==='image'?'image':e.kind==='handout'?'letter':e.kind==='audio'?'audio':e.kind==='video'?'video':e.kind==='pager'?'pager':'other';
}
export function defaultMaterial(type:MaterialType):SceneMaterial{
 const info=materialTypeInfo[type];
 return {type,files:[],assetId:'',display:info.defaultDisplay,effect:{open:info.defaultEffect,close:info.defaultEffect==='instant'?'instant':'fade',speed:'normal',soundFileId:'',afterClose:'closed'},note:''};
}
/** The material view of any element: older single-file elements become a material with one file. */
export function materialOf(e:ElementLike):SceneMaterial{
 if(e.material)return e.material;
 const m=defaultMaterial(materialTypeOf(e));
 return {...m,files:e.fileId?[{id:legacyFileEntryId(e.fileId),fileId:e.fileId,title:''}]:[]};
}
/** Stable id for the implicit file entry of an older element, so editing does not reorder anything. */
export function legacyFileEntryId(fileId:string){let h=0x811c9dc5;for(const c of fileId){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193);}const hex=(h>>>0).toString(16).padStart(8,'0');return hex+'-0000-4000-8000-'+hex.padEnd(12,'0').slice(0,12);}
/** Writes a material into an element and keeps the element's legacy fields readable for older builds. */
export function withMaterial<T extends ElementLike>(e:T,material:SceneMaterial):T{
 return {...e,kind:materialElementKind[material.type],material,fileId:material.type==='pager'?'':material.files.find(f=>f.fileId)?.fileId||''};
}
export function mimeFits(accept:MaterialAccept,mime:string){
 return accept==='image'?mime.startsWith('image/'):accept==='audio'?mime.startsWith('audio/'):accept==='video'?mime.startsWith('video/'):accept==='document'?mime.startsWith('image/')||mime==='application/pdf':false;
}

/** Whether an effect can run with the chosen asset and files; otherwise which simpler effect is used instead. */
export function effectSupport(effect:MaterialEffectId,context:{states:string[];files:number}){
 const info=materialEffects[effect];
 const missing=info.needs.filter(s=>!context.states.includes(s));
 const tooFew=context.files<info.minFiles;
 return {ok:!missing.length&&!tooFew,missing,tooFew,fallback:info.fallback};
}
export function effectiveEffect(effect:MaterialEffectId,context:{states:string[];files:number}):MaterialEffectId{
 let current=effect;
 for(let i=0;i<4;i++){const s=effectSupport(current,context);if(s.ok)return current;current=s.fallback;}
 return 'instant';
}
export function effectProblem(effect:MaterialEffectId,context:{states:string[];files:number}){
 const s=effectSupport(effect,context);if(s.ok)return '';
 const names=s.missing.map(k=>displayAssetStateLabels[k]||k).join(' und ');
 return (s.missing.length?'„'+materialEffects[effect].label+'“ braucht eine Darstellung mit dem Zustand '+names+'.':'„'+materialEffects[effect].label+'“ braucht mindestens '+materialEffects[effect].minFiles+' Inhalte.')+' Stattdessen läuft „'+materialEffects[effectiveEffect(effect,context)].label+'“.';
}

/** Plain summary for cards and the Regie; never contains ids. */
export function materialSummary(m:Pick<SceneMaterial,'type'|'display'|'effect'>,files:number){
 const info=materialTypeInfo[m.type];
 return [info.label,files===1?'1 Datei':files+' Dateien',m.type==='pager'?'':materialDisplayLabels[m.display],m.type==='pager'?'':materialEffects[m.effect.open].label].filter(Boolean).join(' · ');
}

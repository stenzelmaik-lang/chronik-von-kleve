// Abenteuerjournal (Alpha 2.0, AJ-01): pure rules for the player's book at the live table.
// Notes and chronicle entries are ordinary character notes (records kind 'notizen'); two optional body
// fields mark the chronicle: journalKind and playDate. Notes without them stay plain notes ("Meine Notizen").
import {richTextToPlainText} from './location-rich-text.ts';

export const JOURNAL_KINDS=['note','chronicle'] as const;
export type JournalKind=typeof JOURNAL_KINDS[number];
/** Older notes carry no marker and are notes. Unknown values are treated the same way. */
export function journalKindOf(body:Record<string,unknown>):JournalKind{return body.journalKind==='chronicle'?'chronicle':'note';}

/**
 * The in-game date of a chronicle entry. It is the player's own date of the story, independent of creation
 * and change time. Stored as an ISO calendar date (YYYY-MM-DD) so that entries sort; years 1–9999.
 */
export const PLAY_DATE=/^(\d{4})-(\d{2})-(\d{2})$/;
export function validPlayDate(value:unknown):value is string{
 if(typeof value!=='string')return false;
 const m=value.match(PLAY_DATE);if(!m)return false;
 const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
 if(y<1||mo<1||mo>12||d<1)return false;
 const days=[31,(y%4===0&&y%100!==0)||y%400===0?29:28,31,30,31,30,31,31,30,31,30,31][mo-1];
 return d<=days;
}
const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
/** "14. März 1998"; an invalid value is shown as given so nothing silently disappears. */
export function formatPlayDate(value:string|null|undefined){
 if(!value)return 'Ohne Spieldatum';
 if(!validPlayDate(value))return value;
 const [y,m,d]=value.split('-').map(Number);
 return d+'. '+months[m-1]+' '+y;
}

export type JournalEntry={id:string;title:string;text:string;visibility:string;version:number;createdAt:string;updatedAt:string;canEdit:boolean;journalKind?:JournalKind;playDate?:string|null};

/** Only the owner's private entries belong into the book. Shared notes stay in the character management. */
export function bookEntries<T extends JournalEntry>(notes:readonly T[]){return notes.filter(n=>n.canEdit&&n.visibility==='private');}
/** "Meine Notizen": newest change first. */
export function noteEntries<T extends JournalEntry>(notes:readonly T[]){return bookEntries(notes).filter(n=>(n.journalKind??'note')==='note').sort((x,y)=>y.updatedAt.localeCompare(x.updatedAt));}
/** "Chronik": story order by play date, then creation. Entries without a valid date come last. */
export function chronicleEntries<T extends JournalEntry>(notes:readonly T[]){
 return bookEntries(notes).filter(n=>n.journalKind==='chronicle').sort((x,y)=>{
  const a=validPlayDate(x.playDate)?x.playDate!:'~',b=validPlayDate(y.playDate)?y.playDate!:'~';
  return a===b?(x.createdAt<y.createdAt?-1:x.createdAt>y.createdAt?1:0):a<b?-1:1;
 });
}

/**
 * A draft always belongs to the character it was started for. Saving uses this id, never the currently active
 * character, so a figure change can never move the text to another character.
 */
export type JournalDraft={characterId:string;characterName:string;kind:JournalKind;noteId?:string;version?:number;title:string;text:string;playDate:string;base?:{title:string;text:string;playDate:string}};
export function draftDirty(d:JournalDraft|null|undefined){
 if(!d)return false;
 if(!d.base)return !!(d.title.trim()||plainText(d.text).trim());
 return d.title!==d.base.title||d.text!==d.base.text||d.playDate!==d.base.playDate;
}
export function plainText(value:string){try{return richTextToPlainText(value);}catch{return value;}}
export function draftProblem(d:JournalDraft):string{
 if(!plainText(d.text).trim())return 'Bitte einen Text eintragen.';
 if(d.title.length>120)return 'Die Überschrift ist zu lang (höchstens 120 Zeichen).';
 if(d.kind==='chronicle'&&!validPlayDate(d.playDate))return 'Bitte ein gültiges Spieldatum wählen.';
 return '';
}
/** The companion API body for this draft. */
export function draftRequest(d:JournalDraft){
 const shared={characterId:d.characterId,title:d.title.trim()||undefined,text:d.text,visibility:'private' as const,journalKind:d.kind,...(d.kind==='chronicle'?{playDate:d.playDate}:{})};
 return d.noteId&&d.version?{action:'note.update' as const,noteId:d.noteId,version:d.version,...shared}:{action:'note.create' as const,...shared};
}

/**
 * Book layout. Each spread is two pages; registers jump to a spread. Order matters: page turning goes along it.
 * Later registers (inventory, letters, handouts, gallery) are appended here as their own spreads.
 */
export const JOURNAL_SPREADS=[
 {id:'notes',register:'chronicle',title:'Meine Notizen'},
 {id:'chronicle',register:'chronicle',title:'Chronik'},
 {id:'sheet-traits',register:'sheet',title:'Attribute & Fähigkeiten'},
 {id:'sheet-advantages',register:'sheet',title:'Vorteile & Zustände'},
 {id:'sheet-story',register:'sheet',title:'Geschichte'},
] as const;
export type JournalSpreadId=typeof JOURNAL_SPREADS[number]['id'];
export const JOURNAL_REGISTERS=[
 {id:'chronicle',label:'Chronik',short:'Chronik',color:'#5e2e22',icon:'quill'},
 {id:'sheet',label:'Charakterbogen',short:'Bogen',color:'#2e4644',icon:'bust'},
] as const;
export type JournalRegisterId=typeof JOURNAL_REGISTERS[number]['id'];
export const spreadIndex=(id:JournalSpreadId)=>JOURNAL_SPREADS.findIndex(s=>s.id===id);
export const registerStart=(id:JournalRegisterId)=>JOURNAL_SPREADS.findIndex(s=>s.register===id);
export const registerOf=(index:number)=>JOURNAL_SPREADS[clampSpread(index)].register;
export function clampSpread(index:number){return Number.isInteger(index)?Math.max(0,Math.min(JOURNAL_SPREADS.length-1,index)):0;}
/** Quick jumps inside the sheet (paper-sheet sections). */
export const SHEET_JUMPS=[
 {label:'Attribute',spread:'sheet-traits',anchor:'attributes'},
 {label:'Fähigkeiten',spread:'sheet-traits',anchor:'abilities'},
 {label:'Zustände',spread:'sheet-advantages',anchor:'states'},
 {label:'Geschichte',spread:'sheet-story',anchor:'story'},
] as const;

/**
 * Ribbons: every register (area) has its own ribbon in its colour; it only marks the area. Further ribbons are the
 * player's own bookmarks, laid in on any page (and on an open entry) and taken out again. Stored per viewer.
 */
export const OWN_BOOKMARK_LIMIT=4;
export const OWN_BOOKMARK_COLORS=['#4a552e','#4c3244','#8a6a30','#2b2520'] as const;
export const OWN_BOOKMARK_ICONS=['star','moon','sun','key'] as const;
export type JournalBookmark={id:string;spread:number;page:0|1;noteId?:string;kind?:JournalKind;label:string;color:string;icon:typeof OWN_BOOKMARK_ICONS[number]};
export function readBookmarks(value:unknown):JournalBookmark[]{
 if(!Array.isArray(value))return [];
 return value.flatMap(v=>{
  if(!v||typeof v!=='object')return [];const b=v as Record<string,unknown>;
  if(typeof b.id!=='string'||!Number.isInteger(b.spread))return [];
  const color=OWN_BOOKMARK_COLORS.includes(b.color as never)?b.color as string:OWN_BOOKMARK_COLORS[0];
  const icon=OWN_BOOKMARK_ICONS.includes(b.icon as never)?b.icon as JournalBookmark['icon']:OWN_BOOKMARK_ICONS[0];
  const bookmark:JournalBookmark={id:b.id,spread:clampSpread(b.spread as number),page:b.page===1?1:0,label:typeof b.label==='string'?b.label.slice(0,140):'Lesezeichen',color,icon,...(typeof b.noteId==='string'?{noteId:b.noteId}:{}),...(b.kind==='note'||b.kind==='chronicle'?{kind:b.kind as JournalKind}:{})};
  return [bookmark];
 }).slice(0,OWN_BOOKMARK_LIMIT);
}
/** Lays a new own bookmark in; the same page and entry is not marked twice. Returns null when nothing changes. */
export function addBookmark(list:readonly JournalBookmark[],at:{spread:number;page:0|1;noteId?:string;kind?:JournalKind;label:string},id:string):JournalBookmark[]|null{
 if(list.length>=OWN_BOOKMARK_LIMIT)return null;
 if(list.some(b=>b.spread===at.spread&&b.page===at.page&&(b.noteId||'')===(at.noteId||'')))return null;
 const free=OWN_BOOKMARK_COLORS.findIndex(c=>!list.some(b=>b.color===c));
 const slot=free<0?list.length%OWN_BOOKMARK_COLORS.length:free;
 return [...list,{id,spread:clampSpread(at.spread),page:at.page,label:at.label.slice(0,140),color:OWN_BOOKMARK_COLORS[slot],icon:OWN_BOOKMARK_ICONS[slot],...(at.noteId?{noteId:at.noteId,kind:at.kind}:{})}];
}
export function removeBookmark(list:readonly JournalBookmark[],id:string){return list.filter(b=>b.id!==id);}

/**
 * Turning is driven by one shared target. Fast input only moves the target; the animation then takes the shortest
 * way there (one sweep, not one turn per spread).
 */
export function nextTurn(current:number,target:number){
 const t=clampSpread(target),c=clampSpread(current);
 return t===c?null:{from:c,to:t,forward:t>c,skip:Math.abs(t-c)>1};
}

/**
 * The book is an object on the table, not a window:
 * stored = packed away (only the handle at the table edge), closed = lying shut on the table (movable),
 * open = lying open on the table at reading size (movable), large = enlarged over the stage for comfortable reading.
 */
export const JOURNAL_VIEWS=['stored','closed','open','large'] as const;
export type JournalView=typeof JOURNAL_VIEWS[number];
/** Escape steps back one state: large → open → closed. Packing away is always an explicit action. */
export function viewAfterEscape(view:JournalView):JournalView{return view==='large'?'open':view==='open'?'closed':view;}

/** Where the book lies: its centre in viewport pixels, kept inside the play area so the book can always be grabbed. */
export type TablePlace={cx:number;cy:number};
export function clampPlace(place:TablePlace,book:{width:number;height:number},area:{left:number;top:number;right:number;bottom:number}):TablePlace{
 const keep=80,toolbar=48,halfW=book.width/2,halfH=book.height/2;
 const minX=area.left+keep-halfW,maxX=area.right-keep+halfW,minY=area.top+toolbar+halfH,maxY=area.bottom-keep+halfH;
 const fit=(v:number,lo:number,hi:number)=>Math.round(hi<lo?(lo+hi)/2:Math.min(Math.max(v,lo),hi));
 return {cx:fit(place.cx,minX,maxX),cy:fit(place.cy,minY,maxY)};
}

/**
 * Release gate (protected live alpha), same pattern as the check desk:
 * - isolated local test instance (AJ01_JOURNAL=local-only and AUTH_ACCESS_ENVIRONMENT=local-test): on;
 * - elsewhere only campaigns listed explicitly in AJ01_JOURNAL_CAMPAIGNS (comma list, no wildcard).
 * Without either the journal is off. Switching it off never touches stored notes.
 */
export type JournalGateEnv={AJ01_JOURNAL?:string;AUTH_ACCESS_ENVIRONMENT?:string;AJ01_JOURNAL_CAMPAIGNS?:string};
export function journalAvailable(env:JournalGateEnv,campaignId:string){
 if(env.AJ01_JOURNAL==='local-only'&&env.AUTH_ACCESS_ENVIRONMENT==='local-test')return true;
 return !!campaignId&&(env.AJ01_JOURNAL_CAMPAIGNS||'').split(',').map(s=>s.trim()).filter(s=>s&&s!=='*').includes(campaignId);
}

/**
 * Sheet values: a missing value stays recognisably missing ("–"), a real zero is shown as zero.
 * Returns null for missing so the view can decide.
 */
export function sheetNumber(value:unknown):number|null{
 if(typeof value==='number'&&Number.isFinite(value))return Math.trunc(value);
 if(typeof value==='string'&&/^-?\d+$/.test(value.trim()))return Number(value.trim());
 return null;
}
/** Dots of a paper-sheet row: at least five, more when the value is higher (elders, generation limits). */
export function dotSlots(value:number|null,min=5){return Math.max(min,value??0);}
/** Screen reader text for dots and boxes. */
export function dotLabel(name:string,value:number|null,max?:number|null){
 if(value===null)return name+': nicht erfasst';
 return name+': '+value+(max!=null?' von '+max:'');
}

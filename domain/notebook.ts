// Notizbuch (Etappe 2): one notebook per player, the same pages in the player area and at the table.
// Pages are the player's own records of kind 'notizen'. No new storage: titles, dates and tags live in the
// existing record body, every other body field is kept untouched when a page is saved.
import {htmlToRichText,richTextToPlainText} from './location-rich-text.ts';
import {validCalendarDate} from './calendar-date.ts';

/** Records of kind 'notizen' that are not notes: table state, letters, votes, material, display assets. */
export const SYSTEM_NOTE_CONTEXTS=['live-table','live-table-signal','live-table-event','sl-message','appointment-vote','table-material','display-asset'] as const;
export const TAG_LIMIT=20,TAG_LENGTH=40,TITLE_LENGTH=200,TEXT_LENGTH=90000;
/** Client-side search is used while a notebook stays below this size; above it the list asks to narrow by tag. */
export const SEARCH_PAGE_LIMIT=1000;

export type NotebookRow={id:string;owner_id:string;title:string;visibility:string;body:string;version:number;created_at:string;updated_at:string};
export type PageSource='notiz'|'figur'|'ort'|'postfach';
export type NotebookPage={
 id:string;title:string;autoTitle:boolean;text:string;rich:boolean;date:string;tags:string[];
 visibility:string;characterId:string|null;source:PageSource;locationId:string|null;
 version:number;createdAt:string;updatedAt:string;
 /** Character notes are archived (soft), all other pages are deleted for good. */
 deletion:'archive'|'delete';
};

export function parseBody(raw:string):Record<string,unknown>{
 try{const v:unknown=JSON.parse(raw);return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}catch{return {};}
}
/** Rich text is stored with one of two prefixes; everything else is plain text with line breaks. */
export function isRichText(text:string){return text.startsWith('cvk-rich-v1:')||text.startsWith('cvk-html-v1:');}
export function plainText(text:string){
 if(!isRichText(text))return text;
 try{return richTextToPlainText(text.startsWith('cvk-html-v1:')?htmlToRichText(text.slice('cvk-html-v1:'.length)):text);}catch{return text;}
}

/** A row belongs into the notebook when it is the owner's own note: no system record, not archived. */
export function isNotebookRow(row:Pick<NotebookRow,'owner_id'|'body'>,ownerId:string){
 if(row.owner_id!==ownerId)return false;
 const body=parseBody(row.body);
 return !SYSTEM_NOTE_CONTEXTS.includes(String(body.context??'') as never)&&body.archived!==true;
}
/** The SL reads along, but never another person's correspondence (letters copied from the mailbox). */
export function slMayRead(page:Pick<NotebookPage,'source'>){return page.source!=='postfach';}

/** The page date: the own date, else an older play date (Abenteuerjournal), else the day of creation. */
export function pageDate(body:Record<string,unknown>,createdAt:string){
 if(validCalendarDate(body.date))return body.date;
 if(validCalendarDate(body.playDate))return body.playDate;
 return createdAt.slice(0,10);
}
export function readTags(value:unknown):string[]{return Array.isArray(value)?value.filter((t):t is string=>typeof t==='string'&&!!t.trim()).map(t=>t.trim().slice(0,TAG_LENGTH)).slice(0,TAG_LIMIT):[];}
export function pageFromRow(row:NotebookRow):NotebookPage{
 const body=parseBody(row.body),text=typeof body.text==='string'?body.text:'';
 const source:PageSource=typeof body.sourceMessageId==='string'?'postfach':typeof body.locationId==='string'?'ort':body.context==='character-companion'?'figur':'notiz';
 return {id:row.id,title:row.title,autoTitle:body.autoTitle===true,text,rich:isRichText(text),date:pageDate(body,row.created_at),tags:readTags(body.tags),
  visibility:row.visibility,characterId:typeof body.characterId==='string'?body.characterId:null,source,locationId:typeof body.locationId==='string'?body.locationId:null,
  version:row.version,createdAt:row.created_at,updatedAt:row.updated_at,deletion:body.context==='character-companion'?'archive':'delete'};
}

/** Tags are the player's own words: trimmed, at most 40 characters, at most 20, no duplicates (case-insensitive). */
export function normalizeTags(input:unknown):{tags:string[];error:string}{
 if(input!==undefined&&!Array.isArray(input))return {tags:[],error:'Schlagwörter fehlen.'};
 const tags:string[]=[];
 for(const raw of (input as unknown[]|undefined)||[]){
  if(typeof raw!=='string')return {tags:[],error:'Schlagwörter müssen Text sein.'};
  const tag=raw.trim().replace(/\s+/g,' ');
  if(!tag)continue;
  if(tag.length>TAG_LENGTH)return {tags:[],error:`Ein Schlagwort darf höchstens ${TAG_LENGTH} Zeichen haben.`};
  if(!tags.some(t=>t.toLowerCase()===tag.toLowerCase()))tags.push(tag);
 }
 if(tags.length>TAG_LIMIT)return {tags:[],error:`Höchstens ${TAG_LIMIT} Schlagwörter je Seite.`};
 return {tags,error:''};
}
/** Without a title the first line of the text names the page. */
export function deriveTitle(title:string,text:string){
 const own=title.trim().replace(/\s+/g,' ');
 if(own)return {title:own.slice(0,TITLE_LENGTH),autoTitle:false};
 const first=plainText(text).split('\n').map(l=>l.trim()).find(Boolean)||'';
 return {title:(first||'Ohne Titel').slice(0,120),autoTitle:true};
}

export type PageEdit={title:string;text:string;date:string;tags:string[]};
/**
 * The saved body: only the notebook's own fields change. Everything else (character, place, letter, older journal
 * fields, fields of later versions) stays exactly as stored.
 */
export function applyPageEdit(stored:Record<string,unknown>,edit:PageEdit){
 const named=deriveTitle(edit.title,edit.text);
 const body:Record<string,unknown>={...stored,text:edit.text,date:edit.date,tags:edit.tags};
 if(named.autoTitle)body.autoTitle=true;else delete body.autoTitle;
 return {title:named.title,body};
}

/** Newest page date first; the same day by last change. */
export function sortPages<T extends Pick<NotebookPage,'date'|'updatedAt'>>(pages:readonly T[]){
 return [...pages].sort((a,b)=>a.date===b.date?b.updatedAt.localeCompare(a.updatedAt):a.date<b.date?1:-1);
}
/** All tags in use, most used first, then alphabetical. */
export function tagIndex(pages:readonly Pick<NotebookPage,'tags'>[]){
 const count=new Map<string,{tag:string;n:number}>();
 for(const p of pages)for(const t of p.tags){const k=t.toLowerCase(),c=count.get(k);if(c)c.n++;else count.set(k,{tag:t,n:1});}
 return [...count.values()].sort((a,b)=>b.n-a.n||a.tag.localeCompare(b.tag,'de')).map(c=>c.tag);
}
const fold=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
/** Search over title, text and tags; every word must occur. An optional tag filter narrows first. */
export function searchPages<T extends Pick<NotebookPage,'title'|'text'|'tags'>>(pages:readonly T[],query:string,tag=''){
 const words=fold(query).split(/\s+/).filter(Boolean),wanted=tag.toLowerCase();
 return pages.filter(p=>{
  if(wanted&&!p.tags.some(t=>t.toLowerCase()===wanted))return false;
  if(!words.length)return true;
  const hay=fold(p.title+'\n'+plainText(p.text)+'\n'+p.tags.join(' '));
  return words.every(w=>hay.includes(w));
 });
}

/** A draft is what the player typed but has not been saved yet, per page (new pages use the id 'neu'). */
export type PageDraft={pageId:string;baseVersion:number|null;title:string;text:string;date:string;tags:string[]};
export function draftDiffers(draft:PageDraft,page:Pick<NotebookPage,'title'|'autoTitle'|'text'|'date'|'tags'>|null){
 if(!page)return !!(draft.title.trim()||plainText(draft.text).trim());
 return draft.text!==page.text||draft.date!==page.date||draft.tags.join('\u0000')!==page.tags.join('\u0000')||(draft.title.trim()!==(page.autoTitle?'':page.title));
}
export function draftFromPage(page:NotebookPage):PageDraft{return {pageId:page.id,baseVersion:page.version,title:page.autoTitle?'':page.title,text:page.text,date:page.date,tags:[...page.tags]};}
/** "8. Nov." style date of today in the player's local calendar, as ISO date. */
export function today(now=new Date()){const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');return `${y}-${m}-${d}`;}

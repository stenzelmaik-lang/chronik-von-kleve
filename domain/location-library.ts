import { z } from 'zod';
import { isRichTextWithinLimit, sanitizeRichTextInput, richTextToPlainText, readRichText, encodeRichText } from './location-rich-text.ts';

export const LOCATION_CHAPTER_KIND = 'location_sl_chapter';
export const LOCATION_MEDIA_KIND = 'location_media';
export const LOCATION_ADOPTION_KIND = 'location_sl_adopted';
export const locationReservedKind = (kind:string) => kind.startsWith('location_');
export const chapterCharacterLimit = 25000;
export const locationMediaTypes = ['atmosphere','interior','exterior','map','floorplan','sl_plan','historic','document'] as const;
export const libraryState = z.enum(['active','archived','deleted']);
const richBody=z.string().max(85000).transform((value,ctx)=>{
  try { const safe=sanitizeRichTextInput(value);if(isRichTextWithinLimit(safe,chapterCharacterLimit))return safe; }
  catch { /* Report a validation error instead of falling back to unsafe markup. */ }
  ctx.addIssue({code:z.ZodIssueCode.custom,message:'Höchstens 25.000 sichtbare Zeichen und eine sichere, überschaubare HTML-Struktur pro Kapitel.'});return z.NEVER;
});
export const chapterDataSchema=z.object({title:z.string().trim().min(1).max(160),body:richBody,overview:z.boolean().default(false),state:libraryState.default('active')}).strict();
export const mediaDataSchema=z.object({title:z.string().trim().min(1).max(160),description:z.string().max(3000).default(''),fileId:z.string().uuid(),mediaType:z.enum(locationMediaTypes),hero:z.boolean().default(false),playerReleased:z.boolean().default(false),state:libraryState.default('active')}).strict().refine(value=>value.mediaType!=='sl_plan'||!value.playerReleased,'SL-Grundrisse bleiben vertraulich.');
export type ChapterData=z.infer<typeof chapterDataSchema>;
export type LocationMediaData=z.infer<typeof mediaDataSchema>;
export type LocationLibraryData=ChapterData|LocationMediaData;
export type LocationLibraryItem={id:string;entityId:string;kind:'chapter'|'media';position:number;version:number;updatedAt:string;data:LocationLibraryData;hasBody?:boolean;mime?:string;size?:number;url?:string};
export type PublicLocationMedia={id:string;title:string;description:string;mediaType:typeof locationMediaTypes[number];hero:boolean;mime:string;size:number;position:number;url:string};
export function parseLocationItemContent(content:string,kind:string):{version:number;updatedAt:string;data:LocationLibraryData}|null {
  try { const raw=JSON.parse(content);if(!raw||!Number.isSafeInteger(raw.version)||raw.version<1||typeof raw.updatedAt!=='string')return null;
    const parsed=(kind===LOCATION_CHAPTER_KIND?chapterDataSchema:kind===LOCATION_MEDIA_KIND?mediaDataSchema:null)?.safeParse(raw.data);
    return parsed?.success?{version:raw.version,updatedAt:raw.updatedAt,data:parsed.data}:null;
  }catch{return null;}
}
/** The outer chapter title supplies its heading. Identical leading H2 is only
 * omitted for display; the saved HTML and all other headings stay intact. */
export function locationChapterBody(title:string,body:string){
  const document=readRichText(body),first=document.blocks[0];
  if(first?.type==='heading2'&&first.children.map(p=>p.text).join('').trim().toLocaleLowerCase('de-DE')===title.trim().toLocaleLowerCase('de-DE'))return encodeRichText({version:1,blocks:document.blocks.slice(1)});
  return body;
}
export const locationItemSearchText=(item:LocationLibraryItem)=>item.data.title+' '+('body' in item.data?richTextToPlainText(item.data.body):item.data.description);

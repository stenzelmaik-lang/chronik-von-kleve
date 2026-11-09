// Charakterprofil = page 2 of the V20 paper sheet (owner decision 09.11.2026). Stored in the character body under
// `profile`; story and play guide stay where they are (`text`, `playGuide`). Each block is private (player and SL)
// unless the player shares it with the group. Other players only ever receive shared blocks.
import {z} from 'zod';

export const PROFILE_DESCRIPTION_FIELDS=[
 ['age','Alter'],['apparentAge','Sieht aus wie'],['deathDate','Todestag'],['gender','Geschlecht'],['origin','Ethnische Herkunft'],
 ['nationality','Nationalität'],['hair','Haarfarbe'],['eyes','Augenfarbe'],['height','Größe'],['weight','Gewicht'],
] as const;
export const PROFILE_BLOCKS=[['description','Beschreibung'],['story','Geschichte'],['drive','Antrieb und Auftreten'],['allies','Verbündete & Kontakte']] as const;
export type ProfileBlock=typeof PROFILE_BLOCKS[number][0];
export type ProfileVisibility='private'|'group';
type DescriptionKey=typeof PROFILE_DESCRIPTION_FIELDS[number][0];
export type CharacterProfile={description:Record<DescriptionKey,string>&{appearance:string};allies:string;visibility:Record<ProfileBlock,ProfileVisibility>};

const short=z.string().trim().max(120);
export const profileSchema=z.object({
 description:z.object({...Object.fromEntries(PROFILE_DESCRIPTION_FIELDS.map(([k])=>[k,short])) as Record<DescriptionKey,typeof short>,appearance:z.string().trim().max(2000)}).strict(),
 allies:z.string().trim().max(5000),
 visibility:z.object(Object.fromEntries(PROFILE_BLOCKS.map(([k])=>[k,z.enum(['private','group'])])) as Record<ProfileBlock,z.ZodEnum<['private','group']>>).strict(),
}).strict();

const text=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

/** The stored profile with every field present; unknown or broken values become empty, visibility defaults to private. */
export function readProfile(body:Record<string,unknown>):CharacterProfile{
 const p=object(body.profile),d=object(p.description),vis=object(p.visibility);
 return {
  description:{...Object.fromEntries(PROFILE_DESCRIPTION_FIELDS.map(([k])=>[k,text(d[k],120)])) as Record<DescriptionKey,string>,appearance:text(d.appearance,2000)},
  allies:text(p.allies,5000),
  visibility:Object.fromEntries(PROFILE_BLOCKS.map(([k])=>[k,vis[k]==='group'?'group':'private'])) as Record<ProfileBlock,ProfileVisibility>,
 };
}

export type SharedProfile={description?:{label:string;value:string}[];appearance?:string;story?:string;drive?:string;allies?:string};
/** What another player may see: only blocks the owner shared with the group, and only filled fields. */
export function sharedProfile(body:Record<string,unknown>):SharedProfile{
 const p=readProfile(body),out:SharedProfile={};
 if(p.visibility.description==='group'){
  const rows=PROFILE_DESCRIPTION_FIELDS.flatMap(([k,label])=>p.description[k].trim()?[{label,value:p.description[k].trim()}]:[]);
  if(rows.length)out.description=rows;
  if(p.description.appearance.trim())out.appearance=p.description.appearance.trim();
 }
 if(p.visibility.story==='group'&&typeof body.text==='string'&&body.text.trim())out.story=body.text;
 if(p.visibility.drive==='group'&&typeof body.playGuide==='string'&&body.playGuide.trim())out.drive=body.playGuide;
 if(p.visibility.allies==='group'&&p.allies.trim())out.allies=p.allies.trim();
 return out;
}
export const hasSharedProfile=(s:SharedProfile)=>Object.keys(s).length>0;

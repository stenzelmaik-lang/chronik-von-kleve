import {z} from 'zod';
import type {JsonObject} from './types.ts';

export const npcFieldNames = {
  name:'Name', title:'Titel / Beiname', alias:'Alias', role:'Rolle', clan:'Clan', generation:'Generation',
  stance:'Haltung', affiliation:'Zugehörigkeiten', known_for:'Bekannt für', npc_status:'Figurenstatus',
  location_note:'Aufenthaltsnotiz', image_primary:'Primärbild', image_secondary:'Sekundärbild',
  summary:'Bisheriges Kurzprofil', image:'Bisheriges Bild', concept:'Konzept', text:'Bisheriger Text',
} as const;
export const npcVisibilitySchema=z.enum(['sl_secret','player_visible']);
export const npcFieldVisibilitySchema=z.record(z.enum(Object.keys(npcFieldNames) as [keyof typeof npcFieldNames,...(keyof typeof npcFieldNames)[]]),npcVisibilitySchema);
const image=z.string().max(500).refine(s=>!s || /^\/images\/[a-zA-Z0-9._-]+$/.test(s) || /^\/api\/files\?id=[a-zA-Z0-9_-]+$/.test(s),'Nur vorhandene Bildreferenzen.');
export const npcProfileSchema=z.object({
  alias:z.string().max(200).optional(), summary:z.string().max(2000).optional(), image:image.optional(),
  title:z.string().max(200).optional(), role:z.string().max(200).optional(), clan:z.string().max(200).optional(),
  generation:z.number().int().min(1).max(20).nullable().optional(), stance:z.string().max(200).optional(),
  affiliation:z.array(z.string().trim().min(1).max(200)).max(20).optional(), known_for:z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  npc_status:z.string().max(200).optional(), location_note:z.string().max(200).optional(),
  image_primary:image.optional(), image_secondary:image.optional(), field_visibility:npcFieldVisibilitySchema.optional(),
}).strict();
export const npcSLKinds=['sl_secrets','sl_agenda','sl_playstyle'] as const;
export const isNPCSLKind=(kind:string)=>npcSLKinds.includes(kind as typeof npcSLKinds[number]);
// Existing legacy payloads retain their compatibility path. New structured fields
// opt into fail-closed projection; no legacy value is treated as a new release.
export function hasNPCFieldVisibility(content:JsonObject){
  return ['field_visibility','image_primary','image_secondary','npc_status','location_note','affiliation','known_for','stance','generation','role','title'].some(key=>key in content);
}
export function npcFieldVisibility(content:JsonObject,key:string){
  const map=content.field_visibility;
  return map && typeof map==='object' && !Array.isArray(map) && map[key]==='player_visible'?'player_visible':'sl_secret';
}
export function projectNPCFields(content:JsonObject):JsonObject{
  if(!hasNPCFieldVisibility(content))return content;
  const clean:JsonObject={field_visibility:{}};
  for(const [key,value] of Object.entries(content))if(key!=='field_visibility' && npcFieldVisibility(content,key)==='player_visible')clean[key]=value;
  return clean;
}

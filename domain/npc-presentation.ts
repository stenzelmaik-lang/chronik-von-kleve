import type {JsonObject} from './types.ts';
export const npcFigureKinds=['Haupt-NPC','NPC','Nebencharakter','Antagonist'] as const;
export function npcPortraitSettings(content:JsonObject){
  const bounded=(key:string,min:number,max:number,fallback:number)=>typeof content[key]==='number'&&Number.isFinite(content[key])?Math.max(min,Math.min(max,content[key] as number)):fallback;
  return {zoom:bounded('hero_zoom',1,2.5,1),position:bounded('hero_position',0,100,0),mist:bounded('hero_mist',0,100,70)};
}

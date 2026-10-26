export type LiveAudience={scope:'all'}|{scope:'players';playerIds:string[]};
export type LiveMedia={id:string;name:string;mime:string};
export type LiveEvent={id:string;runId?:string;kind:'scene'|'media'|'roll';authorId:string;authorName:string;at:string;recipients:string[]|null;hidden?:boolean;scene?:{id:string;title:string;narration:string};files?:LiveMedia[];index?:number;roll?:{pool:number;target:number;dice:number[]}};
export function liveAudience(value:unknown,eligible:string[]):string[]|null {
  if(!value||typeof value!=='object')throw Error('Zielgruppe wählen.');
  const d=value as Record<string,unknown>;
  if(d.scope==='all')return null;
  if(d.scope!=='players'||!Array.isArray(d.playerIds)||!d.playerIds.length||d.playerIds.length>30||d.playerIds.some(id=>typeof id!=='string'||!eligible.includes(id))||new Set(d.playerIds).size!==d.playerIds.length)throw Error('Wähle berechtigte Spieler dieser Runde.');
  return [...d.playerIds] as string[];
}
export function liveEventVisible(event:LiveEvent,memberId:string,gm:boolean){return !event.hidden&&(gm||event.recipients===null||event.recipients.includes(memberId));}
export function liveRoll(pool:unknown,target:unknown){
  if(!Number.isInteger(pool)||Number(pool)<1||Number(pool)>30||!Number.isInteger(target)||Number(target)<2||Number(target)>10)throw Error('W10: 1–30 Würfel, Schwelle 2–10.');
  const dice=Array.from({length:Number(pool)},()=>{const n=new Uint32Array(1);do{crypto.getRandomValues(n);}while(n[0]>=4294967290);return n[0]%10+1;});
  return {pool:Number(pool),target:Number(target),dice};
}
export const LIVE_MEDIA_TYPES=['image/jpeg','image/png','image/webp','image/gif','application/pdf','audio/mpeg','audio/ogg','audio/wav','audio/mp4','video/mp4','video/webm'];

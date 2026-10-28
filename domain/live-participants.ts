import type {TablePeer} from './live-table.ts';
import {TABLE_PEER_TTL} from './live-table.ts';
export type Presence='connected'|'afk'|'disconnected';
export const presenceLabels:Record<Presence,string>={connected:'Am Tisch',afk:'AFK',disconnected:'Nicht verbunden'};
/** Several tabs are connections of the same member, not separate people. */
export function participantPresence(memberId:string,peers:Record<string,TablePeer>,away:Record<string,boolean>={},now=Date.now()):Presence {
 const connected=Object.values(peers).some(p=>p.memberId===memberId&&Number.isFinite(p.seen)&&p.seen>now-TABLE_PEER_TTL&&p.seen<=now+5000);
 return !connected?'disconnected':away[memberId]===true?'afk':'connected';
}
/** Never inherit private character values into the public card. */
export function publicCharacterCard(row:{id:string;title:string;visibility:string},blocks:{kind:string;content:string;visibility:string}[]) {
 if(row.visibility!=='group')return null;
 return {id:row.id,name:row.title,descriptions:blocks.filter(b=>b.visibility==='player_visible'&&['summary','description','appearance','biography'].includes(b.kind)).map(b=>({kind:b.kind,content:b.content}))};
}

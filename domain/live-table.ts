export type BoardPoint = [number, number];
export type BoardElement = { id:string; memberId:string; name:string; color:string; points:BoardPoint[]; text?:string; fileId?:string; shape?:'line'|'arrow'|'rectangle'|'ellipse'; width?:number; revision?:number };
/** The sketch has its own budget inside the room record, apart from the stage that shares it. */
export const BOARD_MAX_ELEMENTS = 400;
export const BOARD_MAX_CHARS = 160000;
export const BOARD_POINTS = 128;
export const BOARD_WIDTHS = [2,4,8] as const;
export type TablePeer = {id:string;memberId:string;name:string;seen:number};
export type TableScreen = {peerId:string;screenId:string};
export const TABLE_PEER_TTL = 30000;
export const TABLE_CONTEXTS = ['live-table','live-table-signal','live-table-event'];
export function tablePeerId(value:unknown):value is string { return typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value); }
export function boardElement(value:unknown):Omit<BoardElement,'memberId'|'name'> {
  if(!value||typeof value!=='object')throw new Error('Ungültiger Whiteboard-Eintrag.');
  const d=value as Record<string,unknown>;
  if(!tablePeerId(d.id)||typeof d.color!=='string'||!/^#[0-9a-f]{6}$/i.test(d.color)||!Array.isArray(d.points)||d.points.length<1||d.points.length>BOARD_POINTS)throw new Error('Ungültiger Whiteboard-Eintrag.');
  const points=d.points.map(point=>{
    if(!Array.isArray(point)||point.length!==2||point.some((number,index)=>typeof number!=='number'||!Number.isFinite(number)||number<0||number>(index===0?1000:600)))throw new Error('Ungültige Zeichenposition.');
    return point.map(number=>Math.round(number)) as BoardPoint;
  });
  if(d.text!==undefined&&(typeof d.text!=='string'||!d.text.trim()||d.text.length>500))throw new Error('Whiteboard-Text darf höchstens 500 Zeichen lang sein.');
  if(d.fileId!==undefined&&(typeof d.fileId!=='string'||d.fileId.length>160||!d.fileId))throw new Error('Ungültiges Whiteboard-Bild.');
  if(d.width!==undefined&&(!Number.isInteger(d.width)||Number(d.width)<1||Number(d.width)>12))throw new Error('Ungültige Strichstärke.');
  if(d.shape!==undefined&&(!['line','arrow','rectangle','ellipse'].includes(String(d.shape))||points.length!==2||d.text!==undefined||d.fileId!==undefined))throw new Error('Ungültige Whiteboard-Form.');
  return {id:d.id,color:d.color,points,...(typeof d.text==='string'?{text:d.text.trim()}:{}),...(typeof d.fileId==='string'?{fileId:d.fileId}:{}),...(d.shape!==undefined?{shape:d.shape as BoardElement['shape']}:{}),...(d.width!==undefined&&d.text===undefined&&d.fileId===undefined?{width:Number(d.width)}:{})};
}
export function tableSignal(value:unknown):{type:'offer'|'answer'|'candidate';payload:RTCSessionDescriptionInit|RTCIceCandidateInit} {
  if(!value||typeof value!=='object')throw new Error('Ungültiges Verbindungssignal.');
  const d=value as Record<string,unknown>;
  if(d.type==='offer'||d.type==='answer'){
    if(typeof d.sdp!=='string'||d.sdp.length>20000||!d.sdp.startsWith('v=0')||/^m=audio/m.test(d.sdp))throw new Error('Nur Bildschirmvideo ist unterstützt.');
    return {type:d.type,payload:{type:d.type,sdp:d.sdp}};
  }
  if(d.type==='candidate'){
    const candidate=d.candidate as Record<string,unknown>|undefined;
    if(!candidate||typeof candidate.candidate!=='string'||candidate.candidate.length>2000||(candidate.sdpMid!==null&&(typeof candidate.sdpMid!=='string'||candidate.sdpMid.length>64))||(candidate.sdpMLineIndex!==null&&(!Number.isInteger(candidate.sdpMLineIndex)||Number(candidate.sdpMLineIndex)<0||Number(candidate.sdpMLineIndex)>8)))throw new Error('Ungültiges ICE-Signal.');
    return {type:'candidate',payload:{candidate:candidate.candidate,sdpMid:candidate.sdpMid as string|null,sdpMLineIndex:candidate.sdpMLineIndex as number|null}};
  }
  throw new Error('Unbekanntes Verbindungssignal.');
}

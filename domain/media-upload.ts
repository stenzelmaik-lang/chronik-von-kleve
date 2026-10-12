import {LIVE_MEDIA_TYPES} from './live-game.ts';
export {LIVE_MEDIA_TYPES};
export function validMediaBytes(mime:string,bytes:Uint8Array){
 const sig=String.fromCharCode(...bytes.slice(0,12));
 switch(mime){
  case 'image/png':return bytes[0]===137&&sig.slice(1,4)==='PNG';
  case 'image/jpeg':return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  case 'image/webp':return sig.startsWith('RIFF')&&sig.slice(8)==='WEBP';
  case 'image/gif':return sig.startsWith('GIF87a')||sig.startsWith('GIF89a');
  case 'application/pdf':return sig.startsWith('%PDF-');
  case 'audio/mpeg':return sig.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224);
  case 'audio/ogg':return sig.startsWith('OggS');
  case 'audio/wav':return sig.startsWith('RIFF')&&sig.slice(8)==='WAVE';
  case 'audio/mp4':case 'video/mp4':return sig.slice(4,8)==='ftyp';
  case 'video/webm':return bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163;
  default:return false;
 }
}

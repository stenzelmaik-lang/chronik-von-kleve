import {audioPeaks} from '@/domain/audio-player';

// The waveform is optional, not a second audio store. Decode only after a user's play click,
// at 8 kHz and with strict byte/duration limits, so long recordings still play without a large decode.
const maxBytes=16*1024*1024;
export async function recordingPeaks(src:string,duration:number,signal:AbortSignal):Promise<number[]>{
 if(!duration||duration>30*60||typeof OfflineAudioContext==='undefined')return [];
 const response=await fetch(src,{credentials:'same-origin',signal});
 if(!response.ok)throw new Error('Waveform unavailable');
 if(Number(response.headers.get('Content-Length'))>maxBytes){await response.body?.cancel();return [];}
 const reader=response.body?.getReader();if(!reader)return [];
 const chunks:Uint8Array[]=[];let length=0;
 try{
  while(true){
   const {value,done}=await reader.read();if(done)break;
   length+=value.byteLength;
   if(length>maxBytes){await reader.cancel();return [];}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 if(signal.aborted)return [];
 const bytes=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const decoder=new OfflineAudioContext(1,1,8000);
 const decoded=await decoder.decodeAudioData(bytes.buffer);
 if(signal.aborted)return [];
 return audioPeaks(Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)));
}

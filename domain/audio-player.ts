/** Pure helpers for the personal audio player; no shared table state. */
export function audioTime(seconds:number):string{
 const value=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
 const s=String(value%60).padStart(2,'0'),m=String(Math.floor(value/60)%60).padStart(2,'0');
 return value>=3600?Math.floor(value/3600)+':'+m+':'+s:m+':'+s;
}
export function audioPosition(value:number,duration:number):number{
 return Number.isFinite(value)&&Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(duration,value)):0;
}
export type AudioDeviceLayout={x:number;y:number;width:number};
/** Shortest signed turn in degrees: moving through the -180/180 seam never jumps the volume. */
export function rotaryDelta(previous:number,next:number):number{
 return Number.isFinite(previous)&&Number.isFinite(next)?((next-previous+540)%360+360)%360-180:0;
}
export function rotaryVolume(volume:number,previous:number,next:number,fine=false):number{
 return Math.max(0,Math.min(1,(Number.isFinite(volume)?volume:0)+rotaryDelta(previous,next)/(fine?1350:270)));
}
/** Project the pointer onto the knob's inclined top plane; the centre is deliberately a dead zone. */
export function rotaryPointer(x:number,y:number,rect:{left:number;top:number;width:number;height:number}):number|null{
 if(![x,y,rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
 const dx=(x-rect.left-rect.width/2)/(rect.width/2),dy=(y-rect.top-rect.height*.34)/(rect.width*.21);
 return Math.hypot(dx,dy)<.18?null:Math.atan2(dx,-dy)*180/Math.PI;
}
/** Personal physical prop; keep its entire silhouette inside the playfield, also after viewport changes. */
export function fitAudioDevice(layout:AudioDeviceLayout,bounds:{w:number;h:number}):AudioDeviceLayout{
 const w=Number.isFinite(bounds.w)&&bounds.w>0?bounds.w:1,h=Number.isFinite(bounds.h)&&bounds.h>0?bounds.h:1;
 const max=Math.max(1,Math.min(840,w-20,(h-20)*1671/941));
 const width=Math.max(Math.min(280,max),Math.min(max,Number.isFinite(layout.width)?layout.width:450));
 const mx=Math.min(10/w,Math.max(0,(w-width)/w/2)),my=Math.min(10/h,Math.max(0,(h-width*941/1671)/h/2));
 return {width,x:Math.max(mx,Math.min(Math.max(mx,1-width/w-mx),Number.isFinite(layout.x)?layout.x:.48)),y:Math.max(my,Math.min(Math.max(my,1-width*941/1671/h-my),Number.isFinite(layout.y)?layout.y:.24))};
}
/** Maximum amplitude per bucket, across all channels. Silence stays silent. */
export function audioPeaks(channels:readonly Float32Array[],count=160):number[]{
 const length=channels[0]?.length||0;
 if(!length||!Number.isInteger(count)||count<1)return [];
 const buckets=Math.min(count,length),peaks=new Array<number>(buckets).fill(0);
 for(let b=0;b<buckets;b++){
  const from=Math.floor(b*length/buckets),to=Math.floor((b+1)*length/buckets);
  let peak=0;
  for(const channel of channels)for(let i=from;i<Math.min(to,channel.length);i++){
   const sample=channel[i];if(Number.isFinite(sample))peak=Math.max(peak,Math.abs(sample));
  }
  peaks[b]=Math.min(1,peak);
 }
 return peaks;
}

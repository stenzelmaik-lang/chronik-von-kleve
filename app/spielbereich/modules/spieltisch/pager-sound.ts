"use client";
/**
 * Pager sounds through Web Audio. The delivered WAV files peak at -21 dBFS, which is inaudible next to music; they are
 * played with a fixed gain of +12 dB (peak about -9 dBFS, no clipping). Browsers start audio only after an interaction
 * with the page: the context is unlocked by the first tap, click or key press, or explicitly by "Ton aktivieren".
 * A ring that arrives while sound is locked is not replayed later; the pager offers the activation instead.
 */

type Kind='ping'|'alarm';
/** The pager sounds from the delivered asset package. */
export const ULTIO_SOUNDS={ping:'/spieltisch/pager/ping-normal.wav',alarm:'/spieltisch/pager/alarm-urgent.wav'} as const;
export type PagerSoundState='ready'|'locked'|'unsupported';
export const pagerSoundGain=4;
/** Length of the delivered sounds (seconds, rounded up). */
export const pagerRingSeconds:Record<Kind,number>={ping:.35,alarm:.6};
/**
 * When a ring may start (audio clock, seconds): never on top of a running one. Several new messages in one sync are one
 * call, so one ring. A ping during a running sound is dropped; an alarm waits for it and follows directly, but never
 * piles up more than a second.
 */
export function pagerRingSlot(now:number,busyUntil:number,kind:Kind):number|null{
 if(now>=busyUntil)return now;
 return kind==='alarm'&&busyUntil-now<=1?busyUntil:null;
}

let ctx:AudioContext|null=null,busyUntil=0;
const buffers:Partial<Record<Kind,Promise<AudioBuffer>>>={},listeners=new Set<()=>void>();
const AudioClass=()=>typeof window==='undefined'?undefined:window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
function context(){
 if(ctx)return ctx;const C=AudioClass();if(!C)return null;
 try{ctx=new C();ctx.onstatechange=()=>listeners.forEach(f=>f());}catch{ctx=null;}
 return ctx;
}
export function pagerSoundState():PagerSoundState{if(!AudioClass())return 'unsupported';return ctx?.state==='running'?'ready':'locked';}
export function onPagerSoundChange(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};}
function buffer(kind:Kind){
 const c=context();if(!c)return Promise.reject(Error('no audio'));
 return buffers[kind]??=fetch(ULTIO_SOUNDS[kind]).then(r=>r.arrayBuffer()).then(b=>c.decodeAudioData(b)).catch(e=>{delete buffers[kind];throw e;});
}
/** Call inside a user gesture. Also plays a silent buffer, which iOS needs to release audio. */
export async function unlockPagerSound(){
 const c=context();if(!c)return false;
 try{const s=c.createBufferSource();s.buffer=c.createBuffer(1,1,22050);s.connect(c.destination);s.start(0);}catch{/* not needed everywhere */}
 try{await c.resume();}catch{/* still locked */}
 listeners.forEach(f=>f());
 if(c.state==='running'){void buffer('ping').catch(()=>{});void buffer('alarm').catch(()=>{});}
 return c.state==='running';
}
/** One short ring. Returns false when sound is locked or unavailable; nothing is kept for later. */
export async function playPagerSound(kind:Kind){
 // A page that has already seen an interaction (even before the pager existed) may start audio without a new gesture.
 if(ctx?.state!=='running'&&typeof navigator!=='undefined'&&(navigator as Navigator&{userActivation?:{hasBeenActive:boolean}}).userActivation?.hasBeenActive)await unlockPagerSound();
 const c=ctx;if(!c||c.state!=='running')return false;
 // The slot is reserved before the sound is loaded, so two rings in quick succession can never overlap.
 const at=pagerRingSlot(c.currentTime,busyUntil,kind);if(at===null)return true;
 busyUntil=at+pagerRingSeconds[kind]+.08;
 try{const src=c.createBufferSource(),gain=c.createGain();src.buffer=await buffer(kind);gain.gain.value=pagerSoundGain;src.connect(gain).connect(c.destination);src.start(Math.max(at,c.currentTime));return true;}
 catch{return false;}
}

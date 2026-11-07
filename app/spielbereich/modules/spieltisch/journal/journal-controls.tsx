'use client';
import type {CSSProperties,ReactNode,Ref} from 'react';
import styles from './journal-controls.module.css';

// Abenteuerjournal (AJ-01): the control system of the book. Every control is a physical part of the book:
// brass medallions on the leather strap, leather register tabs, silk ribbons, dog-eared page corners, a wax seal.
// Icons are engraved line drawings (own SVG paths, no third-party artwork).

export type JournalIconName='clasp'|'open'|'enlarge'|'shrink'|'satchel'|'quill'|'bust'|'plus'|'dice'|'seal'|'heading'|'bold'|'italic'|'underline'|'list'|'fleur'|'star'|'moon'|'sun'|'key';
const paths:Record<JournalIconName,ReactNode>={
 clasp:<><rect x="4.5" y="7" width="15" height="10" rx="2.2"/><path d="M8.5 7V5.6a3.5 3.5 0 0 1 7 0V7"/><circle cx="12" cy="12" r="1.6"/><path d="M12 13.6v1.6"/></>,
 open:<><path d="M12 6.5c-2.2-1.4-5-1.9-8-1.6v12.6c3-.3 5.8.2 8 1.6 2.2-1.4 5-1.9 8-1.6V4.9c-3-.3-5.8.2-8 1.6z"/><path d="M12 6.5v12.6"/></>,
 enlarge:<><circle cx="10.5" cy="10.5" r="5.5"/><path d="m14.5 14.5 5 5"/><path d="M10.5 8v5M8 10.5h5"/></>,
 shrink:<><circle cx="10.5" cy="10.5" r="5.5"/><path d="m14.5 14.5 5 5"/><path d="M8 10.5h5"/></>,
 satchel:<><path d="M5 9.5h14l-1.2 9a1.6 1.6 0 0 1-1.6 1.4H7.8a1.6 1.6 0 0 1-1.6-1.4z"/><path d="M8.5 9.5V7.8a3.5 3.5 0 0 1 7 0v1.7"/><path d="M5 9.5c2 2.6 12 2.6 14 0"/><rect x="10.6" y="11.6" width="2.8" height="2.4" rx=".5"/></>,
 quill:<><path d="M19.5 4.5c-6 .6-10.4 4.6-12 11.5"/><path d="M19.5 4.5c-1 5.6-4.6 9.4-10.6 10.4"/><path d="M7.5 16 5 19.5"/><path d="M11 11.5l3.5-1"/></>,
 bust:<><circle cx="12" cy="8.2" r="3.4"/><path d="M5.5 19.5c.6-4 3.2-6.2 6.5-6.2s5.9 2.2 6.5 6.2z"/></>,
 plus:<><path d="M12 6v12M6 12h12"/></>,
 dice:<><rect x="5" y="5" width="14" height="14" rx="3"/><circle cx="9" cy="9" r=".9" fill="currentColor"/><circle cx="15" cy="15" r=".9" fill="currentColor"/><circle cx="15" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="15" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/></>,
 seal:<><path d="M16.5 5.5c-4 .4-7 3.2-8 8"/><path d="M16.5 5.5c-.7 3.8-3.1 6.4-7.2 7"/><path d="m8.5 13.5-2 3"/><path d="M7 19h10"/></>,
 heading:<><path d="M7 6v12M17 6v12M7 12h10"/><path d="M5 6h4M15 6h4M5 18h4M15 18h4"/></>,
 bold:<><path d="M8 5.5h5a3.2 3.2 0 0 1 0 6.4H8z"/><path d="M8 11.9h5.8a3.3 3.3 0 0 1 0 6.6H8z"/><path d="M8 5.5v13"/></>,
 italic:<><path d="M14 5.5h4M6 18.5h4M15.5 5.5l-7 13"/></>,
 underline:<><path d="M8 5v6a4 4 0 0 0 8 0V5"/><path d="M6 19.5h12"/></>,
 list:<><circle cx="6" cy="7.5" r="1" fill="currentColor"/><circle cx="6" cy="12" r="1" fill="currentColor"/><circle cx="6" cy="16.5" r="1" fill="currentColor"/><path d="M9.5 7.5H19M9.5 12H19M9.5 16.5H19"/></>,
 fleur:<><path d="M12 4c1.8 2 1.8 4.6 0 7-1.8-2.4-1.8-5 0-7z"/><path d="M12 11c-1.2-2.6-4.6-3.2-6-1.4 1.2.2 2.4 1.2 2.8 2.6"/><path d="M12 11c1.2-2.6 4.6-3.2 6-1.4-1.2.2-2.4 1.2-2.8 2.6"/><path d="M8 13h8M12 13v7"/></>,
 star:<><path d="m12 3.8 1.9 5.6 5.9.1-4.7 3.6 1.7 5.7L12 15.4l-4.8 3.4 1.7-5.7-4.7-3.6 5.9-.1z"/></>,
 moon:<><path d="M15.5 4.5a7.5 7.5 0 1 0 4 12.6A6 6 0 0 1 15.5 4.5z"/></>,
 sun:<><circle cx="12" cy="12" r="3.6"/><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6 6l1.7 1.7M16.3 16.3 18 18M18 6l-1.7 1.7M7.7 16.3 6 18"/></>,
 key:<><circle cx="8" cy="12" r="3.4"/><path d="M11.4 12H20M17 12v3M19.5 12v2.2"/></>,
};
export function JournalIcon({name,size=20}:{name:JournalIconName;size?:number}){
 return <svg className={styles.icon} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">{paths[name]}</svg>;
}

/** A brass medallion mounted on the strap. The plaque with the name slides out on hover and focus. */
export function Medallion({icon,label,onClick,buttonRef,side='left',pressed,dataCover,style}:{icon:JournalIconName;label:string;onClick:()=>void;buttonRef?:Ref<HTMLButtonElement>;side?:'left'|'right'|'below';pressed?:boolean;dataCover?:boolean;style?:CSSProperties}){
 return <button ref={buttonRef} type="button" className={styles.medallion} data-side={side} aria-label={label} aria-pressed={pressed} data-cover={dataCover||undefined} data-drag={dataCover||undefined} style={style} onClick={onClick}>
  <span className={styles.medallionFace}><JournalIcon name={icon} size={22}/></span>
  <span className={styles.plaque} aria-hidden>{label}</span>
 </button>;
}

/** A touch area on a 3D part of the book (buckle, strap end, concho): invisible until hovered or focused, then a warm
 * edge glow and the leather plaque with its name. The part itself is drawn by the 3D scene. */
export function Hotspot({label,onClick,buttonRef,side='left',dataCover}:{label:string;onClick:()=>void;buttonRef?:Ref<HTMLButtonElement>;side?:'left'|'right'|'below';dataCover?:boolean}){
 return <button ref={buttonRef} type="button" className={styles.hotspot} data-side={side} aria-label={label} data-cover={dataCover||undefined} onClick={onClick}><span className={styles.plaque} aria-hidden>{label}</span></button>;
}

/** A silk ribbon hanging out of the book. Area ribbons carry the register colour and symbol. */
export function Ribbon({color,icon,label,current,onClick,buttonRef,length,onRemove,removeLabel}:{color:string;icon:JournalIconName;label:string;current?:boolean;onClick:()=>void;buttonRef?:Ref<HTMLButtonElement>;length?:number;onRemove?:()=>void;removeLabel?:string}){
 return <span className={styles.ribbonWrap} style={{'--ribbon-color':color,...(length?{'--ribbon-length':length+'px'}:{})} as CSSProperties} data-current={current||undefined}>
  <button ref={buttonRef} type="button" className={styles.ribbon} aria-label={label} title={label} aria-current={current?'true':undefined} onClick={onClick}><span className={styles.ribbonEmblem}><JournalIcon name={icon} size={14}/></span></button>
  {onRemove&&<button type="button" className={styles.ribbonRemove} aria-label={removeLabel||'Lesezeichen herausnehmen'} title={removeLabel||'Lesezeichen herausnehmen'} onClick={onRemove}>×</button>}
 </span>;
}
/** The loop to lay in a new own bookmark. */
export function RibbonLoop({onClick,label,length}:{onClick:()=>void;label:string;length?:number}){
 return <span className={styles.ribbonWrap} style={length?{'--ribbon-length':length+'px'} as CSSProperties:undefined}><button type="button" className={styles.ribbonLoop} aria-label={label} title={label} onClick={onClick}><JournalIcon name="plus" size={13}/></button></span>;
}

/** Dog-eared page corner for turning. */
export function DogEar({side,label,disabled,onClick,buttonRef}:{side:'left'|'right';label:string;disabled:boolean;onClick:()=>void;buttonRef?:Ref<HTMLButtonElement>}){
 return <button ref={buttonRef} type="button" className={styles.dogEar} data-side={side} aria-label={label} title={label} aria-disabled={disabled} onClick={()=>{if(!disabled)onClick();}}><span aria-hidden/></button>;
}

/** Red wax seal: the save action of an entry. */
export function WaxSeal({label,state,disabled,title}:{label:string;state:'idle'|'dirty'|'saving'|'saved'|'error';disabled:boolean;title?:string}){
 return <button type="submit" className={styles.seal} data-state={state} disabled={disabled} title={title}><span className={styles.sealWax} aria-hidden><JournalIcon name="seal" size={18}/></span><span>{label}</span></button>;
}

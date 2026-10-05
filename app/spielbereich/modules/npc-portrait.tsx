/* eslint-disable @next/next/no-img-element -- Protected existing image service. */
import type {CSSProperties} from 'react';
import type {JsonObject} from '@/domain/types';
import {npcPortraitSettings} from '@/domain/npc-presentation';
import styles from './npc-dossier.module.css';
export function NPCPortrait({image,title,content,initials}:{image?:string;title:string;content:JsonObject;initials:string}){
  const settings=npcPortraitSettings(content);
  return <div className={`${styles.portrait} ${styles.portraitFrame}`} style={{'--npc-fade-start':`${100-settings.mist*.4}%`,'--npc-mist-opacity':settings.mist/100} as CSSProperties}>{image?<img src={image} alt={`Darstellung von ${title}`} style={{transform:`scale(${settings.zoom})`,transformOrigin:`center ${settings.position}%`,objectPosition:`center ${settings.position}%`}}/>:<span aria-hidden="true">{initials}</span>}</div>;
}

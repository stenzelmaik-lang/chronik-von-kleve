"use client";
import { useState } from "react";
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { LiveSession } from './live-session';
import { StoryWorkspace } from './story-workspace';
import { XpSettlementPanel } from './xp-settlement-panel';
import styles from './xp-settlement-panel.module.css';

export function CommandCenter(props: { entries: Entry[]; a: Actor; onRefresh: () => void; preparation?: boolean; onPreparationDirty?: (dirty:boolean)=>void }) {
  const [desk,setDesk]=useState<'story'|'xp'>('story');
  const [storyDirty,setStoryDirty]=useState(false);
  if(props.preparation&&commandCenterAllowed(props.a))return <>
    <nav className={styles.deskTabs} aria-label="Spielabendverwaltung">
      <button type="button" aria-current={desk==='story'?'page':undefined} disabled={storyDirty&&desk!=='story'} onClick={()=>setDesk('story')}>Spielabende & Szenen</button>
      <button type="button" aria-current={desk==='xp'?'page':undefined} disabled={storyDirty} onClick={()=>setDesk('xp')}>EP-Abrechnung</button>
    </nav>
    {desk==='xp'?<XpSettlementPanel a={props.a}/>:<StoryWorkspace a={props.a} onDirty={dirty=>{setStoryDirty(dirty);props.onPreparationDirty?.(dirty);}}/>}
  </>;
  return <LiveSession key={`${props.a.campaignId}:${props.a.id}`} a={props.a}/>;
}

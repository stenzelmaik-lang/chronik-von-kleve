"use client";
import { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { LiveSession } from './live-session';
import { StoryWorkspace } from './story-workspace';
import { XpSessionDesk } from './xp-session-desk';
import styles from './xp-session-access.module.css';

export function CommandCenter(props: { entries: Entry[]; a: Actor; onRefresh: () => void; preparation?: boolean; onPreparationDirty?: (dirty:boolean)=>void }) {
  const [xpOpen,setXpOpen]=useState(false);
  if (props.preparation && commandCenterAllowed(props.a)) return <div>
    <section className={styles.entry} aria-label="Erfahrungspunkte nach Spielabenden">
      <button type="button" className={styles.toggle} aria-expanded={xpOpen} onClick={()=>setXpOpen(open=>!open)}>
        <ClipboardList size={20} aria-hidden="true"/>
        <span><strong>EP-Abrechnung</strong><small>Anwesenheit, Belohnungen und gespielte Abende</small></span>
        {xpOpen?<ChevronUp size={18} aria-hidden="true"/>:<ChevronDown size={18} aria-hidden="true"/>}
      </button>
      {xpOpen&&<XpSessionDesk entries={props.entries}/>}
    </section>
    <StoryWorkspace a={props.a} onDirty={props.onPreparationDirty}/>
  </div>;
  return <LiveSession key={props.a.campaignId+':'+props.a.id} a={props.a}/>;
}

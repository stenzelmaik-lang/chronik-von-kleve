"use client";
import { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp } from 'lucide-react';
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { LiveSession } from './live-session';
import { StoryWorkspace } from './story-workspace';
import { XpSessionDesk } from './xp-session-desk';
import { api } from './api-client';
import type { campaignEngagementOverview } from '@/server/engagement-awards';
import styles from './xp-session-access.module.css';

export function CommandCenter(props: { entries: Entry[]; a: Actor; onRefresh: () => void; preparation?: boolean; onPreparationDirty?: (dirty:boolean)=>void; engagementAvailable?: boolean }) {
  const [xpOpen,setXpOpen]=useState(false);
  const [progress,setProgress]=useState<Awaited<ReturnType<typeof campaignEngagementOverview>> | null>(null);
  const [progressError,setProgressError]=useState('');
  if (props.preparation && commandCenterAllowed(props.a)) return <div>
    <section className={styles.entry} aria-label="Erfahrungspunkte nach Spielabenden">
      <button type="button" className={styles.toggle} aria-expanded={xpOpen} onClick={()=>setXpOpen(open=>!open)}>
        <ClipboardList size={20} aria-hidden="true"/>
        <span><strong>EP-Abrechnung</strong><small>Anwesenheit, Belohnungen und gespielte Abende</small></span>
        {xpOpen?<ChevronUp size={18} aria-hidden="true"/>:<ChevronDown size={18} aria-hidden="true"/>}
      </button>
      {xpOpen&&<XpSessionDesk entries={props.entries}/>}
      {xpOpen && props.engagementAvailable && <details className="panel" onToggle={event => {
        if (!event.currentTarget.open) return;
        setProgress(null); setProgressError('');
        void api<Awaited<ReturnType<typeof campaignEngagementOverview>>>('/api/engagement?view=sl')
          .then(setProgress).catch(error => setProgressError((error as Error).message));
      }}>
        <summary>Engagement-EP im aktuellen Intervall</summary>
        {progressError ? <p role="alert">{progressError}</p> : !progress ? <p role="status">Summen werden geladen …</p> :
          progress.progress.length === 0 ? <p>Für dieses Intervall liegt noch keine bestätigte Vorbereitung vor.</p> :
          <ul>{progress.progress.map((row,index)=><li key={index}>{row.recipient} · {Math.floor(row.verifiedSeconds / 60)} Min. bestätigt · {row.bookedStages.length} von 2 EP gebucht</li>)}</ul>}
      </details>}
    </section>
    <StoryWorkspace a={props.a} onDirty={props.onPreparationDirty}/>
  </div>;
  return <LiveSession key={props.a.campaignId+':'+props.a.id} a={props.a}/>;
}

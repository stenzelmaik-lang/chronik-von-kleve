"use client";
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { CommandWorkspace } from './command-workspace';
import { PlayerSession } from './command-player-session';
import { StoryWorkspace } from './story-workspace';
import { LiveTable } from './live-table';
export function CommandCenter(props: { entries: Entry[]; a: Actor; onRefresh: () => void; preparation?: boolean; onPreparationDirty?: (dirty:boolean)=>void }) {
  if(props.preparation&&commandCenterAllowed(props.a))return <StoryWorkspace a={props.a} onDirty={props.onPreparationDirty}/>;
  return <><LiveTable key={`${props.a.campaignId}:${props.a.id}`} a={props.a}/>{commandCenterAllowed(props.a)?<CommandWorkspace {...props}/>:<PlayerSession {...props}/>}</>;
}

"use client";
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { LiveSession } from './live-session';
import { StoryWorkspace } from './story-workspace';
export function CommandCenter(props: { entries: Entry[]; a: Actor; onRefresh: () => void; preparation?: boolean; onPreparationDirty?: (dirty:boolean)=>void }) {
  if(props.preparation&&commandCenterAllowed(props.a))return <StoryWorkspace a={props.a} onDirty={props.onPreparationDirty}/>;
  return <LiveSession key={`${props.a.campaignId}:${props.a.id}`} a={props.a}/>;
}

"use client";
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { commandCenterAllowed } from '@/domain/command-center';
import { CommandWorkspace } from './command-workspace';
import { PlayerSession } from './command-player-session';
export function CommandCenter(props: { entries: Entry[]; a: Actor; onRefresh: () => void; preparation?: boolean }) {
  return commandCenterAllowed(props.a) ? <CommandWorkspace {...props}/> : <PlayerSession {...props}/>;
}

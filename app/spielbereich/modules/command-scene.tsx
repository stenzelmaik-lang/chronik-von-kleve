"use client";
import { useState } from 'react';
import type { Actor } from '@/domain/types';
import type { Entry } from '@/domain/legacy';
import { SessionPanel } from './session';

// Refresh a clean scene from server state. A local draft retains its original
// revision, so a concurrent SL update produces a conflict, never a blind write.
export function CommandScene({ session, a, onRefresh, onDirty }: { session?: Entry; a: Actor; onRefresh: () => void; onDirty: (dirty: boolean) => void }) {
  const [draftBase, setDraftBase] = useState<{ entry: Entry | undefined; key: string } | null>(null);
  const current = draftBase?.entry || session;
  return <SessionPanel key={draftBase?.key || `${session?.id || 'new'}:${session?.version || 0}`} entries={current ? [current] : []} a={a} compact onRefresh={onRefresh} onDraftChange={dirty => {
    if (dirty) setDraftBase(old => old || { entry: session, key: `${session?.id || 'new'}:${session?.version || 0}` });
    else setDraftBase(null);
    onDirty(dirty);
  }} onSaved={entry => setDraftBase(old => old ? { ...old, entry } : null)}/>;
}

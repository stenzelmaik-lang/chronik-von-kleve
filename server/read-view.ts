import type { Actor } from '../domain/types.ts';
import { gmOnly } from './access.ts';

/** Explicit read context for shared original-object endpoints. */
export function readViewer(a: Actor, view: string | null): Actor {
  if (view === 'sl') {
    gmOnly(a);
    return a;
  }
  if (view === 'player') return { ...a, gm: false, role: 'player' };
  return a;
}

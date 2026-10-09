import {npcFieldNames,isNPCSLKind} from './npc-profile.ts';
import type {NPCSave} from './npc-authoring.ts';

/** Explicit draft action only. Never changes canon status, targets or SL-only kinds. */
export function releaseNPCDraft<T extends NPCSave['blocks'][number]>(draft:NPCSave,blocks:T[]) {
  return {
    draft:{...draft,defaultVisibility:'player_visible' as const,profile:{...draft.profile,field_visibility:{...draft.profile.field_visibility,...Object.fromEntries(Object.keys(npcFieldNames).map(key=>[key,'player_visible' as const]))}},addedRelationships:draft.addedRelationships.map(r=>({...r,visibility:'group' as const}))},
    blocks:blocks.map(b=>({...b,visibility:isNPCSLKind(b.kind)?'sl_secret' as const:'player_visible' as const})),
  };
}

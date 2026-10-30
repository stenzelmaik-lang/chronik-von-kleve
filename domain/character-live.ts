import type { CreationBudgetSummary, XpLedgerEntry, XpPurchase } from './character-engine.ts';
import type { CharacterPermissions, characterXpSummary } from './character-management.ts';

export type CharacterChangeRequest = { id:string; category:string; target:string; value?:string; reason:string; status:string; decision?:string;purchase?:XpPurchase };
export type CharacterEngineView = {
  adjustmentTargets?:Array<{category:string;target:string;value:number;minimum:number;maximum:number}>;
  id:string; ownerId:string; version:number; state:string; enrolled:boolean; owner:boolean; canManage:boolean; canSubmit:boolean;
  title:string;sheet:Record<string,unknown>;deviation:{lines:Array<{key:string;label:string;spent:number;limit:number;over:number}>;over:number};historicalSource:string|null;catchUpReadyAt:string|null;historical:boolean;canAdopt:boolean;needsBaseline:boolean;permissions:CharacterPermissions;
  readiness:{ ready:boolean; reason:string; missing:Array<{label:string;remaining:number;step:string}> };
  budget:CreationBudgetSummary; xp:ReturnType<typeof characterXpSummary>; ledger:XpLedgerEntry[];
  targets:Array<XpPurchase & {label:string;cost:number;available:boolean;hint:string;requiresApproval?:boolean}>;
  requests:CharacterChangeRequest[]; gmNotes?:string;
  history?:Array<{action:string;reason:string;version:number;createdAt:string;changes?:Record<string,{before:unknown;after:unknown}>}>;
};
export type CommandCharacterSummary = { id:string; title:string; ownerId:string; state:string; pendingRequests:number; version:number };

// The authorized record is supplied by the server. No body, note or request text
// belongs in the command-center queue, and stale entity copies are not used.
export function commandCharacterSummary(row:{id:string;title:string;owner_id:string;body:string;version:number}):CommandCharacterSummary|null {
  let body:Record<string,unknown>;
  try { const parsed=JSON.parse(row.body); if (!parsed||typeof parsed!=='object'||Array.isArray(parsed)) return null; body=parsed; } catch { return null; }
  if (body.recoveryOnly===true||body.canonStatus==='GM_SECRET') return null;
  const state=body.engineVersion===1&&['draft','review','confirmed'].includes(String(body.characterState))?String(body.characterState):'legacy';
  const pendingRequests=Array.isArray(body.characterRequests)?body.characterRequests.filter(r=>r&&typeof r==='object'&&r.status==='pending').length:0;
  return {id:row.id,title:row.title,ownerId:row.owner_id,state,pendingRequests,version:row.version};
}

// Alpha 2.0 (#75): minimal SL-only read model for the existing session settlement.
// No new character store and no XP totals: permanent awards remain in body.xpLedger.
import { characterLedger } from "../domain/character-management.ts";
import { parseBody } from "./xp-reward-errors.ts";
import type { SettlementReceipt } from "./xp-settlement-service.ts";

export type XpSettlementCatalog = {
  playedSessions: Array<{
    id: string; title: string; playedOn: string; sessionRecordId: string;
    appointmentId: string | null; settlementStatus: "complete" | "partial" | "failed" | null;
    settlementRevision: number | null;
  }>;
  sessionRecords: Array<{ id: string; title: string }>;
  characters: Array<{ id: string; title: string; ownerId: string; confirmed: true }>;
  storylines: Array<{ id: string; title: string }>;
};

/** Called only after GM role verification in the route. All reads are scoped by campaign. */
export async function xpSettlementCatalog(db: D1Database, campaignId: string): Promise<XpSettlementCatalog> {
  const [played, records, characters, stories] = await Promise.all([
    db.prepare(`SELECT p.id,p.title,p.played_on,p.session_record_id,p.appointment_id,
      x.status AS settlement_status,x.revision AS settlement_revision
      FROM played_sessions p LEFT JOIN xp_settlements x
        ON x.played_session_id=p.id AND x.campaign_id=p.campaign_id
      WHERE p.campaign_id=? ORDER BY p.played_on DESC,p.registered_at DESC LIMIT 200`).bind(campaignId).all<{
        id:string;title:string;played_on:string;session_record_id:string;appointment_id:string|null;
        settlement_status:"complete"|"partial"|"failed"|null;settlement_revision:number|null;
      }>(),
    db.prepare("SELECT id,title,body FROM records WHERE campaign_id=? AND kind='sitzungen' ORDER BY updated_at DESC LIMIT 200")
      .bind(campaignId).all<{id:string;title:string;body:string}>(),
    db.prepare(`SELECT r.id,r.title,r.owner_id,r.body FROM records r
      WHERE r.campaign_id=? AND r.kind='charaktere'
        AND NOT EXISTS(SELECT 1 FROM entities e WHERE e.id=r.id AND e.campaign_id=r.campaign_id AND e.canon_status='GM_SECRET')
      ORDER BY r.title,r.id`).bind(campaignId).all<{id:string;title:string;owner_id:string;body:string}>(),
    db.prepare("SELECT id,title FROM entities WHERE campaign_id=? AND type='storyline' ORDER BY title,id")
      .bind(campaignId).all<{id:string;title:string}>(),
  ]);
  return {
    playedSessions: played.results.map(p => ({
      id:p.id,title:p.title,playedOn:p.played_on,sessionRecordId:p.session_record_id,
      appointmentId:p.appointment_id,settlementStatus:p.settlement_status,
      settlementRevision:p.settlement_revision,
    })),
    sessionRecords:records.results.filter(r=>parseBody(r.body).status==="Abgeschlossen").map(r=>({id:r.id,title:r.title})),
    characters:characters.results.flatMap(c=>{
      const body=parseBody(c.body);
      if(body.engineVersion!==1||body.characterState!=="confirmed"||body.recoveryOnly===true||
         body.canonStatus==="GM_SECRET"||body.archived===true||body.lifecycleStatus==="ARCHIVED") return [];
      return [{id:c.id,title:c.title,ownerId:c.owner_id,confirmed:true as const}];
    }),
    storylines:stories.results.map(s=>({id:s.id,title:s.title||s.id})),
  };
}

export type ReversedReceiptReward = { characterId: string; ledgerEntryId: string };

/** A receipt is immutable; its current reversal state is read from the actual XP ledger. */
export async function receiptReversals(db:D1Database,campaignId:string,receipt:SettlementReceipt|null):Promise<ReversedReceiptReward[]> {
  if(!receipt||receipt.session.campaignId!==campaignId) return [];
  const results=await Promise.all(receipt.participants.map(async participant=>{
    const ids=new Set(participant.rewards.map(r=>r.ledgerEntryId).filter((id):id is string=>!!id));
    if(!ids.size) return [] as ReversedReceiptReward[];
    const row=await db.prepare("SELECT body FROM records WHERE id=? AND campaign_id=? AND kind='charaktere'")
      .bind(participant.characterId,campaignId).first<{body:string}>();
    if(!row) return [] as ReversedReceiptReward[];
    const reversed=new Set(characterLedger(parseBody(row.body)).filter(e=>e.kind==='correction'&&!!e.referenceId).map(e=>e.referenceId));
    return [...ids].filter(id=>reversed.has(id)).map(ledgerEntryId=>({characterId:participant.characterId,ledgerEntryId}));
  }));
  return results.flat();
}

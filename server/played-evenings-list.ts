// Alpha 2.0: small, campaign-scoped read model for the SL's played-evening picker.
// Never infer a played evening from an appointment or from a mutable session record.
export type PlayedEveningSummary = {
  id: string;
  playedOn: string;
  title: string;
  appointmentId: string | null;
  registeredAt: string;
  settlement: null | { id: string; status: "complete" | "partial" | "failed"; revision: number; participants: number; bookedRewards: number; outstandingRewards: number };
};

type EveningRow = {
  id: string; played_on: string; title: string; appointment_id: string | null; registered_at: string;
  settlement_id: string | null; settlement_status: "complete" | "partial" | "failed" | null; revision: number | null;
  participants: number; booked_rewards: number; outstanding_rewards: number;
};

/** Read-only; caller must have verified that the actor is the Spielleitung. */
export async function listPlayedEvenings(db: D1Database, campaignId: string, limit = 50): Promise<PlayedEveningSummary[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Ungültige Seitengröße.");
  const result = await db.prepare(`
    SELECT p.id, p.played_on, p.title, p.appointment_id, p.registered_at,
           s.id AS settlement_id, s.status AS settlement_status, s.revision,
           (SELECT COUNT(*) FROM xp_settlement_participants t WHERE t.settlement_id=s.id) AS participants,
           (SELECT COUNT(*) FROM xp_settlement_rewards r WHERE r.settlement_id=s.id AND r.status='booked') AS booked_rewards,
           (SELECT COUNT(*) FROM xp_settlement_rewards r WHERE r.settlement_id=s.id AND r.status<>'booked') AS outstanding_rewards
    FROM played_sessions p
    LEFT JOIN xp_settlements s ON s.played_session_id=p.id AND s.campaign_id=p.campaign_id
    WHERE p.campaign_id=?
    ORDER BY p.played_on DESC, p.registered_at DESC, p.id DESC
    LIMIT ?
  `).bind(campaignId, limit).all<EveningRow>();
  return result.results.map(row => ({
    id: row.id, playedOn: row.played_on, title: row.title, appointmentId: row.appointment_id, registeredAt: row.registered_at,
    settlement: row.settlement_id === null ? null : {
      id: row.settlement_id,
      status: row.settlement_status!,
      revision: row.revision!,
      participants: row.participants,
      bookedRewards: row.booked_rewards,
      outstandingRewards: row.outstanding_rewards,
    },
  }));
}

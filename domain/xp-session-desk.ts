/** Pure helpers for the existing Alpha-2 XP settlement endpoint. No additional XP storage. */
export type SessionCharacter = { id: string; title: string; state: string; archived: boolean };
export type SessionPlayer = { id: string; name: string; status: string; characters: SessionCharacter[] };
export type ReceiptReward = {
  type: 'session' | 'story' | 'mvp' | 'sl_exception'; scopeId: string; amount: number; reason: string;
  status: 'pending' | 'booked' | 'failed'; ledgerEntryId?: string | null; errorCode?: number | null;
};
export type SessionReceipt = { participants: { characterId: string; attended: boolean; rewards: ReceiptReward[] }[] };
export type ExtraReward = { type: 'story' | 'mvp' | 'sl_exception'; amount: number; reason: string; storyId?: string; status: ReceiptReward['status'] };
export type SessionDraft = {
  characterId: string; playerName: string; title: string; attended: boolean;
  sessionAmount: number; sessionReason: string; sessionLocked: boolean;
  bookedSessionAmount?: number; bookedSessionReason?: string;
  extraRewards: ExtraReward[]; historical?: boolean;
};
export type SettlementRewardRequest = { type: 'session' | 'story' | 'mvp' | 'sl_exception'; amount: number; reason: string; storyId?: string };
export type SettlementPayload = { action: 'xp_settlement'; sessionId: string; entries: {characterId:string; attended:boolean; rewards:SettlementRewardRequest[]}[] };

/** The persisted receipt is authoritative; never silently change booked rewards. */
export function prepareSessionDraft(players: SessionPlayer[], receipt: SessionReceipt | null): SessionDraft[] {
  const participantMap = new Map((receipt?.participants ?? []).map(p => [p.characterId, p]));
  const roster = players.filter(p => p.status === 'active').flatMap(p =>
    p.characters.filter(c => c.state === 'confirmed' && !c.archived).map(c => ({ ...c, playerName: p.name })));
  const missing = (receipt?.participants ?? []).filter(p => !roster.some(c => c.id === p.characterId))
    .map(p => ({ id:p.characterId, title:'Bisheriger Charakter', playerName:'Frühere Teilnahme', historical:true }));
  return [...roster, ...missing].map(c => {
    const previous = participantMap.get(c.id);
    const session = previous?.rewards.find(r => r.type === 'session');
    return {
      characterId:c.id, playerName:c.playerName, title:c.title,
      attended:previous?.attended ?? false,
      sessionAmount:session?.amount ?? 0, sessionReason:session?.reason ?? 'Teilnahme und Charakterspiel',
      sessionLocked:session?.status === 'booked',
      ...(session?.status === 'booked' ? {bookedSessionAmount:session.amount,bookedSessionReason:session.reason} : {}),
      extraRewards:(previous?.rewards ?? []).filter((r): r is ReceiptReward & {type: ExtraReward['type']} => r.type !== 'session')
        .map(r => ({ type:r.type, amount:r.amount, reason:r.reason, status:r.status,
          ...(r.type === 'story' ? {storyId:r.scopeId} : {}) })),
      ...('historical' in c ? {historical:true} : {}),
    } satisfies SessionDraft;
  });
}

export function sessionSettlementPayload(sessionId: string, rows: SessionDraft[]): SettlementPayload {
  if (!sessionId || rows.length < 1 || rows.length > 50) throw new Error('Bitte einen Spielabend und 1 bis 50 Charaktere auswählen.');
  const seen = new Set<string>();
  const entries = rows.map(row => {
    if (seen.has(row.characterId)) throw new Error('Ein Charakter darf nur einmal in der Abrechnung stehen.');
    seen.add(row.characterId);
    if (!Number.isSafeInteger(row.sessionAmount) || row.sessionAmount < 0 || row.sessionAmount > 5)
      throw new Error('Pro Charakter sind 0 bis 5 reguläre Sitzungs-EP erlaubt.');
    if (!row.attended && row.sessionAmount > 0) throw new Error('Ein abwesender Charakter erhält keine regulären Sitzungs-EP.');
    if (row.sessionLocked && (row.sessionAmount !== row.bookedSessionAmount ||
      (row.bookedSessionReason !== undefined && row.sessionReason !== row.bookedSessionReason)))
      throw new Error('Diese Sitzungs-EP sind bereits gebucht und können nur über eine SL-Korrektur geändert werden.');
    const rewards: SettlementRewardRequest[] = [];
    if (row.sessionAmount > 0) {
      if (row.sessionReason.trim().length < 3) throw new Error('Bitte eine Begründung für jede EP-Vergabe angeben.');
      rewards.push({type:'session',amount:row.sessionAmount,reason:row.sessionReason.trim()});
    }
    for (const x of row.extraRewards) {
      if (!Number.isSafeInteger(x.amount) || x.amount < 1 || x.reason.trim().length < 3 ||
        (!row.attended && x.type !== 'sl_exception'))
        throw new Error('Gespeicherte Zusatzvergaben sind ungültig. Bitte die Spielleitung kontaktieren.');
      rewards.push({type:x.type,amount:x.amount,reason:x.reason,...(x.type==='story'?{storyId:x.storyId}:{})});
    }
    return {characterId:row.characterId,attended:row.attended,rewards};
  });
  return { action:'xp_settlement', sessionId, entries };
}

/** HTTP success for this request cannot cover older failed receipt rows. */
export function sessionSettlementComplete(result:{status:string;complete:boolean;receipt:{status:string}}):boolean {
  return result.complete === true && result.status === 'complete' && result.receipt.status === 'complete';
}

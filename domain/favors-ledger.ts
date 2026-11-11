export const favorKinds = ['trade', 'favor', 'debt'] as const;
export const favorDirections = ['owes', 'owed'] as const;
export const favorVisibilities = ['parties', 'sl'] as const;
export const favorActions = ['amend', 'confirm', 'reject', 'call', 'fulfill', 'dispute', 'resolve', 'forgive', 'transfer'] as const;

export type FavorKind = typeof favorKinds[number];
export type FavorDirection = typeof favorDirections[number];
export type FavorVisibility = typeof favorVisibilities[number];
export type FavorAction = typeof favorActions[number];
export type FavorStatus = 'proposed' | 'confirmed' | 'called' | 'partial' | 'disputed' | 'fulfilled' | 'forgiven' | 'rejected';
export type FavorRole = 'sl' | 'creditor' | 'debtor';

export type FavorState = {
  kind: FavorKind; status: FavorStatus; direction: FavorDirection; npcId: string; markers: number; remaining: number;
};

const openStatuses: readonly FavorStatus[] = ['confirmed', 'called', 'partial', 'disputed'];
export function favorDebtMarkers(state: FavorState) {
  return state.kind === 'debt' && state.direction === 'owes' && openStatuses.includes(state.status) ? state.remaining : 0;
}

export type FavorTransition = { action: FavorAction; amount?: number; npcId?: string; markers?: number };
export function transitionFavor(current: FavorState, next: FavorTransition, actor: FavorRole): FavorState {
  const { action } = next;
  if (!openStatuses.includes(current.status) && current.status !== 'proposed') {
    throw new Error('Diese Verpflichtung ist bereits abgeschlossen.');
  }
  if (current.status === 'proposed') {
    if (actor !== 'sl') throw new Error('Über Vorschläge entscheidet die Spielleitung.');
    switch (action) {
      case 'amend': {
        const markers = next.markers ?? current.markers;
        if (!Number.isInteger(markers) || (current.kind === 'debt' ? markers < 1 || markers > 20 : markers !== 0))
          throw new Error('Ungültige Anzahl an Schuldenmarkern.');
        return { ...current, markers, remaining: markers };
      }
      case 'confirm': return { ...current, status: 'confirmed' };
      case 'reject': return { ...current, status: 'rejected', remaining: 0 };
      default: throw new Error('Der Vorschlag wartet auf eine Entscheidung.');
    }
  }
  if (['resolve', 'forgive', 'transfer'].includes(action) && actor !== 'sl') throw new Error('Diese Entscheidung trifft die Spielleitung.');
  if (current.status === 'disputed' && !['resolve', 'forgive', 'transfer'].includes(action)) {
    throw new Error('Die Spielleitung klärt zuerst den Streitfall.');
  }

  switch (action) {
    case 'call':
      if (actor === 'debtor') throw new Error('Nur der Gläubiger kann die Verpflichtung einfordern.');
      if (current.status !== 'confirmed') throw new Error('Die Verpflichtung wurde schon eingefordert.');
      return { ...current, status: 'called' };
    case 'fulfill': {
      const amount = next.amount ?? current.remaining;
      if (!Number.isInteger(amount) || amount < (current.kind === 'debt' ? 1 : 0) || amount > current.remaining)
        throw new Error('Ungültige Anzahl einzulösender Marker.');
      const remaining = current.remaining - amount;
      return { ...current, remaining, status: remaining === 0 ? 'fulfilled' : 'partial' };
    }
    case 'dispute': return { ...current, status: 'disputed' };
    case 'resolve':
      if (current.status !== 'disputed') throw new Error('Diese Verpflichtung ist aktuell nicht bestritten.');
      return { ...current, status: current.remaining < current.markers ? 'partial' : 'confirmed' };
    case 'forgive': return { ...current, status: 'forgiven', remaining: 0 };
    case 'transfer':
      if (!next.npcId || next.npcId === current.npcId) throw new Error('Bitte einen anderen NSC für die Übertragung wählen.');
      return { ...current, npcId: next.npcId };
    default: throw new Error('Dieser Übergang ist für die Verpflichtung nicht verfügbar.');
  }
}

export function availableFavorActions(state: FavorState, actor: FavorRole) {
  return favorActions.filter(action => {
    try {
      transitionFavor(state, { action, npcId: state.npcId + '-other' }, actor);
      return true;
    } catch {
      return false;
    }
  });
}

export function readLegacyFavors(recordId: string, version: number, body: Record<string, unknown>) {
  if (!Array.isArray(body.favors)) return [];
  return body.favors.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || typeof entry.value !== 'number' || !Number.isFinite(entry.value)) return [];
    const id = typeof entry.id === 'string' && /^[\w-]{1,100}$/.test(entry.id) ? entry.id : 'v' + version + '-' + index;
    return [{ key: recordId + ':' + id, npc: String(entry.npc ?? ''), value: entry.value, note: String(entry.note ?? ''),
      date: String(entry.date ?? ''), status: String(entry.status ?? '') }];
  });
}

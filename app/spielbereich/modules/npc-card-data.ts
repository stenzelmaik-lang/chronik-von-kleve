import type { Entity } from '../../../domain/types.ts';

const canonNames: Record<string, string> = { draft: 'Entwurf', open: 'Offen', confirmed: 'Bestätigt', replaced: 'Ersetzt', CANON: 'Kanon', WORKING: 'Arbeitsstand', RUMOR: 'Gerücht', GM_SECRET: 'SL-geheim', PLAYER_KNOWLEDGE: 'Spielerwissen', SUPERSEDED: 'Ersetzt', OPEN: 'Offen' };
const playNames: Record<string, string> = { unplayed: 'Ungespielt', played: 'Gespielt', historical: 'Historisch' };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

// Presentation only: no derived affiliation, category or new stored fields.
export function npcCardData(entity: Entity) {
  return {
    alias: text(entity.content.alias),
    facts: [
      { label: 'Clan', value: text(entity.content.clan) },
      { label: 'Konzept', value: text(entity.content.concept) },
      { label: 'Kanon', value: canonNames[entity.canonStatus] ?? '' },
      { label: 'Spielstand', value: entity.playState ? playNames[entity.playState] ?? '' : '' },
    ].filter(fact => fact.value).slice(0, 5),
    initials: entity.title.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toLocaleUpperCase('de-DE'),
  };
}

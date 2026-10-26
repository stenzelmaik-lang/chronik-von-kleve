import type { PlaceProjection } from './location-types.ts';
import { encodeRichText, isRichTextWithinLimit, readRichText, richTextToPlainText, sanitizeRichTextInput, type RichTextBlock } from './location-rich-text.ts';

export const slDossierChapterTitles = [
  'Schnellübersicht',
  'Architektur und räumlicher Aufbau',
  'Zugänge und angrenzende Räume',
  'Einrichtungen und Ausstattung',
  'Personal und gewöhnlicher Betrieb',
  'Technik und Sicherheit',
  'Verborgene Ortsinformationen',
  'Ergänzende SL-Notizen',
] as const;

export type SlDossierChapter = { key: string; title: string; content: string; searchText: string; overview: boolean };
export type SlDossierEntry = {
  id: string; title: string; kind: string; parentTitle: string;
  children: { id: string; title: string; kind: string }[];
  chapters: SlDossierChapter[]; source: string; image?: string;
};

const normalized = (text: string) => text.toLocaleLowerCase('de-DE').trim();

/** Read-only grouping. Plain text is never guessed to be HTML or rewritten. */
export function slDossierChapters(value: string): SlDossierChapter[] {
  if (!value.trim()) return [];
  const document = readRichText(value);
  if (!document.blocks.some(block => block.type === 'heading2')) {
    return [{ key: 'notes', title: 'Ergänzende SL-Notizen', content: value, searchText: richTextToPlainText(value), overview: false }];
  }
  const groups: { title: string; blocks: RichTextBlock[]; heading?: RichTextBlock }[] = [];
  for (const block of document.blocks) {
    if (block.type === 'heading2') groups.push({ title: block.children.map(part => part.text).join('') || 'Unbenanntes Kapitel', blocks: [], heading: block });
    else {
      if (!groups.length) groups.push({ title: 'Ergänzende SL-Notizen', blocks: [] });
      groups.at(-1)!.blocks.push(block);
    }
  }
  return groups.map((group, index) => {
    const content = encodeRichText({ version: 1, blocks: group.blocks });
    return { key: 'chapter-' + index, title: group.title, content, searchText: richTextToPlainText(content), overview: normalized(group.title) === 'schnellübersicht' };
  });
}

/** Presentation only: retain long historical plain text within the existing
 * editor's structural limit. No value is saved until an explicit user edit. */
export function slDossierEditorValue(value: string): string {
  if (readRichText(value).blocks.length <= 120) return value;
  return encodeRichText({ version: 1, blocks: [{ type: 'paragraph', children: [{ text: value }] }] }) || value;
}

/** Explicit editor action only: append a heading within the existing text field. */
export function appendSlDossierChapter(value: string, title: string): string {
  if (!slDossierChapterTitles.includes(title as typeof slDossierChapterTitles[number])) throw new Error('Bitte ein vorhandenes Kapitel auswählen.');
  const safe = sanitizeRichTextInput(value);
  const document = readRichText(slDossierEditorValue(safe));
  const next = encodeRichText({ version: 1, blocks: [...document.blocks, { type: 'heading2', children: [{ text: title }] }, { type: 'paragraph', children: [] }] });
  if (!next || !isRichTextWithinLimit(next, 5000)) throw new Error('Das Kapitel passt nicht mehr in diesen Text. Bitte kürze den Text oder vereinfache die Formatierung; dein bisheriger Inhalt bleibt erhalten.');
  return next;
}

/** Same stable identities as the existing server projection, no separate data store. */
export function slDossierEntries(projection: PlaceProjection): SlDossierEntry[] {
  if (projection.view !== 'sl' || projection.actualRole !== 'gm' || !projection.canSwitchToSl) return [];
  const place = projection.location;
  const notes = new Map((place.slNotes ?? []).map(note => [note.entityId, note]));
  const entry = (id: string, title: string, kind: string, parentTitle: string, children: SlDossierEntry['children'] = [], fallback = ''): SlDossierEntry => {
    const note = notes.get(id);
    return { id, title, kind, parentTitle, children, chapters: slDossierChapters(note?.text || fallback), source: note?.source ?? '', ...(note?.image ? { image: note.image } : {}) };
  };
  return [
    entry(place.id, place.title, 'Hauptort', '', place.areas.map(area => ({ id: area.viewKey, title: area.title, kind: 'Bereich' }))),
    ...place.areas.flatMap(area => [
      entry(area.viewKey, area.title, 'Bereich', place.title, area.rooms.map(room => ({ id: room.viewKey, title: room.title, kind: 'Raum' }))),
      ...area.rooms.map(room => entry(room.viewKey, room.title, 'Raum', area.title)),
    ]),
    ...place.knownInformation.filter(info => info.visibility === 'gm' || notes.has(info.id)).map(info => entry(info.id, info.title, 'Erkenntnis', place.title, [], info.visibility === 'gm' ? info.text : '')),
  ];
}

export function searchSlDossier(entries: SlDossierEntry[], query: string): SlDossierEntry[] {
  const needle = normalized(query);
  if (!needle) return entries;
  return entries.flatMap(entry => {
    const matchesTitle = normalized(entry.title + ' ' + entry.parentTitle).includes(needle);
    const chapters = matchesTitle ? entry.chapters : entry.chapters.filter(chapter => normalized(chapter.title + ' ' + chapter.searchText).includes(needle));
    return chapters.length || matchesTitle ? [{ ...entry, chapters }] : [];
  });
}

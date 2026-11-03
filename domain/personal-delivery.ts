/**
 * Visions & personal messages, Alpha 2.0 ("NextGen").
 * Preparation lives in the scene document (`whispers`); every trigger creates a separate delivery run with its own
 * per-recipient receipts. Presets and layouts are data: a new look is a new entry here plus its CSS, not new logic.
 * Leaf module without imports.
 */

/** Vision presets. `motion` and the timing values steer the player; colours and effects live in the CSS per preset. */
export const VISION_PRESETS = [
  { id: 'classic', label: 'Klassische Vision', mood: 'Mystisch, geheimnisvoll, übernatürlich', description: 'Silbergraue und leicht goldene Nebelschichten, ruhige Textfragmente, dezente Lichtstrahlen.', enterMs: 2600, baseMs: 4200, perCharMs: 55, imageMotion: 'float' },
  { id: 'dream', label: 'Traumvision', mood: 'Surreal, melancholisch, entrückt', description: 'Blauer und türkisfarbener Dunst, weiche Reflexe, treibende Bildfragmente mit Unschärfe.', enterMs: 3000, baseMs: 4600, perCharMs: 60, imageMotion: 'drift' },
  { id: 'dark', label: 'Dunkle Vision', mood: 'Unheimlich, verborgen, bedrückend', description: 'Tiefes Schwarz und Grau, dichter Nebel, schwache Lichtquellen, Bilder aus dem Schatten.', enterMs: 2800, baseMs: 4400, perCharMs: 58, imageMotion: 'surface' },
  { id: 'threat', label: 'Bedrohliche Vision', mood: 'Gefahr, Kontrollverlust, Grauen', description: 'Schwarze Nebelmassen, rote Lichtreflexe, langsam bewegte Schattententakel, gedämpftes Flackern.', enterMs: 2400, baseMs: 4000, perCharMs: 55, imageMotion: 'pulse' },
  { id: 'drama', label: 'Dramatische Vision', mood: 'Schicksal, Offenbarung, Katastrophe', description: 'Dunkles Purpur, goldene und rote Lichtdurchbrüche, markante Textinszenierung.', enterMs: 2400, baseMs: 4000, perCharMs: 52, imageMotion: 'reveal' },
  { id: 'echo', label: 'Erinnerung / Echo', mood: 'Vergangenheit, Verlust, Verdrängtes', description: 'Verblasste Farben, Sepia und kaltes Grau, Körnung, wiederkehrende Satzfragmente.', enterMs: 3000, baseMs: 4800, perCharMs: 62, imageMotion: 'fade' },
] as const;
export type VisionPresetId = typeof VISION_PRESETS[number]['id'];
export const VISION_PRESET_IDS = VISION_PRESETS.map(p => p.id) as unknown as readonly [VisionPresetId, ...VisionPresetId[]];
export const presetById = (id: string | undefined) => VISION_PRESETS.find(p => p.id === id) ?? VISION_PRESETS[0];

/** Message layouts. Fax is the first full design; the letter keeps the existing paper look. Further layouts follow. */
export const MESSAGE_LAYOUTS = [
  { id: 'fax', label: 'Fax / Dokument', description: 'Ein Blatt läuft aus dem Faxschlitz in die Ansicht, mit Kennung, Absender und Zeit.' },
  { id: 'letter', label: 'Vertraulicher Brief', description: 'Briefpapier mit ruhiger Serifenschrift, gleitet von der Seite herein.' },
] as const;
export type MessageLayoutId = typeof MESSAGE_LAYOUTS[number]['id'];
export const MESSAGE_LAYOUT_IDS = MESSAGE_LAYOUTS.map(l => l.id) as unknown as readonly [MessageLayoutId, ...MessageLayoutId[]];
/** Planned, not yet available: listed so the editor can say what comes next. */
export const PLANNED_LAYOUTS = ['Telegramm', 'Digitale Nachricht', 'Pager-Meldung', 'Verschlüsselte Mitteilung'] as const;

export const MAX_FRAGMENTS = 20;
export const MAX_FRAGMENT_CHARS = 600;

/** Text fragments of a vision: explicit sections win; otherwise the paragraphs of the plain text, long ones split at sentences. */
export function visionFragments(explicit: readonly string[] | undefined, plainText: string): string[] {
  const chosen = (explicit ?? []).map(s => s.trim()).filter(Boolean);
  const source = chosen.length ? chosen : plainText.split(/\n\s*\n|\r?\n/).map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const block of source) {
    if (block.length <= MAX_FRAGMENT_CHARS) { out.push(block); continue; }
    let rest = block;
    while (rest.length > MAX_FRAGMENT_CHARS) {
      const limit = MAX_FRAGMENT_CHARS - 1; // the cut keeps the punctuation, so search one before the limit
      const cut = Math.max(rest.lastIndexOf('. ', limit), rest.lastIndexOf('! ', limit), rest.lastIndexOf('? ', limit));
      const at = cut > 120 ? cut + 1 : MAX_FRAGMENT_CHARS;
      out.push(rest.slice(0, at).trim()); rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out.slice(0, MAX_FRAGMENTS);
}

/** How long a fragment stays fully readable. Long texts get more time; reduced motion adds reading time instead of effects. */
export function fragmentDuration(text: string, presetId: string | undefined, reduced = false): number {
  const p = presetById(presetId);
  const ms = p.baseMs + text.length * p.perCharMs;
  return Math.round(Math.max(3500, Math.min(16000, reduced ? ms * 1.15 : ms)));
}

export type Receipt = { seenAt?: string; ackAt?: string };
export type DeliveryRun = {
  id: string; whisperId: string; sceneId: string; sceneVersion: number;
  kind: 'vision' | 'letter'; preset: VisionPresetId; layout: MessageLayoutId;
  /** internal title, GM only */
  title: string; sender: string;
  fragments: string[]; html: string; imageFileIds: string[]; audioFileId: string | null;
  recipients: string[]; createdAt: string; createdBy: string; withdrawnAt: string | null;
  receipts: Record<string, Receipt>;
};
export type DeliveryStatus = 'pending' | 'running' | 'acknowledged' | 'withdrawn';
export function deliveryStatus(run: DeliveryRun, memberId: string): DeliveryStatus {
  const r = run.receipts[memberId] ?? {};
  if (r.ackAt) return 'acknowledged';
  if (run.withdrawnAt) return 'withdrawn';
  return r.seenAt ? 'running' : 'pending';
}
export const statusLabel: Record<DeliveryStatus, string> = { pending: 'wird zugestellt', running: 'sieht es gerade', acknowledged: 'bestätigt', withdrawn: 'zurückgezogen' };

export type RecipientChoice = { mode: 'prepared' } | { mode: 'all' } | { mode: 'players'; playerIds: string[] };
/** Resolve the trigger's recipients against the players at the table. Never silently falls back to another group. */
export function resolveRecipients(choice: RecipientChoice, prepared: readonly string[], players: readonly string[]): string[] {
  const list = choice.mode === 'all' ? [...players] : choice.mode === 'prepared' ? [...prepared] : [...new Set(choice.playerIds)];
  if (!list.length) throw new Error(choice.mode === 'prepared' ? 'Für diesen Eintrag sind keine Empfänger vorbereitet.' : 'Wähle mindestens einen Spieler.');
  const missing = list.filter(id => !players.includes(id));
  if (missing.length) throw new Error('Mindestens ein Empfänger nimmt nicht an dieser Runde teil.');
  return list;
}

/** What a recipient gets: only own, active runs, without internal title, other recipients or scene origin. */
/** `images` are file ids of this delivery; they open only through the recipient-checked delivery asset route. */
export type PlayerDelivery = { id: string; kind: 'vision' | 'letter'; preset: VisionPresetId; layout: MessageLayoutId; sender: string; fragments: string[]; html: string; images: string[]; audio: boolean; audioFileId: string | null; createdAt: string; seen: boolean };
export function playerDeliveries(runs: readonly DeliveryRun[], memberId: string): PlayerDelivery[] {
  return runs.filter(r => r.recipients.includes(memberId) && !r.withdrawnAt && !r.receipts[memberId]?.ackAt)
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt) || x.id.localeCompare(y.id))
    .map(r => ({ id: r.id, kind: r.kind, preset: r.preset, layout: r.layout, sender: r.sender, fragments: r.fragments, html: r.html, images: [...r.imageFileIds], audio: !!r.audioFileId, audioFileId: r.audioFileId, createdAt: r.createdAt, seen: !!r.receipts[memberId]?.seenAt }));
}

/** Short document number for the fax header, derived from the run id. */
export const documentNumber = (id: string) => 'CP-' + id.replace(/[^a-f0-9]/gi, '').slice(0, 6).toUpperCase();

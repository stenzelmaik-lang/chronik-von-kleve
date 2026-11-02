/**
 * Standard figure library (Alpha 2.0, phase 1): 30 fixed types x 5 challenge tiers = 150 variants.
 * Hard-coded, versioned template data; no database. Values are DRAFT values ("entwurf"):
 * they are plausible starting points for the GM, not yet checked against the V20 rulebook.
 * Dice pools are only attribute + ability dots (plus wound penalty); the roll itself goes through
 * the existing shared dice (evaluateNormalV20). Leaf module without imports.
 */
export const STANDARD_FIGURES_VERSION = 'entwurf-1';
export const FIGURE_STATUS = 'entwurf' as const;

export const ATTRIBUTES = ['Körperkraft', 'Geschick', 'Widerstandsfähigkeit', 'Charisma', 'Manipulation', 'Erscheinungsbild', 'Wahrnehmung', 'Intelligenz', 'Geistesschärfe'] as const;
export type AttributeKey = typeof ATTRIBUTES[number];

export const TIERS = [
  { id: 'easy', label: 'Leicht', delta: -1, purpose: 'Kurze, einfache Herausforderung' },
  { id: 'standard', label: 'Normal', delta: 0, purpose: 'Alltagsbegegnung' },
  { id: 'hard', label: 'Schwer', delta: 1, purpose: 'Ernstzunehmende Gegenwehr' },
  { id: 'very_hard', label: 'Sehr schwer', delta: 2, purpose: 'Gefahr auch für vorbereitete Charaktere' },
  { id: 'extreme', label: 'Extrem schwer', delta: 3, purpose: 'Außergewöhnlich schwer zu überwinden' },
] as const;
export type TierId = typeof TIERS[number]['id'];

export const CATEGORIES = [
  { id: 'security', label: 'Sicherheit & Ordnung' },
  { id: 'civilian', label: 'Zivilisten' },
  { id: 'criminal', label: 'Kriminelle & Gegner' },
  { id: 'animal', label: 'Tiere' },
  { id: 'supernatural', label: 'Übernatürliche' },
] as const;
export type CategoryId = typeof CATEGORIES[number]['id'];

/** V20 health track: penalty applied to every dice pool at that level; the last level means incapacitated. */
export const HEALTH_LEVELS = [
  { label: 'Gequetscht', penalty: 0 }, { label: 'Verletzt', penalty: 1 }, { label: 'Schwer verletzt', penalty: 1 },
  { label: 'Verwundet', penalty: 2 }, { label: 'Übel zugerichtet', penalty: 2 }, { label: 'Verkrüppelt', penalty: 5 },
  { label: 'Kampfunfähig', penalty: null },
] as const;

type Species = 'mensch' | 'tier' | 'ghul' | 'vampir';
/** [attribute, ability or ''] -> a quick action whose pool is attribute + ability. */
type Act = readonly [label: string, attribute: AttributeKey, ability: string];
type Spec = {
  id: string; cat: CategoryId; name: string; desc: string; sp: Species;
  /** attributes in ATTRIBUTES order at tier "Normal" */
  a: readonly number[]; s: Readonly<Record<string, number>>;
  /** traits that grow (or shrink) with the tier */
  up: readonly string[];
  /** highest tier step that still counts as a single figure; above it the tier is an encounter, not raw strength */
  cap: number; wp: number; blood?: number;
  act: readonly Act[]; beh: string; ceil: string; ext?: string;
};

const BEO: Act = ['Beobachten', 'Wahrnehmung', 'Aufmerksamkeit'];
const SCH: Act = ['Zuschlagen', 'Geschick', 'Handgemenge'];
const AUS: Act = ['Ausweichen', 'Geschick', 'Sportlichkeit'];
const FLU: Act = ['Fliehen', 'Geschick', 'Sportlichkeit'];
const HEI: Act = ['Heimlich bewegen', 'Geschick', 'Heimlichkeit'];
const NAH: Act = ['Nahkampfangriff', 'Geschick', 'Nahkampf'];
const SCHU: Act = ['Schusswaffe', 'Geschick', 'Schusswaffen'];
const BISS: Act = ['Beißen', 'Geschick', 'Handgemenge'];

// order of a: Kör Ges Wid Cha Man Ers Wah Int Gei
const SPECS: readonly Spec[] = [
  { id: 'security_bouncer', cat: 'security', name: 'Türsteher', desc: 'Kontrolliert den Einlass und wahrt den Hausfrieden.', sp: 'mensch', a: [3, 2, 3, 2, 2, 2, 3, 2, 3], s: { Handgemenge: 3, Einschüchtern: 3, Aufmerksamkeit: 3, Szenekenntnis: 2, Sportlichkeit: 2 }, up: ['Handgemenge', 'Einschüchtern', 'Aufmerksamkeit', 'Körperkraft'], cap: 3, wp: 5, act: [BEO, ['Täuschung erkennen', 'Wahrnehmung', 'Empathie'], ['Einschüchtern', 'Charisma', 'Einschüchtern'], ['Verhandeln', 'Manipulation', 'Szenekenntnis'], ['Packen / Abwehren', 'Körperkraft', 'Handgemenge'], SCH], beh: 'Kontrolliert, arbeitsbezogen, nicht automatisch feindselig. Prüft Einlass, wahrt Hausfrieden, holt bei Ärger Verstärkung.', ceil: 'Erfahrener Profi mit Hausrecht und Team im Rücken.' },
  { id: 'security_guard_basic', cat: 'security', name: 'Einfacher Wachmann', desc: 'Dienst nach Vorschrift, wenig Ausbildung.', sp: 'mensch', a: [2, 2, 2, 2, 2, 2, 3, 2, 2], s: { Aufmerksamkeit: 2, Handgemenge: 1, Einschüchtern: 1 }, up: ['Aufmerksamkeit', 'Handgemenge'], cap: 2, wp: 4, act: [BEO, ['Anhalten', 'Charisma', 'Einschüchtern'], SCH, FLU], beh: 'Folgt Vorschriften, ruft bei Problemen Hilfe, meidet unnötige Gewalt.', ceil: 'Unterstütztes Sicherheitskonzept mit Alarm und Verstärkung.' },
  { id: 'security_guard_senior', cat: 'security', name: 'Erfahrener Sicherheitsmitarbeiter', desc: 'Routiniert, führt kleine Teams.', sp: 'mensch', a: [3, 3, 3, 2, 3, 2, 3, 3, 3], s: { Aufmerksamkeit: 3, Handgemenge: 2, Führungsqualitäten: 2, Einschüchtern: 2 }, up: ['Aufmerksamkeit', 'Führungsqualitäten', 'Handgemenge'], cap: 3, wp: 6, act: [BEO, ['Anweisen', 'Charisma', 'Führungsqualitäten'], ['Einschüchtern', 'Manipulation', 'Einschüchtern'], SCH], beh: 'Ruhig und taktisch, koordiniert Kollegen, eskaliert nur mit Plan.', ceil: 'Führungs- und Taktikkompetenz, gute Vorbereitung.' },
  { id: 'security_bodyguard', cat: 'security', name: 'Leibwächter', desc: 'Schützt eine Person, bleibt wachsam.', sp: 'mensch', a: [3, 3, 3, 2, 2, 2, 4, 2, 3], s: { Aufmerksamkeit: 3, Handgemenge: 3, Sportlichkeit: 2, Schusswaffen: 2 }, up: ['Aufmerksamkeit', 'Handgemenge', 'Sportlichkeit'], cap: 3, wp: 6, act: [BEO, ['Schützen / Abschirmen', 'Körperkraft', 'Handgemenge'], SCHU, AUS], beh: 'Bleibt bei der Schutzperson, deckt den Rückzug, kämpft nur zur Verteidigung.', ceil: 'Schutzprofil, Absicherung und kontrollierter Rückzug.' },
  { id: 'security_patrol_officer', cat: 'security', name: 'Streifenpolizist', desc: 'Ausgebildet, hat Funk und Verstärkung.', sp: 'mensch', a: [2, 3, 3, 2, 3, 2, 3, 2, 3], s: { Aufmerksamkeit: 3, Gesetzeskenntnis: 2, Handgemenge: 2, Schusswaffen: 2, Einschüchtern: 2 }, up: ['Aufmerksamkeit', 'Schusswaffen', 'Handgemenge'], cap: 3, wp: 6, act: [BEO, ['Befragen', 'Manipulation', 'Gesetzeskenntnis'], ['Festnehmen', 'Körperkraft', 'Handgemenge'], SCHU], beh: 'Amtlich und bestimmt, funkt Verstärkung, dokumentiert Vorfälle.', ceil: 'Funk, Einsatzlage und Verstärkung; keine Unverwundbarkeit.' },
  { id: 'security_armed_guard', cat: 'security', name: 'Bewaffneter Sicherheitsmann', desc: 'Legal bewaffneter Objektschutz.', sp: 'mensch', a: [3, 3, 3, 2, 2, 2, 3, 2, 3], s: { Aufmerksamkeit: 2, Schusswaffen: 2, Handgemenge: 2, Einschüchtern: 2 }, up: ['Schusswaffen', 'Aufmerksamkeit', 'Handgemenge'], cap: 3, wp: 5, act: [BEO, SCHU, SCH, ['Warnen', 'Charisma', 'Einschüchtern']], beh: 'Warnt zuerst, greift bei echter Bedrohung zur Waffe; Folgen sind SL-Sache.', ceil: 'Angemessene, legale Einsatzumstände; Waffen und Folgen getrennt.' },

  { id: 'civilian_passerby', cat: 'civilian', name: 'Gewöhnlicher Passant', desc: 'Zufällig anwesend, ohne Kampftraining.', sp: 'mensch', a: [2, 2, 2, 2, 2, 2, 2, 2, 2], s: { Aufmerksamkeit: 1 }, up: ['Aufmerksamkeit', 'Ausflüchte'], cap: 2, wp: 3, act: [BEO, ['Ausweichen', 'Geschick', 'Sportlichkeit'], FLU, ['Hilfe rufen', 'Charisma', 'Ausdruck']], beh: 'Weicht aus, schaut weg, ruft im Zweifel Hilfe.', ceil: 'Schwer unbemerkt zu täuschen oder festzuhalten; keine Superkraft.' },
  { id: 'civilian_bar_patron', cat: 'civilian', name: 'Bargast', desc: 'Stammgast mit Bekannten im Lokal.', sp: 'mensch', a: [2, 2, 2, 3, 2, 2, 2, 2, 2], s: { Szenekenntnis: 2, Ausdruck: 2, Empathie: 1 }, up: ['Szenekenntnis', 'Empathie', 'Ausdruck'], cap: 2, wp: 3, act: [BEO, ['Plaudern', 'Charisma', 'Ausdruck'], ['Gerüchte kennen', 'Intelligenz', 'Szenekenntnis'], FLU], beh: 'Gesprächig, kennt die Gäste, hat Freunde in der Nähe.', ceil: 'Erfahrung, soziale Kontrolle, Zeugen oder Freunde.' },
  { id: 'civilian_intoxicated_guest', cat: 'civilian', name: 'Betrunkener Gast', desc: 'Unberechenbar und enthemmt.', sp: 'mensch', a: [2, 1, 2, 2, 1, 2, 1, 1, 1], s: { Handgemenge: 1 }, up: ['Handgemenge', 'Körperkraft'], cap: 1, wp: 2, act: [['Pöbeln', 'Charisma', 'Einschüchtern'], SCH, ['Torkelnd fliehen', 'Geschick', 'Sportlichkeit']], beh: 'Laut und sprunghaft, vergisst schnell, kann Situationen ungewollt eskalieren.', ceil: 'Unberechenbarkeit und Situationsfolgen, nicht Kampfkraft.' },
  { id: 'civilian_shopkeeper', cat: 'civilian', name: 'Verkäufer', desc: 'Kennt Ware, Kunden und Umfeld.', sp: 'mensch', a: [2, 2, 2, 3, 3, 2, 3, 2, 2], s: { Finanzen: 2, Empathie: 2, Ausdruck: 2, Aufmerksamkeit: 2 }, up: ['Empathie', 'Finanzen', 'Aufmerksamkeit'], cap: 2, wp: 4, act: [BEO, ['Verhandeln', 'Manipulation', 'Finanzen'], ['Menschenkenntnis', 'Wahrnehmung', 'Empathie'], ['Alarm auslösen', 'Intelligenz', 'Technologie']], beh: 'Freundlich, aber misstrauisch bei Ungewöhnlichem; hat Alarm und Nachbarn.', ceil: 'Umfeldkenntnis, Alarm, Unterstützung und Verhandlungsmacht.' },
  { id: 'civilian_taxi_driver', cat: 'civilian', name: 'Taxifahrer', desc: 'Ortskundig, nachts viel unterwegs.', sp: 'mensch', a: [2, 3, 2, 2, 2, 2, 3, 2, 3], s: { Fahren: 3, Szenekenntnis: 2, Aufmerksamkeit: 2 }, up: ['Fahren', 'Szenekenntnis', 'Aufmerksamkeit'], cap: 2, wp: 4, act: [BEO, ['Fahren', 'Geschick', 'Fahren'], ['Ortskenntnis', 'Intelligenz', 'Szenekenntnis'], ['Beruhigen', 'Charisma', 'Empathie']], beh: 'Redselig, vorsichtig bei Gewalt, fährt im Zweifel weg und ruft die Zentrale.', ceil: 'Erfahrung, Mobilität, Ortskenntnis und Sicherheitsroutine.' },
  { id: 'civilian_employee', cat: 'civilian', name: 'Einfacher Angestellter', desc: 'Kennt Betriebsabläufe und Berechtigungen.', sp: 'mensch', a: [2, 2, 2, 2, 2, 2, 2, 3, 2], s: { Computer: 2, Etikette: 1, Aufmerksamkeit: 1 }, up: ['Computer', 'Etikette', 'Aufmerksamkeit'], cap: 2, wp: 3, act: [BEO, ['Abläufe erklären', 'Intelligenz', 'Etikette'], ['Ausreden', 'Manipulation', 'Ausflüchte'], ['Nachschlagen', 'Intelligenz', 'Computer']], beh: 'Hält sich an Regeln, will keinen Ärger, kennt Schlüssel und Zeiten.', ceil: 'Orts- und Betriebskenntnis, Abläufe und Berechtigungen.' },

  { id: 'criminal_street_thug', cat: 'criminal', name: 'Straßenschläger', desc: 'Schlägt zu, bevor er nachdenkt.', sp: 'mensch', a: [3, 2, 3, 2, 2, 2, 2, 2, 3], s: { Handgemenge: 3, Einschüchtern: 2, Szenekenntnis: 2, Sportlichkeit: 2 }, up: ['Handgemenge', 'Einschüchtern', 'Körperkraft'], cap: 3, wp: 4, act: [BEO, SCH, ['Bedrohen', 'Charisma', 'Einschüchtern'], FLU], beh: 'Aggressiv und impulsiv, sucht Gruppen, flieht bei klarer Unterlegenheit.', ceil: 'Erfahrene Gewaltperson mit Unterstützung.' },
  { id: 'criminal_enforcer', cat: 'criminal', name: 'Erfahrener Schläger', desc: 'Diszipliniert, arbeitet im Auftrag.', sp: 'mensch', a: [4, 3, 3, 2, 3, 2, 3, 2, 3], s: { Handgemenge: 4, Einschüchtern: 3, Szenekenntnis: 2, Sportlichkeit: 2, Nahkampf: 2 }, up: ['Handgemenge', 'Einschüchtern', 'Nahkampf'], cap: 3, wp: 6, act: [BEO, SCH, NAH, ['Bedrohen', 'Manipulation', 'Einschüchtern']], beh: 'Kalt und zielstrebig, folgt dem Auftrag, kämpft in der Gruppe.', ceil: 'Disziplinierte Gewalt und Gruppentaktik.' },
  { id: 'criminal_burglar', cat: 'criminal', name: 'Einbrecher', desc: 'Leise, vorbereitet, fluchtorientiert.', sp: 'mensch', a: [2, 4, 2, 2, 2, 2, 3, 3, 3], s: { Heimlichkeit: 3, Diebstahl: 3, Sportlichkeit: 2, Aufmerksamkeit: 2, Technologie: 2 }, up: ['Heimlichkeit', 'Diebstahl', 'Technologie'], cap: 3, wp: 5, act: [BEO, HEI, ['Schloss öffnen', 'Geschick', 'Diebstahl'], FLU], beh: 'Meidet Konfrontation, flieht über vorbereitete Wege, lässt Beute fallen.', ceil: 'Flucht, Heimlichkeit, Geräte und Vorbereitung.' },
  { id: 'criminal_petty', cat: 'criminal', name: 'Kleinkrimineller', desc: 'Taschendieb oder Dealer mit Straßenkontakten.', sp: 'mensch', a: [2, 3, 2, 2, 3, 2, 3, 2, 3], s: { Diebstahl: 2, Ausflüchte: 2, Szenekenntnis: 3, Heimlichkeit: 2 }, up: ['Ausflüchte', 'Szenekenntnis', 'Diebstahl'], cap: 2, wp: 4, act: [BEO, ['Täuschen', 'Manipulation', 'Ausflüchte'], ['Taschendiebstahl', 'Geschick', 'Diebstahl'], FLU], beh: 'Redet sich heraus, meidet Gewalt, kennt die richtigen Leute.', ceil: 'Straßenkontakte, Täuschung und Rückzug.' },
  { id: 'criminal_armed_gangster', cat: 'criminal', name: 'Bewaffneter Gangster', desc: 'Kampferfahren, hat Deckung und Verbündete.', sp: 'mensch', a: [3, 3, 3, 2, 3, 2, 3, 2, 3], s: { Schusswaffen: 3, Handgemenge: 2, Einschüchtern: 2, Szenekenntnis: 2, Heimlichkeit: 1 }, up: ['Schusswaffen', 'Handgemenge', 'Einschüchtern'], cap: 3, wp: 6, act: [BEO, SCHU, SCH, ['Bedrohen', 'Charisma', 'Einschüchtern']], beh: 'Sucht Deckung, ruft Verbündete, schießt zuerst bei Bedrohung.', ceil: 'Kampferfahrung, Deckung und Verbündete.' },
  { id: 'criminal_contract_fighter', cat: 'criminal', name: 'Professioneller Auftragskämpfer', desc: 'Spitzenausbildung im menschlichen Rahmen.', sp: 'mensch', a: [4, 4, 3, 2, 3, 2, 4, 3, 4], s: { Schusswaffen: 4, Nahkampf: 3, Handgemenge: 3, Heimlichkeit: 3, Sportlichkeit: 3, Aufmerksamkeit: 3 }, up: ['Schusswaffen', 'Nahkampf', 'Handgemenge', 'Heimlichkeit'], cap: 3, wp: 7, act: [BEO, SCHU, NAH, HEI], beh: 'Professionell, plant den Rückzug, kämpft nicht für Ehre.', ceil: 'Spitzenfähigkeiten innerhalb menschlicher Grenzen.' },

  { id: 'animal_dog_pet', cat: 'animal', name: 'Haushund', desc: 'Treu, aber kein Kämpfer.', sp: 'tier', a: [2, 3, 2, 1, 1, 2, 4, 1, 3], s: { Aufmerksamkeit: 3, Handgemenge: 1, Sportlichkeit: 2 }, up: ['Aufmerksamkeit', 'Handgemenge'], cap: 1, wp: 3, act: [['Wittern', 'Wahrnehmung', 'Aufmerksamkeit'], BISS, ['Bellen / Warnen', 'Charisma', 'Einschüchtern'], FLU], beh: 'Schützt sein Zuhause, bellt, beißt nur bei Bedrohung.', ceil: 'Schutz- und Rudelkontext statt überzogener Einzelwerte.', ext: 'Hohe Stufen: mehrere Hunde oder bekannter Besitzer als Begegnung.' },
  { id: 'animal_dog_guard', cat: 'animal', name: 'Wachhund', desc: 'Ausgebildet, gehorcht seinem Führer.', sp: 'tier', a: [3, 3, 3, 1, 1, 2, 4, 1, 3], s: { Aufmerksamkeit: 3, Handgemenge: 3, Sportlichkeit: 3, Einschüchtern: 2 }, up: ['Handgemenge', 'Aufmerksamkeit', 'Einschüchtern'], cap: 2, wp: 4, act: [['Wittern', 'Wahrnehmung', 'Aufmerksamkeit'], BISS, ['Stellen / Halten', 'Körperkraft', 'Handgemenge'], FLU], beh: 'Greift auf Befehl an, hält Eindringlinge fest, lässt sich schwer ablenken.', ceil: 'Ausbildung, Trieb und Führung; mehrere Hunde möglich.', ext: 'Hohe Stufen: Mehrere Hunde plus Führer als Begegnung.' },
  { id: 'animal_wolf', cat: 'animal', name: 'Wolf', desc: 'Scheu, im Rudel gefährlich.', sp: 'tier', a: [3, 3, 3, 1, 1, 2, 4, 1, 3], s: { Aufmerksamkeit: 3, Handgemenge: 3, Sportlichkeit: 3, Heimlichkeit: 2, Überleben: 3 }, up: ['Handgemenge', 'Heimlichkeit', 'Aufmerksamkeit'], cap: 2, wp: 5, act: [['Wittern', 'Wahrnehmung', 'Aufmerksamkeit'], BISS, ['Umkreisen', 'Geschick', 'Heimlichkeit'], FLU], beh: 'Meidet Menschen, greift im Rudel und in Bedrängnis an.', ceil: 'Rudel und Gelände sind maßgeblich.', ext: 'Hohe Stufen: Rudel als Begegnung.' },
  { id: 'animal_rat', cat: 'animal', name: 'Ratte', desc: 'Klein, schnell, in Massen lästig.', sp: 'tier', a: [1, 3, 1, 1, 1, 1, 3, 1, 3], s: { Aufmerksamkeit: 2, Heimlichkeit: 3, Sportlichkeit: 2 }, up: ['Heimlichkeit', 'Aufmerksamkeit'], cap: 0, wp: 2, act: [['Wittern', 'Wahrnehmung', 'Aufmerksamkeit'], ['Beißen', 'Geschick', 'Handgemenge'], HEI, FLU], beh: 'Flieht zuerst, beißt nur in die Enge getrieben.', ceil: 'Hohe Stufen bedeuten Schwarm, nie eine einzelne Superratte.', ext: 'Hohe Stufen: Schwarm in engem Raum als Begegnung.' },
  { id: 'animal_raven', cat: 'animal', name: 'Rabe', desc: 'Klug, aufmerksam, Beobachter.', sp: 'tier', a: [1, 3, 1, 1, 2, 1, 4, 2, 3], s: { Aufmerksamkeit: 3, Heimlichkeit: 1, Sportlichkeit: 3 }, up: ['Aufmerksamkeit', 'Sportlichkeit'], cap: 0, wp: 3, act: [['Spähen', 'Wahrnehmung', 'Aufmerksamkeit'], ['Zustoßen', 'Geschick', 'Handgemenge'], ['Ablenken', 'Geschick', 'Sportlichkeit'], FLU], beh: 'Beobachtet, krächzt, flieht bei Gefahr; kein Boss-Monster.', ceil: 'Ablenkung, Sicht, Schwarm und Flucht.', ext: 'Hohe Stufen: Schwarm als Begegnung.' },
  { id: 'animal_large_predator', cat: 'animal', name: 'Großes Raubtier', desc: 'Art vorab festlegen (Bär, Großkatze …).', sp: 'tier', a: [5, 3, 4, 1, 1, 2, 4, 1, 3], s: { Handgemenge: 4, Sportlichkeit: 3, Aufmerksamkeit: 3, Heimlichkeit: 2 }, up: ['Handgemenge', 'Heimlichkeit', 'Aufmerksamkeit'], cap: 2, wp: 5, act: [['Wittern', 'Wahrnehmung', 'Aufmerksamkeit'], ['Prankenhieb / Biss', 'Körperkraft', 'Handgemenge'], ['Anspringen', 'Geschick', 'Sportlichkeit'], FLU], beh: 'Revier- oder Hungerverhalten; meidet verletzende Kämpfe, wenn möglich.', ceil: 'Art ist Pflichtangabe der SL, damit die Werte plausibel bleiben.', ext: 'Art der SL: bitte in der Notiz festhalten.' },

  { id: 'supernatural_ghoul_basic', cat: 'supernatural', name: 'Einfacher Ghul', desc: 'Diener mit Vitae und kleinem Vorteil.', sp: 'ghul', a: [3, 3, 3, 2, 2, 2, 3, 2, 3], s: { Handgemenge: 2, Aufmerksamkeit: 2, Etikette: 1 }, up: ['Handgemenge', 'Aufmerksamkeit', 'Körperkraft'], cap: 2, wp: 5, blood: 5, act: [BEO, SCH, ['Gehorchen / Widerstehen', 'Geistesschärfe', ''], ['Einschüchtern', 'Charisma', 'Einschüchtern']], beh: 'Loyal zu seinem Herrn, folgt Befehlen, scheut die Öffentlichkeit.', ceil: 'Einfache bis fortgeschrittene Fähigkeiten, regelkonform.', ext: 'Vitae-Disziplinen nur nach geprüften Regeln (Potenz).' },
  { id: 'supernatural_ghoul_armed', cat: 'supernatural', name: 'Bewaffneter Ghul-Wächter', desc: 'Bewacht Eingänge und Schutzbefohlene.', sp: 'ghul', a: [3, 3, 4, 2, 2, 2, 3, 2, 3], s: { Schusswaffen: 2, Nahkampf: 2, Handgemenge: 2, Aufmerksamkeit: 3 }, up: ['Schusswaffen', 'Nahkampf', 'Aufmerksamkeit', 'Widerstandsfähigkeit'], cap: 3, wp: 6, blood: 6, act: [BEO, SCHU, NAH, ['Wache halten', 'Wahrnehmung', 'Aufmerksamkeit']], beh: 'Wachsam, taktisch, ruft Verstärkung und schützt das Objekt.', ceil: 'Disziplin, Taktik und passende Ghulfähigkeiten.', ext: 'Vitae-Disziplinen nur nach geprüften Regeln (Potenz).' },
  { id: 'supernatural_ghoul_veteran', cat: 'supernatural', name: 'Erfahrener Ghul', desc: 'Lange gebunden, viel Erfahrung.', sp: 'ghul', a: [4, 3, 4, 2, 3, 2, 3, 3, 4], s: { Handgemenge: 3, Nahkampf: 3, Aufmerksamkeit: 3, Heimlichkeit: 2, Etikette: 2 }, up: ['Handgemenge', 'Nahkampf', 'Aufmerksamkeit', 'Heimlichkeit'], cap: 3, wp: 7, blood: 8, act: [BEO, SCH, NAH, HEI], beh: 'Gelassen, erfahren, handelt im Sinne seines Herrn.', ceil: 'Erfahrung und lange Blutversorgung nachvollziehbar.', ext: 'Vitae-Disziplinen nur nach geprüften Regeln (Potenz).' },
  { id: 'supernatural_vampire_young', cat: 'supernatural', name: 'Junger Vampir', desc: 'Jung und unsicher in der Gesellschaft.', sp: 'vampir', a: [2, 3, 3, 3, 3, 3, 3, 2, 3], s: { Handgemenge: 2, Heimlichkeit: 2, Szenekenntnis: 2, Ausflüchte: 2, Etikette: 1 }, up: ['Handgemenge', 'Heimlichkeit', 'Ausflüchte', 'Szenekenntnis'], cap: 2, wp: 5, blood: 10, act: [BEO, SCH, ['Einschüchtern', 'Manipulation', 'Einschüchtern'], ['Täuschen', 'Manipulation', 'Ausflüchte']], beh: 'Nervös, sucht Rückhalt, meidet Konflikte mit Älteren.', ceil: 'Bleibt plausibel jung; Stärke durch Kompetenz und Umfeld.', ext: 'Generation, Clan und Disziplinen: durch die SL festlegen und nach V20 prüfen.' },
  { id: 'supernatural_vampire_opponent', cat: 'supernatural', name: 'Einfacher vampirischer Gegner', desc: 'Kampfbereiter Kainit ohne große Titel.', sp: 'vampir', a: [3, 3, 4, 2, 3, 2, 3, 3, 3], s: { Handgemenge: 3, Nahkampf: 2, Heimlichkeit: 2, Einschüchtern: 3, Aufmerksamkeit: 2 }, up: ['Handgemenge', 'Nahkampf', 'Einschüchtern', 'Heimlichkeit'], cap: 3, wp: 6, blood: 12, act: [BEO, SCH, NAH, ['Einschüchtern', 'Charisma', 'Einschüchtern']], beh: 'Kampfbereit und berechnend, nutzt Dunkelheit und Überraschung.', ceil: 'Generation, Clan und Disziplinen konsistent wählen.', ext: 'Generation, Clan und Disziplinen: durch die SL festlegen und nach V20 prüfen.' },
  { id: 'supernatural_controlled_animal', cat: 'supernatural', name: 'Übernatürlich kontrolliertes Tier', desc: 'Tier unter fremdem Willen.', sp: 'tier', a: [3, 3, 3, 1, 1, 2, 4, 1, 3], s: { Handgemenge: 3, Aufmerksamkeit: 3, Sportlichkeit: 2 }, up: ['Handgemenge', 'Aufmerksamkeit'], cap: 2, wp: 4, act: [['Wittern', 'Wahrnehmung', 'Aufmerksamkeit'], BISS, ['Beobachten (für Meister)', 'Wahrnehmung', 'Aufmerksamkeit'], FLU], beh: 'Folgt dem fremden Willen, ignoriert Eigenschutz, endet bei Aufhebung der Kontrolle.', ceil: 'Kontrolle, Tierart, Machtquelle und Einschränkungen sichtbar.', ext: 'Tierart und Kontrolle: durch die SL festlegen.' },
];

export type FigureType = { id: string; category: CategoryId; name: string; description: string; species: Species; behavior: string; ceiling: string; note: string };
export const FIGURE_TYPES: readonly FigureType[] = SPECS.map(s => ({ id: s.id, category: s.cat, name: s.name, description: s.desc, species: s.sp, behavior: s.beh, ceiling: s.ceil, note: s.ext || '' }));
export const typeById = (id: string): FigureType | undefined => FIGURE_TYPES.find(t => t.id === id);
export const tierById = (id: string) => TIERS.find(t => t.id === id);
const specById = (id: string) => SPECS.find(s => s.id === id);

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export type FigureAction = { id: string; label: string; attribute: AttributeKey; ability: string; pool: number };
export type FigureStats = {
  typeId: string; tierId: TierId; version: string; status: typeof FIGURE_STATUS;
  attributes: Record<AttributeKey, number>; skills: Record<string, number>;
  willpower: number; bloodMax: number | null;
  actions: FigureAction[]; explanation: string;
  /** true when the tier exceeds what a single figure of this type can plausibly represent */
  encounter: boolean; encounterHint: string;
};

/** Resolve the fixed draft statblock of one variant. Pure and deterministic. */
export function resolveFigure(typeId: string, tierId: string): FigureStats | null {
  const sp = specById(typeId), tier = tierById(tierId);
  if (!sp || !tier) return null;
  const d = Math.min(tier.delta, sp.cap), encounter = tier.delta > sp.cap;
  const top = 5;
  const attributes = Object.fromEntries(ATTRIBUTES.map((k, i) => [k, clamp(sp.a[i] + (sp.up.includes(k) ? d : 0), 1, top)])) as Record<AttributeKey, number>;
  const names = new Set([...Object.keys(sp.s), ...sp.up.filter(k => !(ATTRIBUTES as readonly string[]).includes(k))]);
  const skills: Record<string, number> = {};
  for (const k of names) skills[k] = clamp((sp.s[k] ?? 0) + (sp.up.includes(k) ? d : 0), 0, 5);
  const val = (attr: AttributeKey, ability: string) => attributes[attr] + (ability ? skills[ability] ?? 0 : 0);
  const actions = sp.act.map((x, i) => ({ id: 'a' + i, label: x[0], attribute: x[1], ability: x[2], pool: val(x[1], x[2]) }));
  return {
    typeId, tierId: tier.id, version: STANDARD_FIGURES_VERSION, status: FIGURE_STATUS, attributes, skills,
    willpower: clamp(sp.wp + d, 1, 10), bloodMax: sp.blood === undefined ? null : sp.blood, actions,
    explanation: `${tier.label}: ${sp.ceil}`,
    encounter,
    encounterHint: encounter ? 'Begegnungsstufe, nicht Einzelstärke: Die Einzelfigur bleibt plausibel, die Schwierigkeit entsteht durch Anzahl, Gelände oder Unterstützung. Weitere Figuren setzt nur du selbst ein.' : '',
  };
}

/** Wound penalty for a number of filled health boxes (0..7). null = incapacitated. */
export function woundPenalty(hurt: number): number | null {
  const level = HEALTH_LEVELS[clamp(Math.floor(hurt), 0, 7) - 1];
  return hurt <= 0 ? 0 : hurt >= 7 ? null : level.penalty;
}
/** Effective pool after wounds; 0 means no roll (incapacitated or nothing left). */
export function effectivePool(pool: number, hurt: number): number {
  const p = woundPenalty(hurt);
  return p === null ? 0 : Math.max(0, pool - p);
}

export type LiveFigure = {
  id: string; typeId: string; tierId: TierId; label: string; stats: FigureStats;
  hurt: number; willpower: number; blood: number | null; note: string; imageFileId: string;
  createdAt: string;
};
export type FigureStatePatch = Partial<Pick<LiveFigure, 'label' | 'hurt' | 'willpower' | 'blood' | 'note' | 'imageFileId'>>;

export const MAX_LIVE_FIGURES = 40;
export const MAX_SPAWN = 10;
export const nextLabel = (name: string, existing: readonly { label: string }[]): string => {
  let n = 1; while (existing.some(f => f.label === `${name} ${n}`)) n++;
  return `${name} ${n}`;
};

/** Prepared selection of a scene (scene document field `standardFigures`). */
export type PreparedFigure = { id: string; typeId: string; tierId: TierId; count: number };

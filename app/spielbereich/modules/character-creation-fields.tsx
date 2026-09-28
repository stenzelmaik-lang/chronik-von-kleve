"use client";

import { useEffect, type ReactNode } from "react";
import type { Entry, LegacyBody } from "@/domain/legacy";
import { availableClanForCampaign, clansForCampaign, type ClanDefinition } from "@/domain/clan-config";
import { creationBudgets, freebieCapacity, freebieCosts, freebieTotal, validateCharacterDraft } from "@/domain/character-engine";
import { v20Archetypes, v20Backgrounds, v20Flaws, v20Merits, type CharacterOption } from "@/domain/character-options";

const attrsGroups = [
  ["Körperlich", ["Körperkraft", "Geschick", "Widerstandsfähigkeit"]],
  ["Sozial", ["Charisma", "Manipulation", "Erscheinungsbild"]],
  ["Mental", ["Wahrnehmung", "Intelligenz", "Geistesschärfe"]],
] as const;
const skillGroups = [
  ["Talente", ["Aufmerksamkeit", "Ausdruck", "Ausflüchte", "Einschüchtern", "Empathie", "Führungsqualitäten", "Handgemenge", "Magiegespür", "Sportlichkeit", "Szenekenntnis"]],
  ["Fertigkeiten", ["Diebstahl", "Etikette", "Fahren", "Handwerk", "Heimlichkeit", "Nahkampf", "Schusswaffen", "Tierkunde", "Überleben", "Vortrag"]],
  ["Kenntnisse", ["Akademisches Wissen", "Computer", "Finanzen", "Gesetzeskenntnis", "Medizin", "Nachforschungen", "Naturwissenschaften", "Okkultismus", "Politik", "Technologie"]],
] as const;

type CharacterItem = { name?: string; value?: number; cost?: number; category?: "Talent" | "Fertigkeit" | "Kenntnis"; source?: string; approved?: boolean };
const objectRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const numericRecord = (value: unknown): Record<string, number> => Object.fromEntries(Object.entries(objectRecord(value)).map(([key, item]) => [key, Number(item) || 0]));
const rows = (value: unknown): CharacterItem[] => Array.isArray(value) ? value as CharacterItem[] : [];
const integer = (value: unknown, min = 0, max = 10) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : min));

function Dots({ value, onChange, max = 5, label, disabled = false }: { value: number; onChange?: (value: number) => void; max?: number; label: string; disabled?: boolean }) {
  const safe = integer(value, 0, max);
  return <span className="dots" role="group" aria-label={label}>{!disabled && <button type="button" className="dot-clear" aria-label={`${label} auf null setzen`} onClick={() => onChange?.(0)}>×</button>}{Array.from({ length: max }, (_, index) => <button type="button" key={index} className={index < safe ? "dot active" : "dot"} disabled={disabled} aria-label={`${label}: ${index + 1} von ${max}`} aria-pressed={index < safe} onClick={() => onChange?.(index + 1)}>●</button>)}</span>;
}

function RatingGroup({ title, names, values, onChange, disabled = false }: { title: string; names: readonly string[]; values: Record<string, number>; onChange: (name: string, value: number) => void; disabled?: boolean }) {
  return <section className="rating-section"><h4>{title}</h4><div className="v20-rating-list">{names.map((name) => <div className="v20-rating-row" key={name}><span>{name}</span><Dots value={values[name] ?? 0} onChange={(value) => onChange(name, value)} disabled={disabled} label={name} /></div>)}</div></section>;
}

function PresetField({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: readonly CharacterOption[]; disabled?: boolean }) {
  const selected = options.find((option) => option.label === value);
  const listId = `character-options-${label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  return <label className="field preset-field"><span>{label}</span><input list={listId} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder="Auswählen oder eigenen Wert eingeben" title={selected?.description || "Eigener Eintrag bleibt als Text erhalten."} /><datalist id={listId}>{options.map((option) => <option key={option.id} value={option.label}>{option.description}</option>)}</datalist><small className="preset-hint">{selected?.description || "Eigener Eintrag · keine automatische Regelwirkung"}</small></label>;
}

function SearchableListEditor({ label, value, onChange, metric, options, allowCustom = true, requireApproval = false }: { label: string; value: unknown; onChange: (value: unknown) => void; metric: "value" | "cost"; options?: readonly CharacterOption[]; allowCustom?: boolean; requireApproval?: boolean }) {
  const current = rows(value);
  const optionId = `character-list-${label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
  const add = (option?: CharacterOption) => onChange([...current, { name: option?.label || "", [metric]: 0, ...(requireApproval ? { approved: false, source: option ? "catalog" : "custom" } : {}) }]);
  return <div className="field wide searchable-list-editor"><span>{label}</span>{current.map((row, index) => <div className="inline-list-row" key={`${row.name}-${index}`}><input list={options ? optionId : undefined} aria-label={`${label} Name ${index + 1}`} placeholder="Name des Eintrags" value={row.name ?? ""} onChange={(event) => onChange(current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /><input aria-label={`${label} ${metric === "cost" ? "Kosten" : "Wert"} ${index + 1}`} type="number" min="0" max={metric === "cost" ? 999 : 10} value={row[metric] ?? 0} onChange={(event) => onChange(current.map((item, itemIndex) => itemIndex === index ? { ...item, [metric]: integer(event.target.value, 0, metric === "cost" ? 999 : 10) } : item))} /><button type="button" className="danger-link" onClick={() => onChange(current.filter((_, itemIndex) => itemIndex !== index))}>Löschen</button>{requireApproval && <small className="preset-hint">{row.approved === true ? "SL-freigegeben" : "SL-Freigabe und Kostenprüfung erforderlich"}</small>}</div>)}{options && <datalist id={optionId}>{options.map((option) => <option key={option.id} value={option.label}>{option.description}</option>)}</datalist>}<div className="list-editor-actions">{options?.slice(0, 6).map((option) => <button type="button" className="button compact" key={option.id} onClick={() => add(option)} title={option.description}>+ {option.label}</button>)}{allowCustom && <button type="button" className="button" onClick={() => add()}>+ eigener Eintrag</button>}</div></div>;
}

function ClanDisciplines({ value, onChange, clan, disabled }: { value: unknown; onChange: (value: unknown) => void; clan: ClanDefinition | null; disabled: boolean }) {
  const current = rows(value);
  if (!clan) return <div className="field wide"><span>Clan-Disziplinen</span><p className="muted">Wähle zuerst einen freigegebenen Clan.</p></div>;
  return <div className="field wide character-discipline-panel"><span>Clan-Disziplinen · {clan.label}</span><p className="muted">Die drei Disziplinen werden automatisch aus der Kampagnenregel geladen. Verteile genau drei Startpunkte auf diese Zeilen.</p>{clan.disciplines.map((name) => { const row = current.find((item) => item.name === name) ?? { name, value: 0 }; return <div className="inline-list-row" key={name}><label>{name}</label><input aria-label={`${name} Startpunkte`} type="number" min="0" max="3" value={row.value ?? 0} disabled={disabled} onChange={(event) => onChange(clan.disciplines.map((discipline) => discipline === name ? { name: discipline, value: integer(event.target.value, 0, 3) } : (current.find((item) => item.name === discipline) ?? { name: discipline, value: 0 })))} /><span className="muted">von 3</span></div>; })}<p className="v20-note">Manuelle Disziplinwahl und zusätzliche Clanzeilen sind deaktiviert. Legacy-Werte werden erst durch eine bewusste Clanänderung ersetzt.</p></div>;
}

function BudgetPanel({ body, campaignId }: { body: LegacyBody; campaignId: string }) {
  const source = body as Record<string, unknown>;
  const capacity = freebieCapacity(source);
  const spent = freebieTotal(source);
  const validation = validateCharacterDraft(campaignId, source);
  const attributes = Object.values(numericRecord(body.attributes)).reduce((sum, value) => sum + value, 0);
  const abilities = Object.values(numericRecord(body.skills)).reduce((sum, value) => sum + value, 0);
  const disciplines = rows(body.disciplines).reduce((sum, item) => sum + Number(item.value || 0), 0);
  const backgrounds = rows(body.backgrounds).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return <section className="wide character-budget-panel"><div><p className="eyebrow">V20 ERSCHAFFUNGSBUDGET</p><h3>Punkteübersicht</h3></div><div className="character-budget-groups"><span>Attribute <b>{attributes}</b></span><span>Fähigkeiten <b>{abilities}</b></span><span>Disziplinen <b>{disciplines}/{creationBudgets.disciplines}</b></span><span>Hintergründe <b>{backgrounds}/{creationBudgets.backgrounds}</b></span><span>Freebies <b>{spent}/{capacity}</b></span></div>{validation.ok ? <p className="v20-note">{validation.state === "draft" ? "Entwurf · Änderungen bleiben bis zur Bestätigung offen." : `Freie Punkte verfügbar: ${validation.freebieAvailable}`}</p> : <p className="character-budget-error">{validation.error}</p>}<small className="muted">Freebie-Kosten: Attribut {freebieCosts.attribute}, Fähigkeit {freebieCosts.ability}, Disziplin {freebieCosts.discipline}, Hintergrund {freebieCosts.background}. Schwächen geben höchstens {creationBudgets.flawFreebiesMaximum} bestätigte Zusatzpunkte.</small></section>;
}

export function CharacterCreationFields({ edit, patchBody, field, campaignId }: { edit: Entry; patchBody: (key: string, value: unknown) => void; field: (label: string, key: string, large?: boolean, type?: string) => ReactNode; campaignId: string }) {
  const body = edit.body || {};
  const clanName = String(body.clan ?? "").trim();
  const clan = availableClanForCampaign(campaignId, clanName);
  const catalog = clansForCampaign(campaignId);
  const knownClan = catalog.some((item) => item.label === clanName);
  const set = (group: string, name: string, value: number) => patchBody(group, { ...numericRecord(body[group]), [name]: value });
  const setText = (key: string, value: string) => patchBody(key, value);
  useEffect(() => {
    if (!clan || !edit.canEdit) return;
    const expected = clan.disciplines.map((name) => ({ name, value: Number(rows(body.disciplines).find((item) => item.name === name)?.value || 0) }));
    const current = rows(body.disciplines);
    if (JSON.stringify(current) !== JSON.stringify(expected)) patchBody("disciplines", expected);
  }, [clan, clanName, edit.canEdit, body.disciplines, patchBody]);
  const changeClan = (next: string) => {
    const allocated = rows(body.disciplines).reduce((sum, item) => sum + Number(item.value || 0), 0);
    if (next !== clanName && allocated > 0 && typeof window !== "undefined" && !window.confirm("Der Clanwechsel setzt die drei Clan-Disziplinen auf 0 zurück. Ungespeicherte Punkte gehen verloren. Fortfahren?")) return;
    patchBody("clan", next);
    const nextClan = availableClanForCampaign(campaignId, next);
    if (nextClan) patchBody("disciplines", nextClan.disciplines.map((name) => ({ name, value: 0 })));
  };
  return <>
    <div className="bio-grid"><div className="v20-emblem"><span>V20</span><small>CHARAKTERBOGEN</small></div>{field("Spieler/in", "player")}{field("Chronik", "chronicle")}<PresetField label="Wesen" value={String(body.nature ?? "")} onChange={(value) => setText("nature", value)} options={v20Archetypes} disabled={!edit.canEdit} /><PresetField label="Verhalten" value={String(body.demeanor ?? "")} onChange={(value) => setText("demeanor", value)} options={v20Archetypes} disabled={!edit.canEdit} />{field("Konzept", "concept")}<label className="field"><span>Clan</span><select aria-label="Clan" value={clanName} disabled={!edit.canEdit} onChange={(event) => changeClan(event.target.value)}><option value="">Clan wählen …</option>{!knownClan && clanName && <option value={clanName} disabled>Bestehender Legacy-Clan: {clanName}</option>}{catalog.map((item) => <option key={item.id} value={item.label} disabled={item.availability === "locked"}>{item.label}{item.availability === "locked" ? " · gesperrt" : ""}</option>)}</select><small className="muted">Caitiff wird in einem späteren Regelpatch behandelt.</small></label>{field("Generation", "generation", false, "number")}{field("Erzeuger", "sire")}{field("Porträt / Bildreferenz", "image")}</div>
    <BudgetPanel body={body} campaignId={campaignId} />
    <h3 className="wide form-heading">Attribute · 1–5 Punkte</h3><div className="wide ratings-columns">{attrsGroups.map(([title, names]) => <RatingGroup key={title} title={title} names={names} values={numericRecord(body.attributes)} onChange={(name, value) => set("attributes", name, value)} />)}</div>
    <h3 className="wide form-heading">Fähigkeiten · 0–5 Punkte</h3><div className="wide ratings-columns">{skillGroups.map(([title, names]) => <RatingGroup key={title} title={title} names={names} values={numericRecord(body.skills)} onChange={(name, value) => set("skills", name, value)} />)}</div>
    <SearchableListEditor label="Freie Fähigkeiten" value={body.customAbilities} onChange={(value) => patchBody("customAbilities", value)} metric="value" />
    <ClanDisciplines value={body.disciplines} onChange={(value) => patchBody("disciplines", value)} clan={clan} disabled={!edit.canEdit} />
    <SearchableListEditor label="Hintergründe" value={body.backgrounds} onChange={(value) => patchBody("backgrounds", value)} metric="value" options={v20Backgrounds} />
    <h3 className="wide form-heading">Tugenden und dauerhafte Werte</h3><div className="virtue-grid wide">{["Gewissen", "Selbstbeherrschung", "Mut"].map((name) => <label className="field" key={name}><span>{name}</span><Dots value={Number(numericRecord(body.virtues)[name] ?? 1)} onChange={(value) => set("virtues", name, value)} label={name} /></label>)}{field("Menschlichkeit", "humanity", false, "number")}{field("Pfad / Pfadname", "humanityPath")}{field("Willenskraft permanent", "willpower", false, "number")}{field("Blut Maximum", "bloodMax", false, "number")}{field("Blut pro Runde", "bloodPerRound", false, "number")}{field("freie XP", "xpFree", false, "number")}{field("Gesamt-XP", "xp", false, "number")}</div>
    <SearchableListEditor label="Vorzüge" value={body.merits} onChange={(value) => patchBody("merits", value)} metric="cost" options={v20Merits} requireApproval />
    <SearchableListEditor label="Schwächen" value={body.flaws} onChange={(value) => patchBody("flaws", value)} metric="cost" options={v20Flaws} requireApproval />
    {field("Clansschwäche", "clanWeakness", true)}
    <label className="field"><span>Testdaten</span><select aria-label="Testdaten" value={body.testData === true ? "true" : "false"} onChange={(event) => patchBody("testData", event.target.value === "true")}><option value="false">Nein</option><option value="true">TEST_DATA</option></select></label><label className="field"><span>Kanonstatus</span><select aria-label="Kanonstatus" value={String(body.canonStatus ?? "WORKING")} onChange={(event) => patchBody("canonStatus", event.target.value)}><option value="WORKING">Nicht kanonisch / Arbeitsstand</option><option value="CANON">CANON</option><option value="OPEN">OPEN</option><option value="RUMOR">RUMOR</option><option value="SUPERSEDED">SUPERSEDED</option></select></label>
    {field("Geschichte & Beschreibung", "text", true)}{field("Ziele & Beziehungen", "goals", true)}{field("Inventar", "inventory", true)}<p className="muted wide v20-note">Aktuelle Werte für Blut, temporäre Willenskraft und Gesundheit werden auf der Charakteransicht gepflegt. Der Bearbeitungsmodus speichert nur dauerhafte Bogenwerte. Eigene Vorzüge und Schwächen bleiben bis zur SL-Freigabe regelneutral.</p>
  </>;
}

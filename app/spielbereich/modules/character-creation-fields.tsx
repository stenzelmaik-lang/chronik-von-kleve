"use client";

import { useEffect, type ReactNode } from "react";
import type { Entry, LegacyBody } from "@/domain/legacy";
import { availableClanForCampaign, clansForCampaign, type ClanDefinition } from "@/domain/clan-config";
import { attributeBase, automaticFreebieBreakdown, creationBudgetSummary, derivedV20Values, validateCharacterDraft, type CreationBudgetLine } from "@/domain/character-engine";
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

type CharacterItem = { name?: string; value?: number; cost?: number; category?: "Talent" | "Fertigkeit" | "Kenntnis"; source?: string; approved?: boolean; slApproved?: boolean };
const objectRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const numericRecord = (value: unknown): Record<string, number> => Object.fromEntries(Object.entries(objectRecord(value)).map(([key, item]) => [key, Number(item) || 0]));
const rows = (value: unknown): CharacterItem[] => Array.isArray(value) ? value as CharacterItem[] : [];
const integer = (value: unknown, min = 0, max = 10) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : min));

function Dots({ value, onChange, max = 5, min = 0, label, disabled = false }: { value: number; onChange?: (value: number) => void; max?: number; min?: number; label: string; disabled?: boolean }) {
  const safe = integer(value, 0, max);
  return <span className="dots" role="group" aria-label={label}>{!disabled && min === 0 && <button type="button" className="dot-clear" aria-label={`${label} auf null setzen`} onClick={() => onChange?.(0)}>×</button>}{Array.from({ length: max }, (_, index) => <button type="button" key={index} className={index < safe ? "dot active" : "dot"} disabled={disabled || index + 1 < min} aria-label={`${label}: ${index + 1} von ${max}`} aria-pressed={index < safe} onClick={() => onChange?.(Math.max(min, index + 1))}>●</button>)}</span>;
}

function RatingGroup({ title, names, values, onChange, disabled = false, minimum = () => 0, disabledName = () => false }: { title: string; names: readonly string[]; values: Record<string, number>; onChange: (name: string, value: number) => void; disabled?: boolean; minimum?: (name: string) => number; disabledName?: (name: string) => boolean }) {
  return <section className="rating-section"><h4>{title}</h4><div className="v20-rating-list">{names.map((name) => { const min = minimum(name); const blocked = disabledName(name); return <div className="v20-rating-row" key={name}><span>{name}{min > 0 && <small className="base-dot-label"> · {min} Grundpunkt</small>}{blocked && <small className="base-dot-label"> · Clansnachteil</small>}</span><Dots value={values[name] ?? min} min={min} onChange={(value) => onChange(name, value)} disabled={disabled || blocked} label={name} /></div>; })}</div></section>;
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

function ClanDisciplines({ value, onChange, clan, disabled, isGm }: { value: unknown; onChange: (value: unknown) => void; clan: ClanDefinition | null; disabled: boolean; isGm: boolean }) {
  const current = rows(value);
  if (!clan) return <div className="field wide"><span>Clan-Disziplinen</span><p className="muted">Wähle zuerst einen freigegebenen Clan.</p></div>;
  const foreign = current.filter((item) => item.source === "foreign");
  const legacy = current.filter((item) => item.source !== "foreign" && !clan.disciplines.includes(String(item.name ?? "")));
  const updateClan = (name: string, value: number) => onChange([...clan.disciplines.map((discipline) => discipline === name ? { name: discipline, value } : (current.find((item) => item.name === discipline && item.source !== "foreign") ?? { name: discipline, value: 0 })), ...foreign, ...legacy]);
  const updateForeign = (index: number, patch: Record<string, unknown>) => onChange([...clan.disciplines.map((name) => current.find((item) => item.name === name && item.source !== "foreign") ?? { name, value: 0 }), ...foreign.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item), ...legacy]);
  return <div className="field wide character-discipline-panel"><span>Clan-Disziplinen · {clan.label}</span><p className="muted">Die drei Disziplinen werden automatisch geladen. Verteile genau drei kostenlose Startpunkte auf diese Zeilen. Weitere Punkte berechnet die Engine automatisch als Freebies.</p>{clan.disciplines.map((name) => { const row = current.find((item) => item.name === name && item.source !== "foreign") ?? { name, value: 0 }; return <div className="inline-list-row" key={name}><label>{name}</label><input aria-label={`${name} Startpunkte`} type="number" min="0" max="3" value={row.value ?? 0} disabled={disabled} onChange={(event) => updateClan(name, integer(event.target.value, 0, 3))} /><span className="muted">von 3</span></div>; })}<div className="foreign-discipline-section"><strong>Clansfremde Disziplinen</strong><p className="muted">Nur mit dokumentierter SL-Ausnahme. Die Engine berechnet automatisch sieben Freebies je Stufe.</p>{foreign.map((row, index) => <div className="inline-list-row" key={`foreign-${index}`}><input aria-label={`Clansfremde Disziplin ${index + 1}`} placeholder="Disziplinname" value={row.name ?? ""} disabled={disabled} onChange={(event) => updateForeign(index, { name: event.target.value, source: "foreign" })} /><input aria-label={`Clansfremde Disziplinwert ${index + 1}`} type="number" min="1" max="5" value={row.value ?? 1} disabled={disabled} onChange={(event) => updateForeign(index, { value: integer(event.target.value, 1, 5), source: "foreign" })} /><label className="inline-check"><input type="checkbox" checked={row.slApproved === true} disabled={disabled || !isGm} onChange={(event) => updateForeign(index, { slApproved: event.target.checked, source: "foreign" })} /> SL-Ausnahme genehmigt</label><button type="button" className="danger-link" disabled={disabled} onClick={() => onChange(current.filter((item) => item !== row))}>Löschen</button></div>)}<button type="button" className="button compact" disabled={disabled} onClick={() => onChange([...current, { name: "", value: 1, source: "foreign", slApproved: false }])}>+ clansfremde Disziplin</button></div><p className="v20-note">Clansfremde Disziplinen werden nie automatisch genehmigt. Ihre Freebie-Kosten werden aus den gewählten Punkten berechnet.</p></div>;
}

function BudgetPanel({ body, campaignId }: { body: LegacyBody; campaignId: string }) {
  const source = body as Record<string, unknown>;
  const budget = creationBudgetSummary(source);
  const automatic = automaticFreebieBreakdown(source);
  const validation = validateCharacterDraft(campaignId, source);
  const line = (label: string, value: CreationBudgetLine) => <span className={value.exceeded ? "budget-line exceeded" : "budget-line"}><span>{label}</span><b>{value.spent}/{value.limit}</b>{value.exceeded ? <em>{value.freebieDots ? `+${value.freebieDots} Freebie · ${value.freebieCost} Punkte` : "durch Freebies abgedeckt"}</em> : <small>{value.remaining} frei</small>}</span>;
  return <section className="wide character-budget-panel"><div><p className="eyebrow">V20 ERSCHAFFUNGSREGELN</p><h3>Punkteübersicht</h3><p className="muted">Du verteilst zuerst die normalen Gruppenpunkte. Jeder weitere Punkt wird automatisch als Freebie erkannt und vom gemeinsamen Freebie-Budget abgezogen. Attribute: 7/5/3 Zusatzpunkte nach je 1 kostenlosem Grundpunkt · Fähigkeiten: 13/9/5 ab 0, regulär maximal 3.</p></div><div className="character-budget-groups">{line("Attribute körperlich", budget.attributes.physical)}{line("Attribute sozial", budget.attributes.social)}{line("Attribute mental", budget.attributes.mental)}{line("Talente", budget.abilities.talents)}{line("Fertigkeiten", budget.abilities.skills)}{line("Kenntnisse", budget.abilities.knowledges)}{line("Disziplinen", budget.disciplines)}{line("Hintergründe", budget.backgrounds)}{line("Tugenden", budget.virtues)}{line("Freebies gesamt", budget.freebies)}</div>{automatic.length > 0 && <p className="v20-note"><strong>Automatisch verwendete Freebies:</strong> {automatic.map((item) => `${item.target}: ${item.dots} × ${item.cost} = ${item.total}`).join(" · ")}</p>}{validation.ok ? <p className="v20-note">{validation.state === "draft" ? "Entwurf · Änderungen bleiben bis zur Bestätigung offen. Die Freebie-Berechnung aktualisiert sich sofort." : `Freie Punkte verfügbar: ${validation.freebieAvailable}`}</p> : <p className="character-budget-error">{validation.error}</p>}<small className="muted">Es gibt keinen separaten Freebie-Kauf. Preise: Attribut 5 · Fähigkeit 2 · Disziplin 7 · Hintergrund 1 · Tugend 2 · Menschlichkeit 2 · permanente Willenskraft 1.</small></section>;
}

export function CharacterCreationFields({ edit, patchBody, field, campaignId, isGm = false }: { edit: Entry; patchBody: (key: string, value: unknown) => void; field: (label: string, key: string, large?: boolean, type?: string) => ReactNode; campaignId: string; isGm?: boolean }) {
  const body = edit.body || {};
  const engineCharacter = body.engineVersion === 1;
  const clanName = String(body.clan ?? "").trim();
  const clan = availableClanForCampaign(campaignId, clanName);
  const catalog = clansForCampaign(campaignId);
  const knownClan = catalog.some((item) => item.label === clanName);
  const derived = derivedV20Values(body as Record<string, unknown>);
  const attributes = body.attributes;
  const selectedClan = body.clan;
  const set = (group: string, name: string, value: number) => patchBody(group, { ...numericRecord(body[group]), [name]: value });
  const setText = (key: string, value: string) => patchBody(key, value);
  useEffect(() => {
    if (!clan || !edit.canEdit) return;
    const currentRows = rows(body.disciplines);
    const expected = [...clan.disciplines.map((name) => ({ name, value: Number(currentRows.find((item) => item.name === name && item.source !== "foreign")?.value || 0) })), ...currentRows.filter((item) => item.source === "foreign" || !clan.disciplines.includes(String(item.name ?? "")))];
    if (JSON.stringify(currentRows) !== JSON.stringify(expected)) patchBody("disciplines", expected);
  }, [clan, clanName, edit.canEdit, body.disciplines, patchBody]);
  useEffect(() => {
    if (!engineCharacter || !edit.canEdit) return;
    if (Number(body.humanity) !== derived.humanity) patchBody("humanity", derived.humanity);
    if (Number(body.willpower) !== derived.willpower) patchBody("willpower", derived.willpower);
  }, [engineCharacter, edit.canEdit, body.humanity, body.willpower, body.virtues, body.freebiePurchases, derived.humanity, derived.willpower, patchBody]);
  useEffect(() => {
    if (!engineCharacter || !edit.canEdit) return;
    const current = objectRecord(attributes);
    const next = { ...current };
    let changed = false;
    for (const name of attrsGroups.flatMap(([, names]) => names)) {
      if (Object.prototype.hasOwnProperty.call(next, name)) continue;
      next[name] = attributeBase({ clan: selectedClan }, name);
      changed = true;
    }
    if (changed) patchBody("attributes", next);
  }, [engineCharacter, edit.canEdit, attributes, selectedClan, patchBody]);
  const changeClan = (next: string) => {
    const allocated = rows(body.disciplines).reduce((sum, item) => sum + Number(item.value || 0), 0);
    if (next !== clanName && allocated > 0 && typeof window !== "undefined" && !window.confirm("Der Clanwechsel setzt die drei Clan-Disziplinen auf 0 zurück. Ungespeicherte Punkte gehen verloren. Fortfahren?")) return;
    patchBody("clan", next);
    const nextClan = availableClanForCampaign(campaignId, next);
    if (nextClan) patchBody("disciplines", [...nextClan.disciplines.map((name) => ({ name, value: 0 })), ...rows(body.disciplines).filter((item) => item.source === "foreign")]);
  };
  const customAbilities = rows(body.customAbilities);
  return <>
    <div className="bio-grid"><div className="v20-emblem"><span>V20</span><small>CHARAKTERBOGEN</small></div>{field("Spieler/in", "player")}{field("Chronik", "chronicle")}<PresetField label="Wesen" value={String(body.nature ?? "")} onChange={(value) => setText("nature", value)} options={v20Archetypes} disabled={!edit.canEdit} /><PresetField label="Verhalten" value={String(body.demeanor ?? "")} onChange={(value) => setText("demeanor", value)} options={v20Archetypes} disabled={!edit.canEdit} />{field("Konzept", "concept")}<label className="field"><span>Clan</span><select aria-label="Clan" value={clanName} disabled={!edit.canEdit} onChange={(event) => changeClan(event.target.value)}><option value="">Clan wählen …</option>{!knownClan && clanName && <option value={clanName} disabled>Bestehender Legacy-Clan: {clanName}</option>}{catalog.map((item) => <option key={item.id} value={item.label} disabled={item.availability === "locked"}>{item.label}{item.availability === "locked" ? " · gesperrt" : ""}</option>)}</select><small className="muted">Caitiff wird in einem späteren Regelpatch behandelt.</small></label>{field("Generation", "generation", false, "number")}{field("Erzeuger", "sire")}{field("Porträt / Bildreferenz", "image")}</div>
    <BudgetPanel body={body} campaignId={campaignId} />
    <h3 className="wide form-heading">Attribute · fester Grundpunkt + 7/5/3 Zusatzpunkte</h3><div className="wide ratings-columns">{attrsGroups.map(([title, names]) => <RatingGroup key={title} title={title} names={names} values={numericRecord(body.attributes)} minimum={(name) => attributeBase(body as Record<string, unknown>, name)} disabledName={(name) => name === "Erscheinungsbild" && clanName.toLocaleLowerCase() === "nosferatu"} onChange={(name, value) => set("attributes", name, value)} />)}</div>
    {clanName.toLocaleLowerCase() === "nosferatu" && <p className="muted wide v20-note">Nosferatu haben standardmäßig 0 Erscheinungsbild. Eine höhere Stufe bleibt bis zu einer separat dokumentierten SL-Ausnahme gesperrt.</p>}
    <h3 className="wide form-heading">Fähigkeiten · 0–3 Punkte regulär, danach automatische Freebies</h3><div className="wide ratings-columns">{skillGroups.map(([title, names]) => <RatingGroup key={title} title={title} names={names} values={numericRecord(body.skills)} onChange={(name, value) => set("skills", name, value)} />)}</div>
    {engineCharacter ? <section className="field wide"><span>Freie Fähigkeiten</span><p className="muted">In der regulären V20-Erschaffung werden ausschließlich die oben aufgeführten Katalogfähigkeiten verwendet. Bestehende Legacy-Einträge bleiben erhalten, werden aber nicht als reguläre neue Fähigkeit angeboten.</p>{customAbilities.length > 0 && <p className="preserve-lines">{customAbilities.map((item) => item.name || "Unbenannt").join(", ")}</p>}</section> : <SearchableListEditor label="Freie Fähigkeiten (Legacy)" value={body.customAbilities} onChange={(value) => patchBody("customAbilities", value)} metric="value" />}
    <ClanDisciplines value={body.disciplines} onChange={(value) => patchBody("disciplines", value)} clan={clan} disabled={!edit.canEdit} isGm={isGm} />
    <SearchableListEditor label="Hintergründe" value={body.backgrounds} onChange={(value) => patchBody("backgrounds", value)} metric="value" options={v20Backgrounds} />
    <h3 className="wide form-heading">Tugenden und abgeleitete Werte</h3><div className="virtue-grid wide">{["Gewissen", "Selbstbeherrschung", "Mut"].map((name) => <label className="field" key={name}><span>{name} · 1 kostenlos</span><Dots value={Object.prototype.hasOwnProperty.call(numericRecord(body.virtues), name) ? Number(numericRecord(body.virtues)[name]) : 1} min={1} onChange={(value) => set("virtues", name, value)} label={name} /> </label>)}{engineCharacter ? <><label className="field"><span>Menschlichkeit · automatisch</span><output>{derived.humanity}</output></label><label className="field"><span>Willenskraft permanent · automatisch</span><output>{derived.willpower}</output></label></> : <>{field("Menschlichkeit", "humanity", false, "number")}{field("Willenskraft permanent", "willpower", false, "number")}</>}{field("Pfad / Pfadname", "humanityPath")}{field("Blut Maximum", "bloodMax", false, "number")}{field("Blut pro Runde", "bloodPerRound", false, "number")}{field("freie XP", "xpFree", false, "number")}{field("Gesamt-XP", "xp", false, "number")}</div>
    <SearchableListEditor label="Vorzüge" value={body.merits} onChange={(value) => patchBody("merits", value)} metric="cost" options={v20Merits} requireApproval />
    <SearchableListEditor label="Schwächen" value={body.flaws} onChange={(value) => patchBody("flaws", value)} metric="cost" options={v20Flaws} requireApproval />
    {field("Clansschwäche", "clanWeakness", true)}
    {isGm && <><label className="field"><span>Testdaten · nur SL</span><select aria-label="Testdaten" value={body.testData === true ? "true" : "false"} onChange={(event) => patchBody("testData", event.target.value === "true")}><option value="false">Nein</option><option value="true">TEST_DATA</option></select></label><label className="field"><span>Kanonstatus · nur SL</span><select aria-label="Kanonstatus" value={String(body.canonStatus ?? "WORKING")} onChange={(event) => patchBody("canonStatus", event.target.value)}><option value="WORKING">Nicht kanonisch / Arbeitsstand</option><option value="CANON">CANON</option><option value="OPEN">OPEN</option><option value="RUMOR">RUMOR</option><option value="SUPERSEDED">SUPERSEDED</option></select></label></>}
    <p className="muted wide v20-note">Hintergrundgeschichte, Ziele, Beziehungen und Inventar werden im separaten Charakterbereich gepflegt. Vorhandene Daten bleiben erhalten. Aktuelle Werte für Blut, temporäre Willenskraft und Gesundheit werden weiterhin auf der Charakteransicht gepflegt. Eigene Vorzüge und Schwächen bleiben bis zur SL-Freigabe regelneutral.</p>
  </>;
}

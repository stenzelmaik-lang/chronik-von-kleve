"use client";
/* eslint-disable @next/next/no-img-element, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import type { Entry } from "@/domain/legacy";
import {
  BookOpen,
  CalendarDays,
  Camera,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, api } from "./api-client";
import { describeDataError, invalidatePlayerData, purgeProtectedPlayerData, readPlayerData, requestPlayerData } from "./player-data-cache";
import {
  CharacterCompanionNote,
  CharacterDetailProjection,
  CharacterListReadout,
  Dots,
  RatingGroup,
  attrsGroups,
  healthLevels,
  skillGroups,
} from "./character";
import { Choice, visibilityNames } from "./shared";

const obj = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const n = (v: unknown) => (typeof v === "number" ? v : 0);
const text = (v: unknown) => (typeof v === "string" ? v : "");
const mediaLabels: Record<string, string> = {
  portrait: "Portrait",
  reference: "Referenz",
  mood: "Stimmung",
  scene: "Szene",
};

export function CharacterDetail({
  entries,
  dataScope,
  activeCharacterId,
  onActiveCharacterChange,
  onCreate,
  onEdit,
  onRefresh,
}: {
  entries: Entry[];
  dataScope: string;
  activeCharacterId: string | null;
  onActiveCharacterChange: (id: string | null) => void;
  onCreate: () => void;
  onEdit: (e: Entry) => void;
  onRefresh?: () => void;
}) {
  const [projectionState, setProjection] = useState<CharacterDetailProjection | null>(
    null,
  );
  const [state, setState] = useState("");
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedCharacterId, setLoadedCharacterId] = useState<string | null>(null);
  const loadVersion = useRef(0);
  const [roleEdit, setRoleEdit] = useState<"story" | "play" | null>(null);
  const [storyDraft, setStoryDraft] = useState("");
  const [playDraft, setPlayDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState<{
    id?: string;
    version?: number;
    title: string;
    text: string;
    visibility: string;
  } | null>(null);
  const [mediaType, setMediaType] = useState("portrait");
  const [mediaVisibility, setMediaVisibility] = useState("private");
  const [companionBusy, setCompanionBusy] = useState(false);
  const portraitInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const selected = activeCharacterId;
  const active = entries.find((e) => e.id === selected) ?? null;
  const projection = loadedCharacterId === active?.id ? projectionState : null;

  useEffect(() => {
    if (activeCharacterId && entries.length && !entries.some((entry) => entry.id === activeCharacterId)) {
      onActiveCharacterChange(null);
      return;
    }
    if (!activeCharacterId && entries.length === 1 && entries[0].id) {
      onActiveCharacterChange(entries[0].id);
    }
  }, [activeCharacterId, entries, onActiveCharacterChange]);

  async function reload(force = false) {
    const characterId = active?.id;
    if (!characterId) return;
    const version = ++loadVersion.current;
    const key = `/api/character-detail?id=${encodeURIComponent(characterId)}`;
    const cached = readPlayerData<CharacterDetailProjection>(dataScope, key);
    setProjection(cached?.value ?? null);
    setLoadedCharacterId(characterId);
    setLoadError(null);
    setLoading(!cached);
    setRefreshing(!!cached && (force || !cached.fresh));
    try {
      const next = await requestPlayerData(
        dataScope,
        key,
        () => api<CharacterDetailProjection>(key),
        { force },
      );
      if (version !== loadVersion.current) return;
      setProjection(next);
      setLoadedCharacterId(characterId);
      setLoadError(null);
      setState("");
    } catch (e) {
      if (version !== loadVersion.current) return;
      const issue = describeDataError(e);
      setLoadError(e instanceof Error ? e : new Error(issue.detail));
      if (issue.permission) setProjection(null);
    } finally {
      if (version === loadVersion.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    // This fetch intentionally synchronizes the server projection when selection changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return () => { loadVersion.current += 1; };
  }, [selected, active?.version]);

  function invalidateCharacter() {
    if (!active?.id) return;
    invalidatePlayerData(dataScope, `/api/character-detail?id=${encodeURIComponent(active.id)}`);
    invalidatePlayerData(dataScope, "/api/dashboard");
  }

  async function runtime(
    field: "blood" | "willpowerTemporary" | "health",
    value: unknown,
  ) {
    if (!active?.id || !projection || loadedCharacterId !== active.id) return;
    setState("SPEICHERT …");
    try {
      const r = await fetch("/api/character-runtime", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: active.id,
          version: projection.revision.version,
          field,
          value,
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) {
        if (r.status === 409) {
          setState("KONFLIKT – Serverstand wird geladen.");
          invalidateCharacter();
          await reload(true);
          return;
        }
        if ([401, 403, 404].includes(r.status)) {
          purgeProtectedPlayerData();
          setProjection(null);
          setLoadError(new ApiError(data.error || "Charakter ist nicht mehr verfügbar.", r.status));
        }
        throw new ApiError(data.error || "FEHLER", r.status);
      }
      invalidateCharacter();
      await reload(true);
      setState("GESPEICHERT");
    } catch (e) {
      setState("FEHLER: " + (e as Error).message);
      if (describeDataError(e).permission) {
        purgeProtectedPlayerData();
        setProjection(null);
        setLoadError(e instanceof Error ? e : new Error(describeDataError(e).detail));
      }
    }
  }

  function beginRoleEdit(which: "story" | "play") {
    setStoryDraft(text(projection?.roleplay.backgroundStory));
    setPlayDraft(text(projection?.roleplay.playGuide));
    setRoleEdit(which);
  }

  async function saveRoleplay() {
    if (!active?.id || !projection) return;
    setCompanionBusy(true);
    try {
      await api("/api/character-companion", "PATCH", {
        action: "roleplay",
        id: active.id,
        version: projection.revision.version,
        backgroundStory: storyDraft,
        playGuide: playDraft,
      });
      toast.success("Companion gespeichert");
      setRoleEdit(null);
      invalidateCharacter();
      await reload(true);
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
      invalidateCharacter();
      await reload(true);
    } finally {
      setCompanionBusy(false);
    }
  }

  async function uploadMedia(file: File | undefined, type: string) {
    if (!file || !active?.id || !projection) return;
    setCompanionBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("visibility", mediaVisibility);
      const uploaded = await api<{ id: string }>("/api/files", "POST", form);
      await api("/api/character-companion", "PATCH", {
        action: "media",
        id: active.id,
        version: projection.revision.version,
        fileId: uploaded.id,
        mediaType: type,
      });
      toast.success(type === "portrait" ? "Portrait gespeichert" : "Bild gespeichert");
      if (portraitInput.current) portraitInput.current.value = "";
      if (mediaInput.current) mediaInput.current.value = "";
      invalidateCharacter();
      await reload(true);
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
      invalidateCharacter();
      await reload(true);
    } finally {
      setCompanionBusy(false);
    }
  }

  function editNote(note?: CharacterCompanionNote) {
    setNoteDraft({
      id: note?.id,
      version: note?.version,
      title: note?.title || "",
      text: note?.text || "",
      visibility: note?.visibility || "private",
    });
  }

  async function saveNote() {
    if (!active?.id || !noteDraft) return;
    setCompanionBusy(true);
    try {
      await api("/api/character-companion", "PATCH", {
        action: noteDraft.id ? "note.update" : "note.create",
        characterId: active.id,
        noteId: noteDraft.id,
        version: noteDraft.version,
        title: noteDraft.title,
        text: noteDraft.text,
        visibility: noteDraft.visibility,
      });
      toast.success("Notiz gespeichert");
      setNoteDraft(null);
      invalidateCharacter();
      await reload(true);
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
      invalidateCharacter();
      await reload(true);
    } finally {
      setCompanionBusy(false);
    }
  }

  async function archiveNote(note: CharacterCompanionNote) {
    if (!active?.id) return;
    setCompanionBusy(true);
    try {
      await api("/api/character-companion", "PATCH", {
        action: "note.archive",
        characterId: active.id,
        noteId: note.id,
        version: note.version,
      });
      toast.success("Notiz archiviert");
      invalidateCharacter();
      await reload(true);
      onRefresh?.();
    } catch (e) {
      toast.error((e as Error).message);
      invalidateCharacter();
      await reload(true);
    } finally {
      setCompanionBusy(false);
    }
  }

  if (!active)
    return (
      <section className="panel character-empty">
        <h2>{entries.length ? "Charakter auswählen" : "Noch kein Charakter"}</h2>
        <p className="muted">
          {entries.length
            ? "Wähle einen deiner Charaktere aus."
            : "Lege deinen ersten Charakter an."}
        </p>
        {entries.length ? (
          <div className="character-picker">
            {entries.map((e) => (
              <button
                type="button"
                className="entry-card"
                key={e.id}
                onClick={() => {
                  const id = e.id ?? null;
                  onActiveCharacterChange(id);
                }}
              >
                <strong>{e.title}</strong>
                <span>{String(e.body.clan || "Clan nicht angegeben")}</span>
              </button>
            ))}
          </div>
        ) : (
          <button className="button primary" onClick={onCreate}>
            <Plus size={16} /> Charakter erstellen
          </button>
        )}
      </section>
    );
  if (loading && !projection)
    return (
      <section className="panel">
        <p>Charakterbogen wird geladen …</p>
      </section>
    );
  if (!projection)
    return (
      <section className="panel">
        <h2>{loadError ? describeDataError(loadError).title : "Charakter konnte nicht geladen werden"}</h2>
        <p className="muted">{loadError?.message || "Bitte erneut versuchen."}</p>
        <button className="button" onClick={() => void reload(true)}>Erneut versuchen</button>
      </section>
    );

  const i = projection.identity;
  const s = projection.sheet;
  const permissions = projection.permissions;
  const will = obj(s.willpower);
  const blood = obj(s.blood);
  const health = obj(s.health);
  const max = n(blood.max);
  const current = n(blood.current);
  const permanent = n(will.permanent);
  const temporary = n(will.temporary);
  const canRuntime = permissions.canChangeRuntimeValues === true;
  const canCompanion = permissions.canEditCompanion === true;
  const companion = projection.companion || {
    media: [],
    notes: [],
    relationships: [],
    lastSession: null,
  };
  const identityFields: Array<[string, unknown]> = [
    ["Spieler", i.player],
    ["Chronik", i.chronicle],
    ["Generation", i.generation],
    ["Wesen", i.nature],
    ["Verhalten", i.demeanor],
    ["Konzept", i.concept],
    ["Erzeuger", i.sire],
  ];

  return (
    <div className="character-detail-page">
      {refreshing && <p className="muted" role="status">Charakterbogen wird aktualisiert …</p>}
      {loadError && <div role="alert" className="error-box"><strong>{describeDataError(loadError).title}</strong><p>{loadError.message}</p><button className="button" onClick={() => void reload(true)}>Erneut versuchen</button></div>}
      <header className="character-hero">
        <div className="character-portrait">
          {typeof i.portraitRef === "string" && i.portraitRef ? (
            <img src={i.portraitRef} alt="Charakterporträt" />
          ) : (
            <>
              <span>V20</span>
              <small>PORTRÄT</small>
            </>
          )}
        </div>
        <div className="character-hero-copy">
          <p className="eyebrow">{String(i.clan || "CHARAKTER")}</p>
          <h2>{String(i.name || active.title)}</h2>
          <p className="character-motto">
            {String(i.concept || "Keine Charakteraussage hinterlegt.")}
          </p>
          <dl className="character-identity">
            {identityFields.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{String(value ?? "Nicht angegeben")}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="character-hero-actions">
          {entries.length > 1 && (
            <label className="character-active-select">
              <span>Aktiver Charakter</span>
              <select
                aria-label="Aktiver Charakter"
                value={active.id ?? ""}
                onChange={(event) => {
                  const id = event.target.value || null;
                  onActiveCharacterChange(id);
                }}
              >
                {entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
              </select>
            </label>
          )}
          {permissions.canEdit === true && (
            <button
              className="button primary character-edit"
              onClick={() => onEdit(active)}
            >
              <Pencil size={16} /> Bogen bearbeiten
            </button>
          )}
          {canCompanion && (
            <label className="button character-upload-trigger">
              <Camera size={16} /> Portrait ändern
              <input
                ref={portraitInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={companionBusy}
                onChange={(e) => void uploadMedia(e.target.files?.[0], "portrait")}
              />
            </label>
          )}
        </div>
      </header>

      <div className="character-layout">
        <section className="character-sheet">
          <div className="sheet-heading">
            <p className="eyebrow">V20 CHARACTER SHEET</p>
            <h3>Charakterbogen</h3>
          </div>
          <section className="sheet-block">
            <div className="sheet-block-heading">
              <span>01</span>
              <h3>Attribute</h3>
            </div>
            <div className="sheet-columns attribute-columns">
              {attrsGroups.map(([title, names]) => (
                <RatingGroup
                  key={title}
                  title={title}
                  names={names}
                  values={obj(s.attributes) as Record<string, number>}
                  disabled
                />
              ))}
            </div>
          </section>
          <section className="sheet-block">
            <div className="sheet-block-heading">
              <span>02</span>
              <h3>Fähigkeiten</h3>
            </div>
            <div className="sheet-columns ability-columns">
              {skillGroups.map(([title, names]) => (
                <RatingGroup
                  key={title}
                  title={title}
                  names={names}
                  values={obj(s.abilities) as Record<string, number>}
                  disabled
                />
              ))}
              <CharacterListReadout label="Freie Fähigkeiten" value={s.customAbilities} />
            </div>
          </section>
          <section className="sheet-block">
            <div className="sheet-block-heading">
              <span>03</span>
              <h3>Vorteile</h3>
            </div>
            <div className="sheet-columns advantage-columns">
              <CharacterListReadout label="Disziplinen" value={s.disciplines} />
              <CharacterListReadout label="Hintergründe" value={s.backgrounds} />
              <RatingGroup
                title="Tugenden"
                names={["Gewissen", "Selbstbeherrschung", "Mut"]}
                values={obj(s.virtues) as Record<string, number>}
                disabled
              />
            </div>
          </section>
          <section className="sheet-block sheet-traits">
            <div className="sheet-block-heading">
              <span>04</span>
              <h3>Vorzüge & Schwächen</h3>
            </div>
            <div className="sheet-columns">
              <CharacterListReadout label="Vorzüge" value={s.merits} metric="cost" />
              <CharacterListReadout label="Schwächen" value={s.flaws} metric="cost" />
              <section className="rating-section">
                <h4>Menschlichkeit & Pfad</h4>
                <p className="character-list-line">
                  <span>Menschlichkeit</span>
                  <b>{String(s.humanity ?? "–")}</b>
                </p>
                <p className="muted">{String(s.humanityPath || "Kein Pfad hinterlegt")}</p>
                <p className="muted preserve-lines">
                  {String(s.clanWeakness || "Keine Clansschwäche hinterlegt.")}
                </p>
              </section>
            </div>
          </section>
        </section>

        <aside className="character-runtime">
          <div className="runtime-heading">
            <p className="eyebrow">AKTUELLER ZUSTAND</p>
            <h3>Die heutige Nacht</h3>
          </div>
          <section className="runtime-block blood-block">
            <div className="runtime-label">
              <span>Blutvorrat</span>
              <small>Blut pro Runde: {String(blood.perRound ?? "–")}</small>
            </div>
            <div className="blood-dots" aria-label={"Blutvorrat: " + current + " von " + max}>
              {Array.from({ length: max }, (_, index) => (
                <span className={index < current ? "filled" : ""} key={index} aria-hidden="true">
                  ●
                </span>
              ))}
            </div>
            <div className="blood-controls">
              <button
                type="button"
                aria-label="Blut verringern"
                disabled={!canRuntime || current <= 0}
                onClick={() => void runtime("blood", current - 1)}
              >
                −
              </button>
              <strong>
                {current} / {max}
              </strong>
              <button
                type="button"
                aria-label="Blut erhöhen"
                disabled={!canRuntime || current >= max}
                onClick={() => void runtime("blood", current + 1)}
              >
                +
              </button>
            </div>
          </section>
          <section className="runtime-block">
            <div className="runtime-label">
              <span>Willenskraft</span>
              <small>Permanent und aktuell</small>
            </div>
            <div className="willpower-row">
              <span>Permanent</span>
              <Dots value={permanent} max={10} disabled label="Willenskraft permanent" />
            </div>
            <div className="willpower-row">
              <span>Aktuell</span>
              <Dots
                value={temporary}
                max={10}
                disabled={!canRuntime}
                label="Willenskraft aktuell"
                onChange={(v) => void runtime("willpowerTemporary", v)}
              />
            </div>
          </section>
          <section className="runtime-block health-block">
            <div className="runtime-label">
              <span>Gesundheit</span>
              <small>Aktueller Zustand auswählen</small>
            </div>
            {healthLevels.map((level) => (
              <button
                type="button"
                key={level.name}
                disabled={!canRuntime}
                className={health.current === level.name ? "health-choice active" : "health-choice"}
                onClick={() => void runtime("health", level.name)}
              >
                <span className="health-marker" aria-hidden="true">
                  {health.current === level.name ? "■" : "□"}
                </span>
                <span>{level.name}</span>
                <small>{level.modifier === "0" ? "" : level.modifier}</small>
              </button>
            ))}
          </section>
          <section className="runtime-block experience-block">
            <div className="runtime-label">
              <span>Erfahrung</span>
              <small>Fortschritt</small>
            </div>
            <div>
              <strong>{String(projection.progression.freeXp ?? "–")}</strong>
              <span>Freie XP</span>
            </div>
            <div>
              <strong>{String(projection.progression.totalXp ?? "–")}</strong>
              <span>Gesamt-XP</span>
            </div>
          </section>
          <p
            className={
              state.startsWith("FEHLER") || state.startsWith("KONFLIKT")
                ? "runtime-status error"
                : "runtime-status"
            }
            aria-live="polite"
          >
            {state || "GESPEICHERT"}
          </p>
        </aside>
      </div>

      <section className="character-companion">
        <div className="companion-column companion-column-left">
          <article className="companion-panel companion-story">
            <header>
              <span className="companion-icon">
                <BookOpen size={18} />
              </span>
              <div>
                <p className="eyebrow">HINTERGRUNDGESCHICHTE</p>
                <h3>Vergangenheit & Antrieb</h3>
              </div>
              {canCompanion && (
                <button className="button" onClick={() => beginRoleEdit("story")}>
                  <Pencil size={15} /> Bearbeiten
                </button>
              )}
            </header>
            {roleEdit === "story" ? (
              <div className="companion-edit">
                <textarea
                  rows={9}
                  value={storyDraft}
                  onChange={(e) => setStoryDraft(e.target.value)}
                />
                <div className="companion-actions">
                  <button className="button primary" disabled={companionBusy} onClick={() => void saveRoleplay()}>
                    <Save size={15} /> Speichern
                  </button>
                  <button className="button" disabled={companionBusy} onClick={() => setRoleEdit(null)}>
                    <X size={15} /> Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <p className="preserve-lines">
                {text(projection.roleplay.backgroundStory) || "Noch keine Hintergrundgeschichte hinterlegt."}
              </p>
            )}
          </article>

          <article className="companion-panel companion-play">
            <header>
              <span className="companion-icon">
                <MessageSquareText size={18} />
              </span>
              <div>
                <p className="eyebrow">SO SPIELE ICH IHN</p>
                <h3>Stimme, Haltung, Reflexe</h3>
              </div>
              {canCompanion && (
                <button className="button" onClick={() => beginRoleEdit("play")}>
                  <Pencil size={15} /> Bearbeiten
                </button>
              )}
            </header>
            {roleEdit === "play" ? (
              <div className="companion-edit">
                <textarea
                  rows={9}
                  value={playDraft}
                  onChange={(e) => setPlayDraft(e.target.value)}
                />
                <div className="companion-actions">
                  <button className="button primary" disabled={companionBusy} onClick={() => void saveRoleplay()}>
                    <Save size={15} /> Speichern
                  </button>
                  <button className="button" disabled={companionBusy} onClick={() => setRoleEdit(null)}>
                    <X size={15} /> Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <p className="preserve-lines">
                {text(projection.roleplay.playGuide) || "Noch keine Spielhilfe hinterlegt."}
              </p>
            )}
          </article>

          <article className="companion-panel companion-notes">
            <header>
              <span className="companion-icon">
                <MessageSquareText size={18} />
              </span>
              <div>
                <p className="eyebrow">AKTUELLE NOTIZEN</p>
                <h3>Privat und geteilt</h3>
              </div>
              {permissions.canCreateNotes === true && (
                <button className="button" onClick={() => editNote()}>
                  <Plus size={15} /> Notiz
                </button>
              )}
            </header>
            {noteDraft && (
              <div className="companion-note-form">
                <label className="field">
                  <span>Titel</span>
                  <input
                    value={noteDraft.title}
                    onChange={(e) => setNoteDraft({ ...noteDraft, title: e.target.value })}
                    maxLength={120}
                  />
                </label>
                <Choice
                  label="Sichtbarkeit"
                  value={noteDraft.visibility}
                  onChange={(value) => setNoteDraft({ ...noteDraft, visibility: value })}
                  options={Object.entries(visibilityNames)}
                />
                <label className="field wide">
                  <span>Notiz</span>
                  <textarea
                    rows={6}
                    value={noteDraft.text}
                    onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
                  />
                </label>
                <div className="companion-actions wide">
                  <button className="button primary" disabled={companionBusy || !noteDraft.text.trim()} onClick={() => void saveNote()}>
                    <Save size={15} /> Speichern
                  </button>
                  <button className="button" disabled={companionBusy} onClick={() => setNoteDraft(null)}>
                    <X size={15} /> Abbrechen
                  </button>
                </div>
              </div>
            )}
            <div className="companion-note-list">
              {companion.notes.length ? (
                companion.notes.map((note) => (
                  <section className="companion-note" key={note.id}>
                    <div>
                      <span className="badge">{visibilityNames[note.visibility] || note.visibility}</span>
                      <h4>{note.title}</h4>
                      <p className="preserve-lines">{note.text}</p>
                      <small>Geändert {new Date(note.updatedAt).toLocaleDateString("de-DE")}</small>
                    </div>
                    {note.canEdit && (
                      <div className="companion-note-actions">
                        <button className="button" onClick={() => editNote(note)}>
                          <Pencil size={14} /> Bearbeiten
                        </button>
                        <button className="danger-link" onClick={() => void archiveNote(note)}>
                          <Trash2 size={14} /> Archivieren
                        </button>
                      </div>
                    )}
                  </section>
                ))
              ) : (
                <p className="muted">Noch keine Character-Notizen hinterlegt.</p>
              )}
            </div>
          </article>
        </div>

        <div className="companion-column companion-column-right">
          <article className="companion-panel companion-media">
            <header>
              <span className="companion-icon">
                <Camera size={18} />
              </span>
              <div>
                <p className="eyebrow">CHARAKTERBILDER</p>
                <h3>Portrait & Referenzen</h3>
              </div>
            </header>
            {canCompanion && (
              <div className="companion-media-upload">
                <Choice
                  label="Typ"
                  value={mediaType}
                  onChange={setMediaType}
                  options={Object.entries(mediaLabels)}
                />
                <Choice
                  label="Sichtbarkeit"
                  value={mediaVisibility}
                  onChange={setMediaVisibility}
                  options={Object.entries(visibilityNames)}
                />
                <label className="button">
                  <Upload size={15} /> Bild hochladen
                  <input
                    ref={mediaInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={companionBusy}
                    onChange={(e) => void uploadMedia(e.target.files?.[0], mediaType)}
                  />
                </label>
              </div>
            )}
            <div className="companion-media-strip">
              {companion.media.length ? (
                companion.media.map((item) => (
                  <figure key={item.id}>
                    <img src={item.src} alt={item.name} />
                    <figcaption>
                      <span>{mediaLabels[item.type] || item.type}</span>
                      <small>{item.name}</small>
                    </figcaption>
                  </figure>
                ))
              ) : (
                <p className="muted">Noch keine sicheren Charakterbilder verbunden.</p>
              )}
            </div>
          </article>

          <article className="companion-panel companion-relationships">
            <header>
              <span className="companion-icon">
                <Users size={18} />
              </span>
              <div>
                <p className="eyebrow">BEZIEHUNGEN & KONTAKTE</p>
                <h3>Bekannte Verbindungen</h3>
              </div>
            </header>
            {companion.relationships.length ? (
              <div className="relationship-list">
                {companion.relationships.map((rel) => (
                  <section key={rel.id}>
                    <span className="badge">{rel.type}</span>
                    <h4>{rel.name}</h4>
                    <p>{rel.role || "Bekannte Rolle offen"}</p>
                    <small>
                      {rel.status || "Status offen"}
                      {rel.favor !== null ? ` · Gefallen ${rel.favor}` : ""}
                    </small>
                  </section>
                ))}
              </div>
            ) : (
              <p className="muted">Noch keine erlaubten Beziehungen sichtbar.</p>
            )}
          </article>

          <article className="companion-panel companion-session">
            <header>
              <span className="companion-icon">
                <CalendarDays size={18} />
              </span>
              <div>
                <p className="eyebrow">LETZTE SITZUNG</p>
                <h3>Kontext für die nächste Nacht</h3>
              </div>
            </header>
            {companion.lastSession ? (
              <div className="last-session-card">
                <span className="date-label">{companion.lastSession.date || "Datum offen"}</span>
                <h4>{companion.lastSession.title}</h4>
                <p>{companion.lastSession.summary || "Keine player-sichere Zusammenfassung hinterlegt."}</p>
              </div>
            ) : (
              <p className="muted">Noch kein freigegebener Sitzungskontext vorhanden.</p>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

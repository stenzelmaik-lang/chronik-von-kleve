"use client";
import { useState } from "react";
import { PROFILE_BLOCKS, PROFILE_DESCRIPTION_FIELDS, readProfile, type CharacterProfile, type ProfileBlock } from "@/domain/character-profile";
import { api } from "../api-client";
import sheet from "./character-sheet.module.css";
import styles from "./character-profile.module.css";

const visibilityLabel = { private: "Nur ich und die SL", group: "Für die Gruppe sichtbar" } as const;

/** One block's sharing choice. Other players only ever see blocks set to "group". */
function Share({ block, value, disabled, onChange }: { block: ProfileBlock; value: "private" | "group"; disabled: boolean; onChange: (v: "private" | "group") => void }) {
  const label = PROFILE_BLOCKS.find(([k]) => k === block)![1];
  return <label className={styles.share}><span className={styles.srOnly}>Sichtbarkeit {label}</span><select value={value} disabled={disabled} onChange={e => onChange(e.target.value as "private" | "group")}>{(["private", "group"] as const).map(v => <option key={v} value={v}>{visibilityLabel[v]}</option>)}</select></label>;
}

/**
 * Charakterprofil, page 2 of the V20 sheet: description, allies and contacts, and which blocks the group may see.
 * Story and play guide keep their own editors below; their sharing is chosen here.
 */
export function CharacterProfileEditor({ id, version, profile: stored, canEdit, onSaved }: { id: string; version: number; profile: unknown; canEdit: boolean; onSaved: () => void }) {
  const initial = readProfile({ profile: stored });
  const [draft, setDraft] = useState<CharacterProfile>(initial), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const set = (change: (p: CharacterProfile) => CharacterProfile) => { setDraft(p => change(structuredClone(p))); setStatus(""); };
  async function save() {
    setBusy(true); setStatus("");
    try { await api("/api/character-companion", "PATCH", { action: "profile", id, version, profile: draft }); setStatus("Gespeichert."); onSaved(); }
    catch (e) { setStatus("Nicht gespeichert: " + (e as Error).message + " Deine Eingaben bleiben erhalten."); }
    finally { setBusy(false); }
  }
  const off = !canEdit || busy;
  return <article className={`${sheet.sheet} ${sheet.wide} ${styles.profile}`} aria-label="Charakterprofil">
    <span className={sheet.corners} aria-hidden="true" />
    <p className={styles.intro}>Seite 2 deines Bogens. Hier stellst du deinen Charakter vor. Was du für die Gruppe freigibst, sehen die anderen am Spieltisch in deinem Profil. Alles andere sehen nur du und die SL.</p>
    <section className={sheet.block} aria-labelledby="cp-description">
      <h3 id="cp-description">Beschreibung</h3>
      <Share block="description" value={draft.visibility.description} disabled={off} onChange={v => set(p => { p.visibility.description = v; return p; })} />
      <div className={styles.fields}>{PROFILE_DESCRIPTION_FIELDS.map(([key, label]) => <label key={key} className={styles.field}><span>{label}</span><input value={draft.description[key]} maxLength={120} disabled={off} onChange={e => set(p => { p.description[key] = e.target.value; return p; })} /></label>)}</div>
      <label className={`${styles.field} ${styles.wideField}`}><span>Aussehen und Auftreten</span><textarea rows={4} maxLength={2000} value={draft.description.appearance} disabled={off} onChange={e => set(p => { p.description.appearance = e.target.value; return p; })} /></label>
    </section>
    <section className={sheet.block} aria-labelledby="cp-allies">
      <h3 id="cp-allies">Verbündete & Kontakte</h3>
      <Share block="allies" value={draft.visibility.allies} disabled={off} onChange={v => set(p => { p.visibility.allies = v; return p; })} />
      <label className={`${styles.field} ${styles.wideField}`}><span>Wen dein Charakter kennt, und wie</span><textarea rows={5} maxLength={5000} value={draft.allies} disabled={off} onChange={e => set(p => { p.allies = e.target.value; return p; })} /></label>
    </section>
    <section className={sheet.block} aria-labelledby="cp-sharing">
      <h3 id="cp-sharing">Geschichte und Antrieb</h3>
      <p className={styles.note}>Die Texte schreibst du weiter unten. Hier legst du fest, ob die Gruppe sie sieht.</p>
      <div className={styles.sharingRow}><span>Geschichte</span><Share block="story" value={draft.visibility.story} disabled={off} onChange={v => set(p => { p.visibility.story = v; return p; })} /></div>
      <div className={styles.sharingRow}><span>Antrieb und Auftreten</span><Share block="drive" value={draft.visibility.drive} disabled={off} onChange={v => set(p => { p.visibility.drive = v; return p; })} /></div>
    </section>
    {canEdit && <div className={styles.actions}><button type="button" className={styles.save} disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Speichert …" : "Profil speichern"}</button><span role="status" className={styles.status}>{status || (dirty ? "Ungespeichert" : "")}</span></div>}
  </article>;
}

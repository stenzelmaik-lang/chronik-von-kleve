"use client";
import { useState } from "react";
import { api } from "../api-client";
import { RichTextEditor, RichTextView } from "../rich-text";
import sheet from "./character-sheet.module.css";
import styles from "./character-profile.module.css";

/** Individuelle Angaben (back of the sheet): the player's own notes about the character, framed like the V20 sheet. */
export function IndividualInfo({ id, version, value, canEdit, onSaved }: { id: string; version: number; value: string; canEdit: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState(value), [busy, setBusy] = useState(false), [status, setStatus] = useState("");
  const dirty = draft !== value;
  async function save() {
    setBusy(true); setStatus("");
    try { await api("/api/character-companion", "PATCH", { action: "individual", id, version, individualInfo: draft }); setStatus("Gespeichert."); onSaved(); }
    catch (e) { setStatus("Nicht gespeichert: " + (e as Error).message); }
    finally { setBusy(false); }
  }
  return <article className={`${sheet.sheet} ${sheet.wide} ${styles.profile}`} aria-label="Individuelle Angaben">
    <span className={sheet.corners} aria-hidden="true" />
    <section className={sheet.block} aria-labelledby="ii-title">
      <h3 id="ii-title">Individuelle Angaben</h3>
      <p className={styles.intro}>Die Rückseite deines Bogens: alles, was du selbst über deinen Charakter festhalten willst. Sehen kannst nur du und die SL.</p>
      {canEdit ? <div className={styles.split}>
        <div className={styles.writePane}><RichTextEditor value={draft} onChange={setDraft} label="Individuelle Angaben" placeholder="Eigenheiten, Besitz, Merkposten …" maximumPlainLength={20000} disabled={busy} /></div>
        <aside className={styles.previewPane} aria-label="So sieht es aus"><span className={styles.previewLabel}>So sieht es aus</span>{draft.trim() ? <RichTextView value={draft} readable /> : <p className={styles.note}>Noch leer.</p>}</aside>
      </div> : value.trim() ? <RichTextView value={value} readable /> : <p className={styles.note}>Noch keine individuellen Angaben.</p>}
      {canEdit && <div className={styles.actions}><button type="button" className={styles.save} disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Speichert …" : "Angaben speichern"}</button><span role="status" className={styles.status}>{status || (dirty ? "Ungespeichert" : "")}</span></div>}
    </section>
  </article>;
}

"use client";
/* eslint-disable @next/next/no-img-element -- Private gallery media is served by the authenticated file endpoint. */
import { useEffect, useState, type ReactNode } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { PROFILE_BLOCKS, PROFILE_DESCRIPTION_FIELDS, readProfile, sharedProfile, type CharacterProfile, type ProfileBlock } from "@/domain/character-profile";
import { api } from "../api-client";
import { RichTextEditor, RichTextView } from "../rich-text";
import sheet from "./character-sheet.module.css";
import styles from "./character-profile.module.css";

type Presentation = { published: boolean; tagline: string; introduction: string; gallery: { fileId: string; caption: string }[] };
type Image = { fileId: string; type: "portrait" | "reference" | "mood" | "scene"; caption: string; shared: boolean };
type Draft = { profile: CharacterProfile; presentation: Presentation; media: Image[]; backgroundStory: string; playGuide: string };
const imageTypes = { portrait: "Porträt", reference: "Referenz", mood: "Stimmung", scene: "Szene" } as const;
/** One image list: linked images first, then a not yet merged appearance gallery (shared if the appearance was published). */
function mergeImages(media: { id: string; type: string; caption?: string; shared?: boolean }[], card: Presentation): Image[] {
  const list: Image[] = media.filter(m => m.type in imageTypes).map(m => ({ fileId: m.id, type: m.type as Image["type"], caption: m.caption ?? "", shared: m.shared === true }));
  for (const g of card.gallery) if (!list.some(m => m.fileId === g.fileId)) list.push({ fileId: g.fileId, type: "reference", caption: g.caption, shared: card.published });
  return list.slice(0, 8);
}
const emptyPresentation: Presentation = { published: false, tagline: "", introduction: "", gallery: [] };
const visibilityLabel = { private: "Nur ich und die SL", group: "Für die Gruppe sichtbar" } as const;
const imageUrl = (fileId: string) => "/api/files?id=" + encodeURIComponent(fileId);

function Share({ block, value, disabled, onChange }: { block: ProfileBlock; value: "private" | "group"; disabled: boolean; onChange: (v: "private" | "group") => void }) {
  const label = PROFILE_BLOCKS.find(([k]) => k === block)![1];
  return <label className={styles.share}><span className={styles.srOnly}>Sichtbarkeit {label}</span><select value={value} disabled={disabled} onChange={e => onChange(e.target.value as "private" | "group")}>{(["private", "group"] as const).map(v => <option key={v} value={v}>{visibilityLabel[v]}</option>)}</select></label>;
}

/**
 * Charakterprofil, page 2 of the V20 sheet, as one system: appearance card, description, story, how the character is
 * played, allies, images and known connections in one frame. One save writes the whole profile; images upload at once.
 */
export function CharacterProfileEditor({ id, version, profile: storedProfile, canEdit, onSaved, onDirtyChange, backgroundStory, playGuide, media, connections }: { id: string; version: number; profile: unknown; canEdit: boolean; onSaved: () => void; onDirtyChange?: (dirty: boolean) => void; backgroundStory: string; playGuide: string; media: { id: string; type: string; caption?: string; shared?: boolean }[]; connections: ReactNode }) {
  const [initial, setInitial] = useState<Draft | null>(null), [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [loadError, setLoadError] = useState("");
  useEffect(() => {
    let live = true;
    api<{ version: number; presentation: Presentation | null }>("/api/character-companion?id=" + encodeURIComponent(id))
      .then(data => { if (!live) return; const card = data.presentation ?? emptyPresentation; const d: Draft = { profile: readProfile({ profile: storedProfile }), presentation: { ...card, gallery: [] }, media: mergeImages(media, card), backgroundStory, playGuide }; setInitial(d); setDraft(structuredClone(d)); })
      .catch(e => { if (live) setLoadError((e as Error).message); });
    return () => { live = false; };
    // The parent remounts this editor on every new version; props of the same version never reset a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const isDirty = !!draft && !!initial && JSON.stringify(draft) !== JSON.stringify(initial);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  if (loadError) return <p role="alert" className={styles.status}>Das Charakterprofil konnte nicht geladen werden: {loadError}</p>;
  if (!draft || !initial) return <p role="status" className={styles.status}>Charakterprofil wird geladen …</p>;
  const dirty = isDirty, off = !canEdit || busy;
  const set = (change: (d: Draft) => void) => { setDraft(d => { const next = structuredClone(d!); change(next); return next; }); setStatus(""); };
  async function save() {
    setBusy(true); setStatus("");
    try { await api("/api/character-companion", "PATCH", { action: "profile", id, version, profile: draft!.profile, presentation: draft!.presentation, media: draft!.media, backgroundStory: draft!.backgroundStory, playGuide: draft!.playGuide }); setStatus("Gespeichert."); onSaved(); }
    catch (e) { setStatus("Nicht gespeichert: " + (e as Error).message + " Deine Eingaben bleiben erhalten."); }
    finally { setBusy(false); }
  }
  async function upload(file: File | undefined) {
    if (!file || draft!.media.length >= 8) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { setStatus("Bitte JPG, PNG oder WebP bis 8 MB auswählen."); return; }
    setBusy(true);
    try { const form = new FormData(); form.set("file", file); form.set("visibility", "private"); const uploaded = await api<{ id: string }>("/api/files", "POST", form); set(d => { d.media.push({ fileId: uploaded.id, type: d.media.some(m => m.type === "portrait") ? "reference" : "portrait", caption: "", shared: false }); }); }
    catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }
  const p = draft.profile, card = draft.presentation;
  const shared = sharedProfile({ profile: p, text: draft.backgroundStory, playGuide: draft.playGuide });
  const sharedNames = [card.published ? "Auftritt" : "", draft.media.some(m => m.shared) ? "Bilder" : "", shared.description || shared.appearance ? "Beschreibung" : "", shared.story ? "Geschichte" : "", shared.drive ? "So spiele ich ihn" : "", shared.allies ? "Verbündete & Kontakte" : ""].filter(Boolean);
  const text = (value: string, label: string, onChange: (v: string) => void) => canEdit
    ? <RichTextEditor value={value} onChange={onChange} label={label} placeholder="Schreib hier …" maximumPlainLength={30000} disabled={busy} />
    : <RichTextView value={value || "Noch nichts hinterlegt."} />;

  return <article className={`${sheet.sheet} ${sheet.wide} ${styles.profile}`} aria-label="Charakterprofil">
    <span className={sheet.corners} aria-hidden="true" />
    <p className={styles.intro}>Seite 2 deines Bogens. Hier stellst du deinen Charakter vor. Was du für die Gruppe freigibst, sehen die anderen am Spieltisch in deinem Profil. Alles andere sehen nur du und die SL.</p>

    <section className={sheet.block} aria-labelledby="cp-card">
      <h3 id="cp-card">Auftritt</h3>
      <label className={styles.publish}><input type="checkbox" checked={card.published} disabled={off} onChange={e => set(d => { d.presentation.published = e.target.checked; })} /> Auftritt für die Gruppe sichtbar</label>
      <label className={`${styles.field} ${styles.wideField}`}><span>Kurzzeile</span><input value={card.tagline} maxLength={100} disabled={off} onChange={e => set(d => { d.presentation.tagline = e.target.value; })} /></label>
      <label className={`${styles.field} ${styles.wideField}`}><span>Vorstellung</span><textarea rows={4} maxLength={1200} value={card.introduction} disabled={off} onChange={e => set(d => { d.presentation.introduction = e.target.value; })} /></label>
    </section>

    <section className={sheet.block} aria-labelledby="cp-description">
      <h3 id="cp-description">Beschreibung</h3>
      <Share block="description" value={p.visibility.description} disabled={off} onChange={v => set(d => { d.profile.visibility.description = v; })} />
      <div className={styles.fields}>{PROFILE_DESCRIPTION_FIELDS.map(([key, label]) => <label key={key} className={styles.field}><span>{label}</span><input value={p.description[key]} maxLength={120} disabled={off} onChange={e => set(d => { d.profile.description[key] = e.target.value; })} /></label>)}</div>
      <label className={`${styles.field} ${styles.wideField}`}><span>Aussehen und Auftreten</span><textarea rows={4} maxLength={2000} value={p.description.appearance} disabled={off} onChange={e => set(d => { d.profile.description.appearance = e.target.value; })} /></label>
    </section>

    <section className={sheet.block} aria-labelledby="cp-story">
      <h3 id="cp-story">Hintergrundgeschichte</h3>
      <Share block="story" value={p.visibility.story} disabled={off} onChange={v => set(d => { d.profile.visibility.story = v; })} />
      <div className={styles.text}>{text(draft.backgroundStory, "Hintergrundgeschichte", v => set(d => { d.backgroundStory = v; }))}</div>
    </section>

    <section className={sheet.block} aria-labelledby="cp-play">
      <h3 id="cp-play">So spiele ich ihn</h3>
      <Share block="drive" value={p.visibility.drive} disabled={off} onChange={v => set(d => { d.profile.visibility.drive = v; })} />
      <p className={styles.note}>Stimme, Haltung, Reflexe, Antrieb.</p>
      <div className={styles.text}>{text(draft.playGuide, "So spiele ich ihn", v => set(d => { d.playGuide = v; }))}</div>
    </section>

    <section className={sheet.block} aria-labelledby="cp-allies">
      <h3 id="cp-allies">Verbündete & Kontakte</h3>
      <Share block="allies" value={p.visibility.allies} disabled={off} onChange={v => set(d => { d.profile.visibility.allies = v; })} />
      <label className={`${styles.field} ${styles.wideField}`}><span>Wen dein Charakter kennt, und wie</span><textarea rows={5} maxLength={5000} value={p.allies} disabled={off} onChange={e => set(d => { d.profile.allies = e.target.value; })} /></label>
    </section>

    <section className={sheet.block} aria-labelledby="cp-images">
      <h3 id="cp-images">Porträt & Referenzen</h3>
      <p className={styles.note}>Ein Porträt und bis zu sieben Referenzbilder. Je Bild entscheidest du, ob die Gruppe es am Spieltisch sieht.</p>
      <div className={styles.gallery} aria-label="Porträt und Referenzbilder">
        {draft.media.map((item, index) => <figure key={item.fileId} data-portrait={item.type === "portrait"}>
          <img src={imageUrl(item.fileId)} alt={item.caption || imageTypes[item.type] + " " + (index + 1)} />
          <select aria-label={"Art von Bild " + (index + 1)} value={item.type} disabled={off} onChange={e => set(d => { const t = e.target.value as Image["type"]; if (t === "portrait") d.media.forEach(m => { if (m.type === "portrait") m.type = "reference"; }); d.media[index].type = t; })}>{Object.entries(imageTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <input aria-label={"Bildunterschrift " + (index + 1)} value={item.caption} maxLength={160} disabled={off} placeholder="Bildunterschrift" onChange={e => set(d => { d.media[index].caption = e.target.value; })} />
          <select aria-label={"Sichtbarkeit von Bild " + (index + 1)} value={item.shared ? "group" : "private"} disabled={off} onChange={e => set(d => { d.media[index].shared = e.target.value === "group"; })}>{(["private", "group"] as const).map(v => <option key={v} value={v}>{visibilityLabel[v]}</option>)}</select>
          {canEdit && <button type="button" aria-label={"Bild " + (index + 1) + " entfernen"} disabled={busy} onClick={() => set(d => { d.media.splice(index, 1); })}><Trash2 size={14} /></button>}
        </figure>)}
        {canEdit && draft.media.length < 8 && <label className={styles.addImage}><ImagePlus size={18} aria-hidden="true" /><span>Bild hinzufügen</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label>}
        {!canEdit && !draft.media.length && <p className={styles.note}>Noch keine Bilder.</p>}
      </div>
    </section>

    {canEdit && <div className={styles.actions}><button type="button" className={styles.save} disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Speichert …" : "Profil speichern"}</button><span role="status" className={styles.status}>{status || (dirty ? "Ungespeichert" : "")}</span></div>}

    <section className={sheet.block} aria-labelledby="cp-connections">
      <h3 id="cp-connections">Bekannte Verbindungen</h3>
      <div className={styles.slot}>{connections}</div>
    </section>

    <section className={sheet.block} aria-labelledby="cp-preview">
      <h3 id="cp-preview">So sehen dich die anderen</h3>
      <div className={styles.preview}>
        {card.published && card.tagline && <p className={styles.previewTagline}>{card.tagline}</p>}
        {card.published && card.introduction && <p>{card.introduction}</p>}
        <p className={styles.note}>{sharedNames.length ? "Am Spieltisch sichtbar: " + sharedNames.join(", ") + "." : "Am Spieltisch sieht die Gruppe noch nichts aus deinem Profil."}{dirty ? " Stand nach dem Speichern." : ""}</p>
      </div>
    </section>
  </article>;
}

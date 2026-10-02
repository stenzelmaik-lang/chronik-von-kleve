"use client";
import { useState } from "react";
import { Archive, ArrowDownToLine, Backpack, Pencil, RotateCcw, Shirt, X } from "lucide-react";
import type { BodySlot, InventoryItem, InventoryProjection } from "@/domain/inventory";
import { bodySlots } from "@/domain/inventory";
import { slotCategoryIssue } from "@/domain/inventory-rules";
import { ItemImage } from "./item-tile";
import { bodySlotLabels, concealmentLabels, placementText, visibilityLabels } from "./shared";
import styles from "./inventory.module.css";
export function ItemInspector({ item, projection, busy, onEdit, onMove, onArchive, onRestore, onClose }: { item: InventoryItem; projection: InventoryProjection; busy: boolean; onEdit: () => void; onMove: (location: "STORED" | "BACKPACK" | "BODY", slot?: BodySlot) => void; onArchive: () => void; onRestore: () => void; onClose: () => void }) {
  const [archive, setArchive] = useState(false), [slot, setSlot] = useState<BodySlot | "">("");
  const archived = item.lifecycleStatus === "ARCHIVED", warning = projection.carry.warningItems.includes(item.id);
  return <section className={styles.inspector} aria-label="Gegenstandsdetails">
    <header><p className={styles.eyebrow}>GEGENSTAND · {item.category}</p><button type="button" className={styles.iconButton} aria-label="Gegenstandsdetails schließen" onClick={onClose}><X size={18}/></button></header>
    <div className={styles.detailIdentity}><ItemImage key={`${item.id}:${item.revision}`} item={item}/><div><h3>{item.name}</h3><span className={`${styles.stateBadge} ${archived ? styles.archiveBadge : ""}`}>{archived ? "Archiviert" : placementText(item)}</span><small>{visibilityLabels[item.visibility]}</small></div></div>
    <p className={styles.description}>{item.description || "Keine Beschreibung hinterlegt."}</p>
    <dl className={styles.detailFacts}><div><dt>Menge</dt><dd>{item.quantity}</dd></div><div><dt>Trageplätze</dt><dd>{item.slotCost}</dd></div>{item.weightKg !== undefined && <div><dt>Gewicht · Info</dt><dd>{item.weightKg} kg</dd></div>}</dl>
    {item.weaponProfile && <div className={styles.ruleReadout}><h4>Waffenprofil · V20</h4><dl>{([["damage", "Schaden"], ["range", "Reichweite"], ["rate", "Schussfolge"], ["capacity", "Magazin"], ["currentAmmo", "Munition"]] as const).map(([k, l]) => <div key={k}><dt>{l}</dt><dd>{item.weaponProfile?.[k] ?? "—"}</dd></div>)}</dl><p>{item.weaponProfile.concealmentClass ? concealmentLabels[item.weaponProfile.concealmentClass] : item.weaponProfile.concealability || "Verbergung nicht hinterlegt"}</p>{item.weaponProfile.note && <p>{item.weaponProfile.note}</p>}{warning && <p className={styles.warning}>Offen oder nicht zur Verbergung passend platziert.</p>}</div>}
    {item.armorProfile && <div className={styles.ruleReadout}><h4>Schutz / Rüstung</h4><dl><div><dt>Klasse</dt><dd>{item.armorProfile.armorClass ?? "—"}</dd></div><div><dt>Rüstungswert</dt><dd>{item.armorProfile.armorValue ?? "—"}</dd></div><div><dt>Geschick-Abzug</dt><dd>{item.armorProfile.dexterityPenalty ?? "—"}</dd></div></dl><p>Vorhandene Werte · keine automatische Änderung des Charakterbogens.</p></div>}
    {item.tags.length > 0 && <div className={styles.tags}>{item.tags.map(t => <span key={t}>{t}</span>)}</div>}
    {item.canEdit ? <div className={styles.detailActions}>
      {archived ? <button className="button" disabled={busy} onClick={onRestore}><RotateCcw size={16}/>Ins Lager wiederherstellen</button> : <>
        <div className={styles.moveButtons}><button className="button" disabled={busy || item.location === "BACKPACK"} onClick={() => onMove("BACKPACK")}><Backpack size={15}/>{item.location === "BODY" ? "Ablegen" : "Mitnehmen"}</button><button className="button" disabled={busy || item.location === "STORED"} onClick={() => onMove("STORED")}><ArrowDownToLine size={15}/>Einlagern</button></div>
        <div className={styles.equipControls}><label className={styles.field}><span>Anlegen / Platz wechseln</span><select aria-label="Ausrüstungsplatz" value={slot} disabled={busy} onChange={e => setSlot(e.target.value as BodySlot)}><option value="">Körperplatz auswählen …</option>{bodySlots.map(s => { const occupied = projection.items.some(i => i.id !== item.id && i.lifecycleStatus === "ACTIVE" && i.location === "BODY" && i.bodySlot === s), issue = slotCategoryIssue(item.category, s); return <option key={s} value={s} disabled={occupied || !!issue}>{bodySlotLabels[s]}{occupied ? " · belegt" : issue ? " · nicht passend" : ""}</option>; })}</select></label><button className="button primary" disabled={busy || !slot} onClick={() => { if (slot) onMove("BODY", slot); }}><Shirt size={16}/>Anlegen</button></div>
        <button className="button" disabled={busy} onClick={onEdit}><Pencil size={15}/>Details bearbeiten</button>
      </>}
      {archive ? <div className={styles.confirmPanel}><strong>Aus dem aktiven Inventar nehmen?</strong><p>Der Gegenstand bleibt im Archiv erhalten.</p><button type="button" className="button" disabled={busy} onClick={() => setArchive(false)}>Behalten</button><button type="button" className="button" disabled={busy} onClick={onArchive}>Archivieren bestätigen</button></div> : !archived && <button type="button" className={styles.textButton} disabled={busy} onClick={() => setArchive(true)}><Archive size={14}/>Archivieren</button>}
    </div> : <p className={styles.scopeNotice}>Du kannst diesen Gegenstand ansehen. Änderungen sind für dein Konto gesperrt.</p>}
    <footer className={styles.savedAt}>Gespeichert am {new Date(item.updatedAt).toLocaleString("de-DE")}</footer>
  </section>;
}

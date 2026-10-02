"use client";
import { useMemo, useState } from "react";
import { Backpack, Box, ChevronRight, CircleCheck, LockKeyhole, Plus, RefreshCw, Search, Shield, Shirt, TriangleAlert, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { carryProfiles, type BodySlot, type CarryProfile, type InventoryItem, type ItemLocation } from "@/domain/inventory";
import { slotCategoryIssue, statusForLocation } from "@/domain/inventory-rules";
import { api } from "./api-client";
import { describeDataError } from "./player-data-cache";
import { BodyLoadout } from "./inventory/body-loadout";
import { ItemTile } from "./inventory/item-tile";
import { ItemEditor } from "./inventory/item-editor";
import { ItemInspector } from "./inventory/item-inspector";
import { useInventory } from "./inventory/use-inventory";
import { attentionLabels, bodySlotLabels, freshItem, itemDraft, placementText, type ItemDraft } from "./inventory/shared";
import styles from "./inventory/inventory.module.css";

export function InventoryPanel({ dataScope, activeCharacterId, onActiveCharacterChange }: { dataScope: string; activeCharacterId: string | null; onActiveCharacterChange: (id: string | null) => void }) {
  const { data: p, error: loadError, loading, refreshing, load, refresh } = useInventory(dataScope, activeCharacterId, onActiveCharacterChange);
  const [selectedId, setSelectedId] = useState<string | undefined>(), [draft, setDraft] = useState<ItemDraft | null>(null), [slotTarget, setSlotTarget] = useState<BodySlot | null>(null);
  const [search, setSearch] = useState(""), [category, setCategory] = useState("Alle"), [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const selected = p?.items.find(i => i.id === selectedId), active = p?.items.filter(i => i.lifecycleStatus === "ACTIVE") || [];
  const filtered = useMemo(() => p?.items.filter(i => (showArchived || i.lifecycleStatus === "ACTIVE") && (category === "Alle" || i.category === category) && [i.name, i.description, ...i.tags].join(" ").toLocaleLowerCase("de-DE").includes(search.toLocaleLowerCase("de-DE"))) || [], [p, search, category, showArchived]);
  const failed = (e: unknown) => { setError(describeDataError(e).detail); setMessage(""); };
  function openEditor(item?: InventoryItem, location: ItemLocation = "BACKPACK", slot?: BodySlot) {
    if (!p?.selectedCharacter || (!item && !p.permissions.canCreate) || (item && !item.canEdit)) return;
    setError(""); setDraft(item ? itemDraft(item) : freshItem(p.selectedCharacter.id, p.permissions.allowedVisibilities[0], location, slot));
  }
  async function persist(data: ItemDraft, action: "update" | "archive" = "update") {
    if (!p || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await api<{ id: string }>("/api/inventory", data.id ? "PATCH" : "POST", { ...data, action: data.id ? action : "create", expectedCarryRevision: p.carry.revision, weaponProfile: data.category === "Waffe" ? data.weaponProfile || { damage: "", range: "", rate: "", capacity: "", concealability: "" } : undefined, armorProfile: data.category === "Schutz / Rüstung" ? data.armorProfile : undefined });
      setDraft(null); setSlotTarget(null); setSelectedId(action === "archive" ? undefined : result.id);
      await refresh(); setMessage(action === "archive" ? "Archiviert. Der Gegenstand bleibt erhalten." : "Gespeichert. Dein Inventar ist aktuell.");
    } catch (e) { failed(e); } finally { setSaving(false); }
  }
  async function move(id: string, location: ItemLocation, slot?: BodySlot) {
    const item = p?.items.find(i => i.id === id);
    if (!item?.canEdit || item.lifecycleStatus !== "ACTIVE") return;
    await persist({ ...itemDraft(item), location, status: statusForLocation(location), bodySlot: location === "BODY" ? slot : undefined });
  }
  async function upload(file: File) {
    if (!draft || uploading || saving) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) { setError("Bitte ein PNG-, JPG- oder WebP-Bild bis 10 MB auswählen."); return; }
    setUploading(true); setError("");
    try {
      const form = new FormData(); form.set("file", file); form.set("visibility", draft.visibility); form.set("characterId", draft.characterId);
      const result = await api<{ id: string }>("/api/inventory/media", "POST", form);
      setDraft(current => current ? { ...current, imageFileId: result.id } : current);
    } catch (e) { failed(e); } finally { setUploading(false); }
  }
  async function switchProfile(profile: CarryProfile) {
    if (!p?.selectedCharacter || saving || !p.permissions.canChangeProfile) return;
    setSaving(true); setError(""); setMessage("");
    try { await api("/api/inventory/profile", "PATCH", { characterId: p.selectedCharacter.id, profile, expectedRevision: p.carry.revision }); await refresh(); setMessage("Trageprofil gespeichert."); } catch (e) { failed(e); } finally { setSaving(false); }
  }
  const selector = p && <label className={styles.characterSelect}><span>Charakter</span><select aria-label="Inventar-Charakter" disabled={saving} value={p.selectedCharacter?.id || ""} onChange={e => { setSelectedId(undefined); setError(""); setMessage(""); onActiveCharacterChange(e.target.value || null); }}><option value="">Charakter auswählen …</option>{p.characters.map(c => <option key={c.id} value={c.id}>{c.name}{c.own ? "" : " · SL-Zugriff"}</option>)}</select></label>;
  if (loading && !p) return <section className={styles.emptyPage} role="status"><Backpack size={32}/><h2>Ausrüstung wird geladen …</h2></section>;
  if (loadError && !p) return <section className={styles.emptyPage} role="alert"><TriangleAlert size={32}/><h2>{describeDataError(loadError).title}</h2><p>{describeDataError(loadError).detail}</p><button className="button" onClick={() => void load(true)}>Erneut laden</button></section>;
  if (!p?.selectedCharacter) return <section className={styles.emptyPage}><Backpack size={36}/><p className={styles.eyebrow}>DEINE AUSRÜSTUNG</p><h2>{p?.characters.length ? "Wessen Inventar öffnest du?" : "Ein Charakter, ein Inventar."}</h2><p>{p?.characters.length ? "Wähle den Charakter für diesen Spielabend." : "Erstelle zuerst deinen Charakter. Gegenstände bleiben eindeutig mit ihm verbunden."}</p>{p?.characters.length ? selector : <a className="button primary" href="/spielbereich?bereich=charaktere">Zu den Charakteren</a>}</section>;
  const backpack = filtered.filter(i => i.lifecycleStatus === "ACTIVE" && i.location === "BACKPACK"), stored = filtered.filter(i => i.lifecycleStatus === "ACTIVE" && i.location === "STORED"), archived = filtered.filter(i => i.lifecycleStatus === "ARCHIVED");
  const own = p.selectedCharacter.own, canMutate = p.permissions.canEdit, visibleSlots = p.carry.used, capacity = p.carry.capacity;
  const tiles = (items: InventoryItem[], empty: string) => items.length ? <div className={styles.itemGrid}>{items.map(item => <ItemTile key={item.id} item={item} selected={item.id === selectedId} warning={p.carry.warningItems.includes(item.id)} onSelect={() => { setSelectedId(item.id); setError(""); }}/>)}</div> : <div className={styles.emptyZone}><Box size={23}/><span>{empty}</span></div>;
  const drop = (location: "BACKPACK" | "STORED") => ({ onDragOver: (e: React.DragEvent<HTMLElement>) => { if (e.dataTransfer.types.includes("application/x-chroniplay-item")) e.preventDefault(); }, onDrop: (e: React.DragEvent<HTMLElement>) => { e.preventDefault(); if (!saving) void move(e.dataTransfer.getData("application/x-chroniplay-item"), location); } });
  return <div className={styles.root} aria-busy={saving}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>{own ? "CHARAKTER · AUSRÜSTUNG" : "SPIELLEITUNG · GETEILTE AUSRÜSTUNG"}</p><h1>{p.selectedCharacter.name}</h1><span>Bereit für die nächste Nacht.</span></div><div className={styles.heroActions}>{p.characters.length > 1 && selector}<a className={styles.characterLink} href={`/spielbereich?bereich=charaktere&character=${encodeURIComponent(p.selectedCharacter.id)}`}>Charakterbogen <ChevronRight size={15}/></a><button className={styles.iconButton} aria-label="Inventar aktualisieren" disabled={saving} onClick={() => void load(true)}><RefreshCw className={refreshing ? styles.spinning : ""} size={18}/></button></div></header>
    {!own && <div className={styles.scopeNotice}><Shield size={16}/><span>Du bearbeitest freigegebene Gegenstände dieses Kampagnencharakters. Persönliche Gegenstände bleiben verborgen. Eigentum bleibt beim Charakter; sein Trageprofil ändert nur der Spieler.</span></div>}
    {error && !draft && <div className={styles.error} role="alert"><TriangleAlert size={17}/><span>{error}</span><button type="button" className={styles.textButton} onClick={() => void load(true)}>Aktuellen Stand laden</button></div>}
    <div className={styles.feedback} role="status" aria-live="polite">{message && <><CircleCheck size={14}/>{message}</>}</div>
    <div className={styles.carryBar}><div className={styles.capacity}><Backpack size={22}/><div><span className={styles.eyebrow}>{p.carry.complete ? "TRAGEKAPAZITÄT" : "FREIGEGEBENES GEPÄCK"}</span><strong>{visibleSlots}<small> / {capacity} Plätze</small></strong><span>{p.carry.complete ? "Körper + Rucksack · Lager zählt nicht" : "Nur sichtbare Gegenstände · volle Trageprüfung auf dem Server"}</span></div><div className={styles.capacityTrack} role="progressbar" aria-label={p.carry.complete ? "Belegte Tragekapazität" : "Sichtbare Trageplätze"} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={Math.min(visibleSlots, capacity)}><span style={{ width: Math.min(100, visibleSlots / capacity * 100) + "%" }}/></div></div><div className={`${styles.attention} ${p.carry.warningItems.length ? styles.attentionWarning : ""}`}><span className={styles.eyebrow}>AUFFÄLLIGKEIT{p.carry.complete ? "" : " · SICHTBARER AUSSCHNITT"}</span><strong>{attentionLabels[p.carry.attention]}</strong><small>{p.carry.openVisibleItems.length ? p.carry.openVisibleItems.length + " sichtbar getragene Gegenstände" : "Keine offene Platzierung im sichtbaren Inventar"}</small></div><button className="button primary" disabled={saving || !p.permissions.canCreate} onClick={() => openEditor()}><Plus size={17}/>Gegenstand hinzufügen</button></div>
    <section className={styles.profileBar} aria-label="Trageprofil"><span>Trageprofil</span>{Object.entries(carryProfiles).map(([key, value]) => { const exceeds = own && visibleSlots > value.capacity; return <button type="button" key={key} disabled={saving || !p.permissions.canChangeProfile || exceeds} aria-pressed={p.carry.profile === key} className={p.carry.profile === key ? styles.activeProfile : ""} title={exceeds ? "Zuerst " + (visibleSlots - value.capacity) + " Plätze einlagern." : !p.permissions.canChangeProfile ? "Nur der Eigentümer ändert sein persönliches Trageprofil." : undefined} onClick={() => void switchProfile(key as CarryProfile)}>{value.label}<small>{value.capacity}</small></button>; })}</section>
    <div className={styles.mainGrid}>
      <section className={styles.bodyPanel} aria-label="Charakter und Ausrüstung"><div className={styles.zoneHeader}><div><p className={styles.eyebrow}>01 · DEIN AUFTRITT</p><h2>Am Körper</h2></div><Shirt size={22}/></div><p className={styles.zoneIntro}>Wähle einen Platz zum Anlegen. Belegte Plätze öffnen den Gegenstand.</p><BodyLoadout items={p.items} selectedId={selectedId} busy={saving} onSlot={(slot, item) => item ? setSelectedId(item.id) : setSlotTarget(slot)} onMove={(id, slot) => { if (!saving) void move(id, "BODY", slot); }}/></section>
      <div className={styles.rightColumn}>
        <section className={styles.bagPanel} aria-label="Rucksack" {...drop("BACKPACK")}><div className={styles.zoneHeader}><div><p className={styles.eyebrow}>02 · MITGEFÜHRT</p><h2>Im Rucksack</h2></div><span className={styles.countBadge}>{active.filter(i => i.location === "BACKPACK").length}</span></div><div className={styles.tools}><label className={styles.search}><Search size={17}/><input aria-label="Inventar durchsuchen" placeholder="Name, Beschreibung oder Tag …" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Suche zurücksetzen" onClick={() => setSearch("")}><X size={14}/></button>}</label><select aria-label="Gegenstandskategorie filtern" value={category} onChange={e => setCategory(e.target.value)}><option>Alle</option>{["Waffe", "Schutz / Rüstung", "Kleidung", "Elektronik", "Werkzeug", "Medizin", "Schlüssel", "Dokument", "Verbrauchsgegenstand", "Sonstiges"].map(c => <option key={c}>{c}</option>)}</select></div>
          {(search || category !== "Alle") && <div className={styles.searchResults} aria-label="Suchergebnisse"><span>{filtered.length} Treffer im Inventar</span>{filtered.map(i => <button key={i.id} onClick={() => setSelectedId(i.id)}>{i.name}<small>{i.lifecycleStatus === "ARCHIVED" ? "Archiv" : placementText(i)}</small></button>)}</div>}
          {tiles(backpack, search || category !== "Alle" ? "Keine passenden Gegenstände im Rucksack." : "Noch nichts eingepackt. Nimm einen Gegenstand aus dem Lager mit.")}
          <div className={styles.bagFooter}><LockKeyhole size={14}/><span>Geschützt gespeichert · Aktionen auch ohne Ziehen möglich.</span></div>
        </section>
        {selected && <ItemInspector key={selected.id} item={selected} projection={p} busy={saving} onClose={() => setSelectedId(undefined)} onEdit={() => openEditor(selected)} onMove={(where, slot) => void move(selected.id, where, slot)} onArchive={() => void persist(itemDraft(selected), "archive")} onRestore={() => void persist({ ...itemDraft(selected), location: "STORED", status: "Gelagert", bodySlot: undefined })}/>}
      </div>
    </div>
    <section className={styles.storagePanel} aria-label="Gelagerte Gegenstände" {...drop("STORED")}><div className={styles.zoneHeader}><div><p className={styles.eyebrow}>03 · DEIN BESITZ</p><h2>Im Lager</h2><p>Nicht mitgeführt. Beansprucht keine aktive Tragekapazität.</p></div><button className="button" disabled={saving || !p.permissions.canCreate} onClick={() => openEditor(undefined, "STORED")}><Plus size={15}/>Im Lager hinzufügen</button></div>{tiles(stored, "Kein passender Gegenstand im Lager.")}<div className={styles.archiveToggle}><label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)}/>Archivierte Gegenstände anzeigen</label><span>Archivieren bewahrt Eigentum und Daten.</span></div>{showArchived && <div className={styles.archiveList}><h3>Archiv</h3>{tiles(archived, "Kein archivierter Gegenstand.")}</div>}</section>
    <footer className={styles.pageFooter}><span>CHRONIPLAY <i>·</i> AUSRÜSTUNG</span><span>Dein Charakter. Dein Inventar. Jede Änderung wird geprüft.</span></footer>
    {draft && <ItemEditor key={draft.id || "new"} draft={draft} projection={p} saving={saving} uploading={uploading} error={error} onDraft={setDraft} onSave={() => void persist(draft)} onUpload={file => void upload(file)} onClose={() => { setDraft(null); setError(""); }}/>}
    <Dialog open={!!slotTarget} onOpenChange={open => { if (!open && !saving) setSlotTarget(null); }}><DialogContent className={styles.slotDialog}><DialogHeader><p className={styles.eyebrow}>AUSRÜSTUNG ANLEGEN</p><DialogTitle>{slotTarget ? bodySlotLabels[slotTarget] : "Körperplatz"}</DialogTitle><DialogDescription>Wähle einen vorhandenen Gegenstand. Seine Trageplätze und die Belegung werden beim Speichern geprüft.</DialogDescription></DialogHeader>{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.slotChoices}>{active.filter(i => i.canEdit && !slotCategoryIssue(i.category, slotTarget || undefined)).map(i => <button type="button" key={i.id} disabled={saving} onClick={() => slotTarget && void move(i.id, "BODY", slotTarget)}><strong>{i.name}</strong><small>{placementText(i)} · {i.slotCost} Plätze</small><ChevronRight size={16}/></button>)}</div><button className="button primary" disabled={saving || !canMutate} onClick={() => { const slot = slotTarget; setSlotTarget(null); if (slot) openEditor(undefined, "BODY", slot); }}><Plus size={16}/>Neuen Gegenstand hier anlegen</button></DialogContent></Dialog>
  </div>;
}

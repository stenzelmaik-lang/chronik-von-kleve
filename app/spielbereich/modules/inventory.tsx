/* eslint-disable @next/next/no-img-element -- authenticated R2 image responses must not enter the public optimizer cache. */
"use client";

import {
  Archive,
  Box,
  BriefcaseMedical,
  FileText,
  KeyRound,
  Laptop,
  Plus,
  Search,
  Shield,
  Shirt,
  Swords,
  ToolCase,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bodySlots,
  carryProfiles,
  inventoryCategories,
  inventoryStatuses,
  type BodySlot,
  type CarryProfile,
  type InventoryCategory,
  type InventoryItem,
  type InventoryProjection,
  type InventoryStatus,
} from "@/domain/inventory";
import { api } from "./api-client";
import styles from "./inventory-v1c.module.css";

type ConcealmentClass = "T" | "J" | "M" | "N";
type Draft = {
  id?: string;
  expectedRevision?: number;
  characterId: string;
  name: string;
  category: InventoryCategory;
  description: string;
  quantity: number;
  status: InventoryStatus;
  visibility: "private" | "sl" | "group";
  imageFileId?: string;
  tags: string[];
  weaponProfile?: {
    damage: string;
    range: string;
    rate: string;
    capacity: string;
    concealability: string;
    currentAmmo?: number;
    note?: string;
    concealmentClass?: ConcealmentClass | null;
    weaponType?: "FIREARM" | "MELEE" | "OTHER";
    rulesTemplateId?: string;
  };
  armorProfile?: { armorClass?: number; armorValue?: number; dexterityPenalty?: number };
  slotCost: number;
  weightKg?: number;
  location: "STORED" | "BACKPACK" | "BODY";
  bodySlot?: BodySlot;
  testData: boolean;
};

const labels: Record<BodySlot, string> = {
  HAND_LEFT: "Linke Hand",
  HAND_RIGHT: "Rechte Hand",
  BELT_HOLSTER: "Gürtel / Holster",
  JACKET_INNER_LEFT: "Jacke innen links",
  JACKET_INNER_RIGHT: "Jacke innen rechts",
  JACKET_OUTER_LEFT: "Jacke außen links",
  JACKET_OUTER_RIGHT: "Jacke außen rechts",
  TROUSER_POCKET_LEFT: "Hosentasche links",
  TROUSER_POCKET_RIGHT: "Hosentasche rechts",
  BACK_EXTERNAL: "Auf dem Rücken / außen",
};

const leftSlots: BodySlot[] = [
  "HAND_LEFT",
  "JACKET_INNER_LEFT",
  "JACKET_OUTER_LEFT",
  "TROUSER_POCKET_LEFT",
  "BACK_EXTERNAL",
];
const rightSlots: BodySlot[] = [
  "HAND_RIGHT",
  "BELT_HOLSTER",
  "JACKET_INNER_RIGHT",
  "JACKET_OUTER_RIGHT",
  "TROUSER_POCKET_RIGHT",
];
const icons: Record<InventoryCategory, typeof Box> = {
  Waffe: Swords,
  "Schutz / Rüstung": Shield,
  Werkzeug: ToolCase,
  Medizin: BriefcaseMedical,
  Elektronik: Laptop,
  Kleidung: Shirt,
  Schlüssel: KeyRound,
  Dokument: FileText,
  Verbrauchsgegenstand: Box,
  Sonstiges: Box,
};
const visibilityLabels = { private: "Privat", sl: "Mit SL geteilt", group: "Gruppe" };
const attentionLabels = {
  UNAUFFAELLIG: "Unauffällig",
  LEICHT_AUFFAELLIG: "Leicht auffällig",
  MITTEL_AUFFAELLIG: "Auffällig",
  SEHR_AUFFAELLIG: "Sehr auffällig",
};
const fresh = (characterId: string): Draft => ({
  characterId,
  name: "",
  category: "Sonstiges",
  description: "",
  quantity: 1,
  status: "Mitgeführt",
  visibility: "private",
  tags: [],
  slotCost: 1,
  location: "BACKPACK",
  testData: false,
});

function NeutralFigure() {
  return (
    <div className={styles.figureWrap} aria-hidden="true">
      <svg className={styles.figure} viewBox="0 0 220 520" fill="none">
        <defs>
          <linearGradient id="figure-fill" x1="110" y1="28" x2="110" y2="500" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e8e0d2" stopOpacity=".15" />
            <stop offset="1" stopColor="#86908d" stopOpacity=".035" />
          </linearGradient>
        </defs>
        <path d="M110 21c-20 0-34 17-34 39 0 20 13 36 34 36s34-16 34-36c0-22-14-39-34-39Z" fill="url(#figure-fill)" />
        <path d="M110 21c-20 0-34 17-34 39 0 20 13 36 34 36s34-16 34-36c0-22-14-39-34-39Z" stroke="currentColor" strokeWidth="2" />
        <path d="M94 98v24m32-24v24" stroke="currentColor" strokeWidth="2" />
        <path d="m92 113-25 9-23 28 10 103 23 9h66l23-9 10-103-23-28-25-9-18 18-18-18Z" fill="url(#figure-fill)" />
        <path d="m92 113-25 9-23 28 10 103 23 9h66l23-9 10-103-23-28-25-9-18 18-18-18Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="m68 129-21 17-20 112 11 67 17 4 10-66-3-58 19-52m91-24 21 17 20 112-11 67-17 4-10-66 3-58-19-52" fill="url(#figure-fill)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="m77 259-7 89 9 57-8 68 22 7 14-79-5-67 8-73m33-2 7 89-9 57 8 68-22 7-14-79 5-67-8-73" fill="url(#figure-fill)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="m71 470-4 24 5 8h39l4-7-6-12-20-18m70 5 4 24-5 8h-39l-4-7 6-12 20-18" fill="url(#figure-fill)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M110 115v234m-43-84h86M78 373h64" stroke="currentColor" strokeOpacity=".38" strokeDasharray="4 7" />
        <circle cx="110" cy="167" r="4" fill="#cda66b" />
        <circle cx="80" cy="275" r="4" fill="#cda66b" />
        <circle cx="140" cy="275" r="4" fill="#cda66b" />
        <circle cx="82" cy="376" r="4" fill="#cda66b" />
        <circle cx="138" cy="376" r="4" fill="#cda66b" />
      </svg>
      <span>Neutrale Ausrüstungsansicht</span>
    </div>
  );
}

function ItemCard({
  item,
  selected,
  warning,
  onClick,
}: {
  item: InventoryItem;
  selected: boolean;
  warning: boolean;
  onClick: () => void;
}) {
  const Icon = icons[item.category];
  return (
    <button
      className={`${styles.itemCard} ${selected ? styles.itemSelected : ""} ${item.lifecycleStatus === "ARCHIVED" ? styles.itemArchived : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className={styles.itemArt}>
        {item.imageFileId ? (
          <img src={`/api/files?id=${encodeURIComponent(item.imageFileId)}`} alt="" />
        ) : (
          <Icon size={27} strokeWidth={1.5} />
        )}
        {warning && <TriangleAlert size={16} className={styles.warningIcon} aria-label="Auffällige Platzierung" />}
      </span>
      <span className={styles.itemInfo}>
        <strong>{item.name}</strong>
        <small>{item.category}{item.quantity > 1 ? ` · ×${item.quantity}` : ""}</small>
        <em>{item.status}{item.lifecycleStatus === "ARCHIVED" ? " · Archiv" : ""}</em>
      </span>
    </button>
  );
}

function EmptyZone({ title, description }: { title: string; description: string }) {
  return (
    <div className={styles.emptyZone}>
      <Box size={22} strokeWidth={1.5} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

export function InventoryPanel() {
  const [p, setP] = useState<InventoryProjection | null>(null);
  const [characterId, setCharacterId] = useState("");
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Alle");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyProfile, setBusyProfile] = useState(false);

  const load = useCallback(async (id = characterId) => {
    setLoading(true);
    try {
      const next = await api<InventoryProjection>(
        `/api/inventory${id ? `?characterId=${encodeURIComponent(id)}&includeArchived=${archived ? 1 : 0}` : `?includeArchived=${archived ? 1 : 0}`}`,
      );
      setP(next);
      if (next.selectedCharacter && !id) setCharacterId(next.selectedCharacter.id);
      setSelected((old) => old ? next.items.find((item) => item.id === old.id) || null : null);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [characterId, archived]);

  // Synchronize the initial projection with the selected character.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => p?.items.filter((item) => {
    const matches = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "Alle"
      || (filter === "Waffen" && item.category === "Waffe")
      || item.status === filter;
    return matches && matchesFilter;
  }) || [], [p, search, filter]);

  const open = (item?: InventoryItem) => {
    if (!p?.selectedCharacter) return;
    if (!item) {
      setDraft(fresh(p.selectedCharacter.id));
      return;
    }
    setDraft({
      id: item.id,
      expectedRevision: item.revision,
      characterId: item.characterId,
      name: item.name,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      status: item.status,
      visibility: item.visibility,
      imageFileId: item.imageFileId,
      tags: item.tags,
      weaponProfile: item.weaponProfile,
      armorProfile: item.armorProfile,
      slotCost: item.slotCost,
      weightKg: item.weightKg,
      location: item.location,
      bodySlot: item.bodySlot,
      testData: item.testData,
    });
  };

  const addToBodySlot = (slot: BodySlot) => {
    if (!p?.selectedCharacter) return;
    setDraft({ ...fresh(p.selectedCharacter.id), location: "BODY", bodySlot: slot });
  };

  const upload = async (file: File) => {
    if (!draft) return;
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("visibility", draft.visibility);
      const result = await api<{ id: string }>("/api/files", "POST", form);
      setDraft({ ...draft, imageFileId: result.id });
      toast.success("Bild sicher gespeichert");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const save = async (action: "update" | "archive" = "update") => {
    if (!draft || !p) return;
    setSaving(true);
    try {
      await api("/api/inventory", draft.id ? "PATCH" : "POST", {
        ...draft,
        action: draft.id ? action : "create",
        expectedCarryRevision: p.carry.revision,
        weaponProfile: draft.category === "Waffe"
          ? draft.weaponProfile || { damage: "", range: "", rate: "", capacity: "", concealability: "" }
          : undefined,
        armorProfile: draft.category === "Schutz / Rüstung" ? draft.armorProfile : undefined,
      });
      setDraft(null);
      setSelected(null);
      await load();
      toast.success(action === "archive" ? "Gegenstand archiviert" : "Gegenstand gespeichert");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const switchProfile = async (profile: CarryProfile) => {
    if (!p?.selectedCharacter) return;
    setBusyProfile(true);
    try {
      await api("/api/inventory/profile", "PATCH", {
        characterId: p.selectedCharacter.id,
        profile,
        expectedRevision: p.carry.revision,
      });
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyProfile(false);
    }
  };

  if (loading && !p) {
    return <section className={styles.emptyPage} aria-live="polite">Inventar wird geöffnet …</section>;
  }

  if (!p?.characters.length) {
    return (
      <section className={styles.emptyPage}>
        <Box size={42} />
        <h2>Noch kein aktiver eigener Charakter</h2>
        <p>Das Inventar wird an einen eigenen Charakter gebunden.</p>
      </section>
    );
  }

  const slotWarning = (item?: InventoryItem) => !!item && p.carry.warningItems.includes(item.id);
  const activeBodyItems = p.items.filter((item) => item.lifecycleStatus === "ACTIVE" && item.location === "BODY");
  const backpackItems = filteredItems.filter((item) => item.location === "BACKPACK");
  const storedItems = filteredItems.filter((item) => item.location === "STORED");
  const attention = p.carry.attention;
  const usedPercent = p.carry.capacity ? Math.min(100, (p.carry.used / p.carry.capacity) * 100) : 0;

  const renderBodySlot = (slot: BodySlot) => {
    const item = activeBodyItems.find((candidate) => candidate.bodySlot === slot);
    const warning = slotWarning(item);
    return (
      <button
        key={slot}
        type="button"
        className={`${styles.bodySlot} ${item ? styles.bodySlotOccupied : styles.bodySlotFree} ${warning ? styles.bodySlotWarning : ""} ${selected?.id === item?.id ? styles.bodySlotSelected : ""}`}
        aria-label={`${labels[slot]}: ${item?.name || "frei"}${item ? `, ${item.status}` : ", Gegenstand hier hinzufügen"}`}
        aria-pressed={!!item && selected?.id === item.id}
        onClick={() => item ? setSelected(item) : addToBodySlot(slot)}
      >
        <span className={styles.slotTopline}>
          <small>{labels[slot]}</small>
          <i className={item ? styles.slotDotOccupied : styles.slotDotFree} aria-hidden="true" />
        </span>
        <strong>{item?.name || "Frei"}</strong>
        <span className={styles.slotStatus}>
          {warning ? <><TriangleAlert size={13} /> Auffällig</> : item ? item.status : "＋ Hier ablegen"}
        </span>
      </button>
    );
  };

  const renderItems = (list: InventoryItem[], emptyTitle: string, emptyDescription: string) => list.length ? (
    <div className={styles.itemGrid}>
      {list.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          selected={selected?.id === item.id}
          warning={slotWarning(item)}
          onClick={() => setSelected(item)}
        />
      ))}
    </div>
  ) : <EmptyZone title={emptyTitle} description={emptyDescription} />;

  return (
    <div className={styles.inventoryPage}>
      <header className={styles.inventoryHero}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">CHARACTER INVENTORY</p>
          <h2>{p.selectedCharacter?.name || "Charakter wählen"}</h2>
          <p>{p.selectedCharacter
            ? `${p.inventorySummary.active} aktive Gegenstände · ${p.inventorySummary.equipped} ausgerüstet`
            : "Jedes Inventar bleibt eindeutig einem Charakter zugeordnet."}</p>
        </div>
        {p.characters.length > 1 && (
          <label className={styles.characterSelect}>
            <span>Charakter</span>
            <select value={characterId} onChange={(event) => { setCharacterId(event.target.value); setSelected(null); }}>
              <option value="">Auswählen …</option>
              {p.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
            </select>
          </label>
        )}
        <button className="button primary" disabled={!p.selectedCharacter} onClick={() => open()}>
          <Plus size={17} /> Gegenstand hinzufügen
        </button>
      </header>

      {p.selectedCharacter && <>
        <section className={styles.carryPanel} aria-label="Trageprofil und Auffälligkeit">
          <label className={styles.profileField}>
            <span className="eyebrow">TRAGEPROFIL</span>
            <select aria-label="Trageprofil" value={p.carry.profile} disabled={busyProfile} onChange={(event) => void switchProfile(event.target.value as CarryProfile)}>
              {Object.entries(carryProfiles).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
          </label>
          <div className={styles.capacityBlock}>
            <div className={styles.capacityLabel}>
              <span className="eyebrow">MITGEFÜHRT</span>
              <strong>{p.carry.used} <span>/ {p.carry.capacity}</span></strong>
              <small>belegte Slots · {carryProfiles[p.carry.profile].label}</small>
            </div>
            <div className={styles.capacityTrack} role="progressbar" aria-label="Belegte Tragekapazität" aria-valuemin={0} aria-valuemax={p.carry.capacity} aria-valuenow={p.carry.used}>
              <span style={{ width: `${usedPercent}%` }} />
            </div>
          </div>
          <div className={`${styles.attentionBlock} ${styles[attention]}`}>
            <span className="eyebrow">AUFFÄLLIGKEIT</span>
            <strong>{attentionLabels[attention]}</strong>
            <small>{p.carry.warningItems.length
              ? `${p.carry.warningItems.length} Gegenstand${p.carry.warningItems.length === 1 ? " ist" : "e sind"} offen oder unpassend platziert.`
              : "Keine offene Warnung. Es wird keine Maskeradefolge berechnet."}</small>
          </div>
        </section>

        <section className={styles.inventoryTools} aria-label="Inventar durchsuchen und filtern">
          <label className={styles.searchField}>
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Gegenstand suchen" aria-label="Gegenstand suchen" />
          </label>
          <div className={styles.filterList} aria-label="Inventarfilter">
            {["Alle", "Waffen", "Ausgerüstet", "Mitgeführt", "Gelagert"].map((value) => (
              <button type="button" className={filter === value ? styles.filterActive : ""} key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>
            ))}
          </div>
          <label className={styles.archiveToggle}>
            <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
            Archivierte anzeigen
          </label>
        </section>

        <div className={styles.inventoryRegions}>
          <section className={styles.zone} aria-labelledby="body-zone-title">
            <header className={styles.zoneHeading}>
              <span className={styles.zoneNumber}>01</span>
              <div>
                <p className="eyebrow">AUSRÜSTUNG</p>
                <h3 id="body-zone-title">Am Körper</h3>
                <p>Freie Plätze anklicken, um dort einen Gegenstand anzulegen.</p>
              </div>
              <span className={styles.zoneCount}>{activeBodyItems.length} belegt</span>
            </header>
            <div className={styles.bodyDossier}>
              <div className={styles.bodySlotStack}>{leftSlots.map(renderBodySlot)}</div>
              <NeutralFigure />
              <div className={styles.bodySlotStack}>{rightSlots.map(renderBodySlot)}</div>
            </div>
          </section>

          <section className={styles.zone} aria-labelledby="backpack-zone-title">
            <header className={styles.zoneHeading}>
              <span className={styles.zoneNumber}>02</span>
              <div>
                <p className="eyebrow">AKTIV MITGEFÜHRT</p>
                <h3 id="backpack-zone-title">Rucksack</h3>
                <p>Gegenstände, die gerade im Rucksack liegen.</p>
              </div>
              <span className={styles.zoneCount}>{p.items.filter((item) => item.lifecycleStatus === "ACTIVE" && item.location === "BACKPACK").length} Items</span>
            </header>

            <div className={styles.equippedSummary}>
              <div className={styles.subsectionHeading}>
                <span>AM KÖRPER AUSGERÜSTET</span>
                <small>{activeBodyItems.length} Items</small>
              </div>
              {activeBodyItems.length ? (
                <div className={styles.equippedList}>
                  {activeBodyItems.map((item) => (
                    <button type="button" key={item.id} onClick={() => setSelected(item)} className={selected?.id === item.id ? styles.equippedSelected : ""}>
                      <span className={styles.equippedDot} />
                      <span><strong>{item.name}</strong><small>{item.bodySlot ? labels[item.bodySlot] : "Am Körper"}</small></span>
                      <span className={styles.equippedStatus}>{item.status}</span>
                    </button>
                  ))}
                </div>
              ) : <p className={styles.inlineEmpty}>Noch keine Gegenstände am Körper.</p>}
            </div>

            <div className={styles.subsectionHeading}>
              <span>IM RUCKSACK</span>
              <small>{backpackItems.length} angezeigt</small>
            </div>
            {renderItems(backpackItems, "Der Rucksack ist leer.", "Lege Gegenstände aus der Detailansicht hier ab.")}
          </section>
        </div>

        <section className={`${styles.zone} ${styles.storedZone}`} aria-labelledby="stored-zone-title">
          <header className={styles.zoneHeading}>
            <span className={styles.zoneNumber}>03</span>
            <div>
              <p className="eyebrow">NICHT MITGEFÜHRT</p>
              <h3 id="stored-zone-title">Gelagert</h3>
              <p>Gegenstände im Unterschlupf oder an einem anderen sicheren Ort.</p>
            </div>
            <span className={styles.zoneCount}>{storedItems.length} angezeigt</span>
          </header>
          {renderItems(storedItems, "Nichts gelagert.", "Gelagerte Gegenstände erscheinen getrennt vom aktiven Gepäck.")}
        </section>

        {selected && (
          <section className={styles.detailPanel} aria-labelledby="selected-item-title">
            <button type="button" className={styles.detailClose} onClick={() => setSelected(null)} aria-label="Detail schließen">×</button>
            <div className={styles.detailArt}>
              {selected.imageFileId
                ? <img src={`/api/files?id=${encodeURIComponent(selected.imageFileId)}`} alt="" />
                : (() => { const Icon = icons[selected.category]; return <Icon size={38} strokeWidth={1.5} />; })()}
            </div>
            <div className={styles.detailMain}>
              <p className="eyebrow">GEGENSTAND · {selected.category}</p>
              <h3 id="selected-item-title">{selected.name}</h3>
              <div className={styles.detailMeta}>
                <span>Menge <b>{selected.quantity}</b></span>
                <span>Status <b>{selected.status}</b></span>
                <span>Sichtbarkeit <b>{visibilityLabels[selected.visibility]}</b></span>
                <span>Trageort <b>{selected.location === "BODY" ? labels[selected.bodySlot!] : selected.location === "BACKPACK" ? "Rucksack" : "Gelagert"}</b></span>
                <span>Slots <b>{selected.slotCost}</b></span>
                {selected.weightKg !== undefined && <span>Gewicht <b>{selected.weightKg} kg</b></span>}
              </div>
              {selected.description && <p className={styles.detailDescription}>{selected.description}</p>}
              {selected.tags.length > 0 && <div className={styles.tags}>{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
              {selected.weaponProfile && (
                <section className={styles.profileDetail}>
                  <h4>Waffenprofil · V20</h4>
                  <dl>
                    <dt>Schaden</dt><dd>{selected.weaponProfile.damage || "—"}</dd>
                    <dt>Reichweite</dt><dd>{selected.weaponProfile.range || "—"}</dd>
                    <dt>Schussfolge</dt><dd>{selected.weaponProfile.rate || "—"}</dd>
                    <dt>Magazin</dt><dd>{selected.weaponProfile.capacity || "—"}</dd>
                    <dt>Versteck</dt><dd>{selected.weaponProfile.concealmentClass || "Nicht festgelegt"}</dd>
                  </dl>
                  {selected.weaponProfile.concealmentClass && <p>{selected.weaponProfile.concealmentClass === "N" ? "Kann nach V20 nicht am Körper verborgen werden." : `V20-Versteckklasse ${selected.weaponProfile.concealmentClass}.`}</p>}
                  {slotWarning(selected) && <p className={styles.warningText}>Sehr auffällig · offene oder unpassende Körperplatzierung.</p>}
                </section>
              )}
              {selected.armorProfile && (
                <section className={styles.profileDetail}>
                  <h4>Rüstung</h4>
                  <dl>
                    <dt>Rüstungsklasse</dt><dd>{selected.armorProfile.armorClass ?? "—"}</dd>
                    <dt>Rüstungswert</dt><dd>{selected.armorProfile.armorValue ?? "—"}</dd>
                    <dt>Abzug</dt><dd>{selected.armorProfile.dexterityPenalty ?? "—"}</dd>
                  </dl>
                </section>
              )}
              <div className={styles.detailActions}>
                <button className="button primary" onClick={() => open(selected)}>Bearbeiten</button>
                {selected.lifecycleStatus === "ACTIVE" && <button className="button" onClick={() => open(selected)}><Archive size={16} /> Archivieren</button>}
              </div>
            </div>
          </section>
        )}
      </>}

      <Dialog open={!!draft} onOpenChange={(isOpen) => !isOpen && setDraft(null)}>
        <DialogContent className="inventory-dialog">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Gegenstand bearbeiten" : "Gegenstand hinzufügen"}</DialogTitle>
            <DialogDescription>Werte und Tragekapazität werden beim Speichern geprüft.</DialogDescription>
          </DialogHeader>
          {draft && <div className="inventory-form">
            <label><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <div className="inventory-form-row">
              <label><span>Kategorie</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as InventoryCategory })}>{inventoryCategories.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Menge</span><input type="number" min="1" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} /></label>
            </div>
            <label><span>Beschreibung</span><textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <div className="inventory-form-row">
              <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as InventoryStatus })}>{inventoryStatuses.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Sichtbarkeit</span><select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as Draft["visibility"], imageFileId: undefined })}><option value="private">Privat</option><option value="sl">Mit SL geteilt</option><option value="group">Gruppe</option></select></label>
            </div>
            <div className="inventory-form-row">
              <label><span>Trageort</span><select value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value as Draft["location"], bodySlot: undefined })}><option value="STORED">Gelagert</option><option value="BACKPACK">Im Rucksack</option><option value="BODY">Am Körper</option></select></label>
              {draft.location === "BODY" && <label><span>Körperposition</span><select value={draft.bodySlot || ""} onChange={(event) => setDraft({ ...draft, bodySlot: event.target.value as BodySlot })}><option value="">Auswählen …</option>{bodySlots.map((slot) => <option key={slot} value={slot}>{labels[slot]}</option>)}</select></label>}
            </div>
            <label><span>Tags, durch Komma getrennt</span><input value={draft.tags.join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></label>
            <label className="inventory-upload"><Upload size={16} /><span>{draft.imageFileId ? "Bild ersetzen" : "Bild hochladen"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0])} /></label>
            {draft.category === "Waffe" && <fieldset className="weapon-fields">
              <legend>Waffenprofil · V20</legend>
              {([ ["damage", "Schaden"], ["range", "Reichweite"], ["rate", "Schussfolge"], ["capacity", "Magazin"] ] as const).map(([key, label]) => <label key={key}><span>{label}</span><input value={draft.weaponProfile?.[key] || ""} onChange={(event) => setDraft({ ...draft, weaponProfile: { damage: "", range: "", rate: "", capacity: "", concealability: "", ...draft.weaponProfile, [key]: event.target.value } })} /></label>)}
              <label><span>Versteckklasse</span><select value={draft.weaponProfile?.concealmentClass || ""} onChange={(event) => setDraft({ ...draft, weaponProfile: { damage: "", range: "", rate: "", capacity: "", concealability: "", ...draft.weaponProfile, concealmentClass: (event.target.value || undefined) as ConcealmentClass | undefined } })}><option value="">Nicht festgelegt</option><option value="T">T – Tasche</option><option value="J">J – Jacke</option><option value="M">M – Mantel</option><option value="N">N – nicht am Körper versteckbar</option></select></label>
              <label><span>Aktuelle Munition (optional)</span><input type="number" min="0" value={draft.weaponProfile?.currentAmmo ?? ""} onChange={(event) => setDraft({ ...draft, weaponProfile: { damage: "", range: "", rate: "", capacity: "", concealability: "", ...draft.weaponProfile, currentAmmo: event.target.value ? Number(event.target.value) : undefined } })} /></label>
              <label className="wide"><span>Notiz</span><textarea value={draft.weaponProfile?.note || ""} onChange={(event) => setDraft({ ...draft, weaponProfile: { damage: "", range: "", rate: "", capacity: "", concealability: "", ...draft.weaponProfile, note: event.target.value } })} /></label>
            </fieldset>}
            {draft.category === "Schutz / Rüstung" && <fieldset className="weapon-fields">
              <legend>Rüstung</legend>
              <div className="inventory-form-row">
                <label><span>Rüstungsklasse (1–5)</span><input type="number" min="1" max="5" value={draft.armorProfile?.armorClass ?? ""} onChange={(event) => setDraft({ ...draft, armorProfile: { ...draft.armorProfile, armorClass: event.target.value ? Number(event.target.value) : undefined } })} /></label>
                <label><span>Rüstungswert</span><input type="number" min="0" max="100" value={draft.armorProfile?.armorValue ?? ""} onChange={(event) => setDraft({ ...draft, armorProfile: { ...draft.armorProfile, armorValue: event.target.value ? Number(event.target.value) : undefined } })} /></label>
              </div>
              <label><span>Geschick-Abzug</span><input type="number" min="-20" max="0" value={draft.armorProfile?.dexterityPenalty ?? ""} onChange={(event) => setDraft({ ...draft, armorProfile: { ...draft.armorProfile, dexterityPenalty: event.target.value ? Number(event.target.value) : undefined } })} /></label>
            </fieldset>}
          </div>}
          <DialogFooter>
            {draft?.id && <button className="button" disabled={saving} onClick={() => void save("archive")}><Archive size={16} /> Archivieren</button>}
            <button className="button primary" disabled={saving || !draft?.name.trim() || (draft?.location === "BODY" && !draft.bodySlot)} onClick={() => void save()}>{saving ? "Speichert …" : "Speichern"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

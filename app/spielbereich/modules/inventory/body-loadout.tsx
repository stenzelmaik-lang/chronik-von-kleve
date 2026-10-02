"use client";
import { ChevronDown, Plus } from "lucide-react";
import type { BodySlot, InventoryItem } from "@/domain/inventory";
import { bodySlotLabels } from "./shared";
import { ItemImage } from "./item-tile";
import styles from "./inventory.module.css";
const left: BodySlot[] = ["HEAD", "TORSO", "GLOVES", "LEGS"];
const right: BodySlot[] = ["EYES", "OUTERWEAR", "ACCESSORY", "FEET"];
const ready: BodySlot[] = ["HAND_LEFT", "HAND_RIGHT", "BELT_HOLSTER", "BACK_EXTERNAL"];
const pockets: BodySlot[] = ["JACKET_INNER_LEFT", "JACKET_INNER_RIGHT", "JACKET_OUTER_LEFT", "JACKET_OUTER_RIGHT", "TROUSER_POCKET_LEFT", "TROUSER_POCKET_RIGHT", "COAT_INNER"];
export function BodyLoadout({ items, selectedId, busy, onSlot, onMove }: { items: InventoryItem[]; selectedId?: string; busy: boolean; onSlot: (slot: BodySlot, item?: InventoryItem) => void; onMove: (id: string, slot: BodySlot) => void }) {
  const worn = items.filter(i => i.lifecycleStatus === "ACTIVE" && i.location === "BODY");
  const occupied = (slot: BodySlot) => worn.some(i => i.bodySlot === slot);
  const tone = (slot: BodySlot) => occupied(slot) ? "url(#inventory-cloth)" : "url(#inventory-body)";
  const slotButton = (slot: BodySlot, compact = false) => {
    const item = worn.find(i => i.bodySlot === slot);
    return <button type="button" key={slot} className={`${styles.bodySlot} ${item ? styles.occupiedSlot : ""} ${item && item.id === selectedId ? styles.selectedSlot : ""} ${compact ? styles.compactSlot : ""}`} aria-label={`${bodySlotLabels[slot]}: ${item?.name || "frei"}`} aria-pressed={!!item && item.id === selectedId} disabled={busy} onClick={() => onSlot(slot, item)} onDragOver={e => { if (e.dataTransfer.types.includes("application/x-chroniplay-item")) e.preventDefault(); }} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("application/x-chroniplay-item"); if (id) onMove(id, slot); }}>
      <span className={styles.slotLabel}>{bodySlotLabels[slot]}<i aria-hidden="true"/></span>
      {item ? <><ItemImage key={`${item.id}:${item.revision}`} item={item}/><strong>{item.name}</strong></> : <><span className={styles.emptySlotIcon}><Plus size={16}/></span><small>Frei</small></>}
    </button>;
  };
  return <div className={styles.loadout}>
    <div className={styles.bodyComposition}>
      <div className={styles.slotColumn}>{left.map(slot => slotButton(slot))}</div>
      <div className={styles.figure}>
        <svg viewBox="0 0 220 480" role="img" aria-label={`Neutrale Ausrüstungssilhouette. ${worn.length} Gegenstände am Körper. Kleidung wird schematisch an den belegten Positionen dargestellt.`}>
          <defs><linearGradient id="inventory-body" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#243344"/><stop offset="1" stopColor="#101c2a"/></linearGradient><linearGradient id="inventory-cloth" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c7a365" stopOpacity=".8"/><stop offset="1" stopColor="#554831" stopOpacity=".85"/></linearGradient></defs>
          <g fill="none" stroke="#b69358" opacity=".13"><ellipse cx="110" cy="240" rx="100" ry="219"/><ellipse cx="110" cy="240" rx="76" ry="193"/><path d="M110 9V469 M8 240H212" strokeDasharray="3 8"/><path d="M39 82H181 M28 152H192 M14 267H206 M32 359H188"/></g>
          <g stroke="#81929d" strokeWidth="1.15" strokeLinejoin="round">
            <path d="M95 80L96 98 76 107 65 121 56 175 43 231 40 269 50 275 61 251 68 211 78 165 80 231 76 257 80 282 91 345 83 422 84 441 65 451 66 458 96 458 103 441 108 360 110 296 112 360 117 441 124 458 154 458 155 451 136 441 137 422 129 345 140 282 144 257 140 231 142 165 152 211 159 251 170 275 180 269 177 231 164 175 155 121 144 107 124 98 125 80Z" fill="url(#inventory-body)"/>
            <ellipse cx="110" cy="54" rx="26" ry="32" fill={tone("HEAD")}/>
            <path d="M81 128Q110 143 139 128 M81 211Q110 223 139 211 M80 259Q110 271 140 259 M110 268V291" fill="none" opacity=".38"/>
            {occupied("TORSO") && <path d="M94 98Q110 112 126 98L145 112 136 158 140 232Q110 246 80 232L84 158 75 112Z" fill={tone("TORSO")} stroke="#d3b47c"/>}
            {occupied("OUTERWEAR") && <g fill={tone("OUTERWEAR")} stroke="#d3b47c"><path d="M91 98L108 119 102 289 74 283 81 204 76 155 61 231 47 228 65 120Z"/><path d="M129 98L112 119 118 289 146 283 139 204 144 155 159 231 173 228 155 120Z"/><path d="M91 98L95 134 108 119 M129 98L125 134 112 119" fill="none"/></g>}
            {occupied("LEGS") && <path d="M79 267Q110 280 141 267L137 305 128 348 137 424 117 426 110 329 103 426 83 424 92 348 83 305Z" fill={tone("LEGS")} stroke="#d3b47c"/>}
            {occupied("FEET") && <g fill={tone("FEET")} stroke="#d3b47c"><path d="M82 425H103L100 441 95 459H63L62 450 82 439Z"/><path d="M117 425H138L138 439 158 450 157 459H125L120 441Z"/></g>}
            {occupied("GLOVES") && <g fill={tone("GLOVES")} stroke="#d3b47c"><path d="M40 245L57 249 51 276 39 273Z"/><path d="M163 249L180 245 181 273 169 276Z"/></g>}
            {occupied("EYES") && <path d="M85 48Q110 43 135 48L130 60H115L110 54 105 60H90Z" fill="#b8a178" stroke="#e3c88f"/>}
            {occupied("ACCESSORY") && <path d="M100 92Q110 115 120 92 M107 110L110 119 113 110Z" fill="#dcc086" stroke="#dcc086"/>}
            {occupied("BELT_HOLSTER") && <path d="M78 251H142V262H78Z M131 263H147L143 289H130Z" fill="#8b795b" stroke="#d3b47c"/>}
          </g>
          <g fill="#d5b979">{occupied("HAND_LEFT") && <circle cx="46" cy="261" r="5"/>}{occupied("HAND_RIGHT") && <circle cx="174" cy="261" r="5"/>}</g>
        </svg>
        <span className={styles.figureCaption}>DEIN LOADOUT<small>{worn.length} belegte Plätze</small></span>
      </div>
      <div className={styles.slotColumn}>{right.map(slot => slotButton(slot))}</div>
    </div>
    <div className={styles.readySlots}>{ready.map(slot => slotButton(slot, true))}</div>
    <details className={styles.pocketFold}><summary>Taschen & verdeckte Plätze <span>{worn.filter(i => i.bodySlot && pockets.includes(i.bodySlot)).length} belegt <ChevronDown size={14}/></span></summary><div className={styles.pocketGrid}>{pockets.map(slot => slotButton(slot, true))}</div><p>Verbergung nutzt die bestehende V20-Klasse. Mantel innen ist ein eigener Platz; daraus folgen keine automatischen Spielkonsequenzen.</p></details>
  </div>;
}

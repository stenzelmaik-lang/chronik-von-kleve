"use client";
/* eslint-disable @next/next/no-img-element -- Item images use an authenticated R2 endpoint, never a public optimizer. */
import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { InventoryItem } from "@/domain/inventory";
import { categoryIcons, itemImage } from "./shared";
import styles from "./inventory.module.css";
export function ItemImage({ item, src }: { item: Pick<InventoryItem, "id" | "revision" | "imageFileId" | "category" | "name">; src?: string }) {
  const [failed, setFailed] = useState(false), Icon = categoryIcons[item.category];
  const url = src || (item.imageFileId ? itemImage(item) : undefined);
  return <span className={styles.itemImage}>{url && !failed ? <img key={url} src={url} alt={item.name} onError={() => setFailed(true)} /> : failed ? <span title="Bild nicht erreichbar. Berechtigung oder Datei prüfen."><ImageOff size={24}/><small>Bild fehlt</small></span> : <Icon size={28} strokeWidth={1.25}/>}</span>;
}
export function ItemTile({ item, selected, warning, onSelect }: { item: InventoryItem; selected: boolean; warning: boolean; onSelect: () => void }) {
  return <button type="button" className={`${styles.itemTile} ${selected ? styles.selectedTile : ""}`} aria-label={`${item.name}, ${item.quantity} Stück, ${item.slotCost} Trageplätze`} aria-pressed={selected} onClick={onSelect} draggable={item.canEdit && item.lifecycleStatus === "ACTIVE"} onDragStart={event => { event.dataTransfer.setData("application/x-chroniplay-item", item.id); event.dataTransfer.effectAllowed = "move"; }}>
    <ItemImage key={`${item.id}:${item.revision}`} item={item}/>
    <span className={styles.itemQuantity}>×{item.quantity}</span>
    {warning && <span className={styles.itemWarning} title="Auffällige Platzierung">!</span>}
    <span className={styles.tileCopy}><strong>{item.name}</strong><small>{item.category} · {item.slotCost} {item.slotCost === 1 ? "Platz" : "Plätze"}</small></span>
  </button>;
}

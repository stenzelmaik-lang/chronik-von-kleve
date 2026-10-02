import type { BodySlot, InventoryCategory, InventoryItem, ItemLocation } from "@/domain/inventory";
import type { Visibility } from "@/domain/types";
import { bodySlotLabels, statusForLocation } from "@/domain/inventory-rules";
import { Archive, FileText, KeyRound, Laptop, Package, Pill, Shield, Shirt, Sword, Wrench } from "lucide-react";
export { bodySlotLabels, visibilityLabels, locationLabels, attentionLabels, concealmentLabels } from "@/domain/inventory-rules";
export const categoryIcons = { Waffe: Sword, "Schutz / Rüstung": Shield, Werkzeug: Wrench, Medizin: Pill, Elektronik: Laptop, Kleidung: Shirt, Schlüssel: KeyRound, Dokument: FileText, Verbrauchsgegenstand: Package, Sonstiges: Archive };
export type ItemDraft = Pick<InventoryItem, "characterId" | "name" | "category" | "description" | "quantity" | "status" | "visibility" | "imageFileId" | "tags" | "weaponProfile" | "armorProfile" | "slotCost" | "weightKg" | "location" | "bodySlot" | "testData"> & { id?: string; expectedRevision?: number };
export function freshItem(characterId: string, visibility: Visibility = "private", location: ItemLocation = "BACKPACK", bodySlot?: BodySlot): ItemDraft {
  return { characterId, name: "", category: bodySlot && ["HEAD", "TORSO", "OUTERWEAR", "GLOVES", "LEGS", "FEET"].includes(bodySlot) ? "Kleidung" : "Sonstiges", description: "", quantity: 1, status: statusForLocation(location), visibility, tags: [], slotCost: 1, location, bodySlot, testData: false };
}
export function itemDraft(item: InventoryItem): ItemDraft {
  return { id: item.id, expectedRevision: item.revision, characterId: item.characterId, name: item.name, category: item.category, description: item.description, quantity: item.quantity, status: item.status, visibility: item.visibility, imageFileId: item.imageFileId, tags: item.tags, weaponProfile: item.weaponProfile, armorProfile: item.armorProfile, slotCost: item.slotCost, weightKg: item.weightKg, location: item.location, bodySlot: item.bodySlot, testData: item.testData };
}
export function itemImage(item: Pick<InventoryItem, "id" | "revision">) { return `/api/inventory/media?itemId=${encodeURIComponent(item.id)}&revision=${item.revision}`; }
export function placementText(item: Pick<InventoryItem, "location" | "bodySlot">) { return item.location === "BODY" ? item.bodySlot ? bodySlotLabels[item.bodySlot] : "Am Körper" : item.location === "STORED" ? "Im Lager" : "Im Rucksack"; }
export function categoryText(category: InventoryCategory) { return category === "Schutz / Rüstung" ? "Schutz" : category; }

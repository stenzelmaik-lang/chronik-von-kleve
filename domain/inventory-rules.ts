import { carryProfiles, type BodySlot, type CarryProfile, type CarryState, type InventoryCategory, type InventoryItem, type ItemLocation } from "./inventory.ts";

export const bodySlotLabels: Record<BodySlot, string> = {
  HAND_LEFT: "Linke Hand", HAND_RIGHT: "Rechte Hand", BELT_HOLSTER: "Gürtel / Holster",
  JACKET_INNER_LEFT: "Jacke innen links", JACKET_INNER_RIGHT: "Jacke innen rechts",
  JACKET_OUTER_LEFT: "Jacke außen links", JACKET_OUTER_RIGHT: "Jacke außen rechts",
  TROUSER_POCKET_LEFT: "Hosentasche links", TROUSER_POCKET_RIGHT: "Hosentasche rechts",
  BACK_EXTERNAL: "Rücken außen", HEAD: "Kopf", EYES: "Augen", TORSO: "Oberkörper",
  OUTERWEAR: "Jacke / Mantel", GLOVES: "Handschuhe", LEGS: "Beine", FEET: "Füße",
  ACCESSORY: "Accessoire", COAT_INNER: "Mantel innen",
};
export const wearableSlots: BodySlot[] = ["HEAD", "EYES", "TORSO", "OUTERWEAR", "GLOVES", "LEGS", "FEET", "ACCESSORY"];
export const locationLabels: Record<ItemLocation, string> = { BODY: "Am Körper", BACKPACK: "Im Rucksack", STORED: "Im Lager" };
export const attentionLabels = { UNAUFFAELLIG: "Unauffällig", LEICHT_AUFFAELLIG: "Leicht auffällig", MITTEL_AUFFAELLIG: "Merklich auffällig", SEHR_AUFFAELLIG: "Sehr auffällig" };
export const visibilityLabels = { private: "Nur ich", sl: "Ich & Spielleitung", group: "Spielgruppe" };
export const concealmentLabels = { T: "T · Tasche", J: "J · Jacke", M: "M · Mantel", N: "N · Nicht am Körper verbergbar" };

export function slotCategoryIssue(category: InventoryCategory, slot?: BodySlot): string | null {
  if (!slot || !wearableSlots.includes(slot) || slot === "ACCESSORY") return null;
  if (["Kleidung", "Schutz / Rüstung"].includes(category)) return null;
  if (slot === "EYES" && ["Werkzeug", "Elektronik", "Sonstiges"].includes(category)) return null;
  return `${bodySlotLabels[slot]} ist ein Kleidungs- oder Schutzplatz. Benutze für diesen Gegenstand eine Hand, Tasche oder Halterung.`;
}
export function statusForLocation(location: ItemLocation) {
  return location === "BODY" ? "Ausgerüstet" as const : location === "STORED" ? "Gelagert" as const : "Mitgeführt" as const;
}
export function concealmentWarning(item: InventoryItem): boolean {
  if (item.lifecycleStatus !== "ACTIVE" || item.location !== "BODY" || !item.weaponProfile?.concealmentClass) return false;
  const slot = item.bodySlot || "", cls = item.weaponProfile.concealmentClass;
  if (cls === "N" || slot === "BACK_EXTERNAL") return true;
  if (cls === "T") return !slot.startsWith("TROUSER_POCKET_") && !slot.startsWith("JACKET_") && slot !== "COAT_INNER";
  if (cls === "J") return !slot.startsWith("JACKET_") && slot !== "COAT_INNER";
  return slot !== "COAT_INNER";
}
export function openlyCarried(item: InventoryItem): boolean {
  return item.lifecycleStatus === "ACTIVE" && item.location === "BODY" &&
    (item.bodySlot === "BACK_EXTERNAL" || item.bodySlot === "HAND_LEFT" || item.bodySlot === "HAND_RIGHT" || item.weaponProfile?.concealmentClass === "N" || concealmentWarning(item));
}
export function deriveCarry(profile: CarryProfile, revision: number, items: InventoryItem[], complete = true): CarryState {
  const active = items.filter(i => i.lifecycleStatus === "ACTIVE" && i.location !== "STORED");
  const warningItems = active.filter(concealmentWarning).map(i => i.id);
  const openVisibleItems = active.filter(openlyCarried).map(i => i.id);
  return { profile, revision, capacity: carryProfiles[profile].capacity, used: active.reduce((sum, i) => sum + i.slotCost, 0),
    attention: warningItems.length ? "SEHR_AUFFAELLIG" : carryProfiles[profile].attention, openVisibleItems, warningItems, complete };
}
export function placementIssue(carry: Pick<CarryState, "capacity" | "used">, items: InventoryItem[], candidate: InventoryItem): string | null {
  const isCarried = (i: InventoryItem) => i.lifecycleStatus === "ACTIVE" && i.location !== "STORED";
  const old = items.find(i => i.id === candidate.id);
  const used = carry.used - (old && isCarried(old) ? old.slotCost : 0) + (isCarried(candidate) ? candidate.slotCost : 0);
  if (candidate.lifecycleStatus === "ACTIVE" && candidate.location === "BODY") {
    const categoryError = slotCategoryIssue(candidate.category, candidate.bodySlot);
    if (categoryError) return categoryError;
    const occupied = items.find(i => i.id !== candidate.id && i.lifecycleStatus === "ACTIVE" && i.location === "BODY" && i.bodySlot === candidate.bodySlot);
    if (occupied) return `${bodySlotLabels[candidate.bodySlot!]} ist bereits durch ${occupied.name} belegt.`;
  }
  if (used > carry.capacity) return `Trageprofil überschritten: ${used - carry.capacity} Slots müssen zuerst gelagert werden.`;
  return null;
}

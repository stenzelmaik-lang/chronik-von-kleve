import type { Visibility } from "./types";

export const inventoryCategories = ["Waffe", "Schutz / Rüstung", "Werkzeug", "Medizin", "Elektronik", "Kleidung", "Schlüssel", "Dokument", "Verbrauchsgegenstand", "Sonstiges"] as const;
export const inventoryStatuses = ["Mitgeführt", "Ausgerüstet", "Gelagert"] as const;
export type InventoryCategory = typeof inventoryCategories[number];
export type InventoryStatus = typeof inventoryStatuses[number];
export const carryProfiles = {
  BODY_ONLY: { label: "Körpernah", capacity: 4, attention: "UNAUFFAELLIG" },
  BACKPACK_SMALL: { label: "Kleiner Rucksack", capacity: 8, attention: "LEICHT_AUFFAELLIG" },
  BACKPACK_MEDIUM: { label: "Mittlerer Rucksack", capacity: 12, attention: "MITTEL_AUFFAELLIG" },
  BACKPACK_LARGE: { label: "Großer Rucksack", capacity: 20, attention: "SEHR_AUFFAELLIG" },
} as const;
// Existing values remain stable. Wearable positions extend the same JSON model.
export const bodySlots = ["HAND_LEFT", "HAND_RIGHT", "BELT_HOLSTER", "JACKET_INNER_LEFT", "JACKET_INNER_RIGHT", "JACKET_OUTER_LEFT", "JACKET_OUTER_RIGHT", "TROUSER_POCKET_LEFT", "TROUSER_POCKET_RIGHT", "BACK_EXTERNAL", "HEAD", "EYES", "TORSO", "OUTERWEAR", "GLOVES", "LEGS", "FEET", "ACCESSORY", "COAT_INNER"] as const;
export type CarryProfile = keyof typeof carryProfiles;
export type AttentionLevel = "UNAUFFAELLIG" | "LEICHT_AUFFAELLIG" | "MITTEL_AUFFAELLIG" | "SEHR_AUFFAELLIG";
export type ItemLocation = "STORED" | "BACKPACK" | "BODY";
export type BodySlot = typeof bodySlots[number];
export type WeaponProfile = { damage: string; range: string; rate: string; capacity: string; concealability: string; currentAmmo?: number; note?: string; concealmentClass?: "T" | "J" | "M" | "N" | null; weaponType?: "FIREARM" | "MELEE" | "OTHER"; rulesTemplateId?: string };
export type ArmorProfile = { armorClass?: number; armorValue?: number; dexterityPenalty?: number };
export type InventoryItem = { id: string; characterId: string; name: string; category: InventoryCategory; description: string; quantity: number; status: InventoryStatus; visibility: Visibility; imageFileId?: string; tags: string[]; weaponProfile?: WeaponProfile; armorProfile?: ArmorProfile; slotCost: number; weightKg?: number; location: ItemLocation; bodySlot?: BodySlot; lifecycleStatus: "ACTIVE" | "ARCHIVED"; testData: boolean; revision: number; createdAt: string; updatedAt: string; canEdit: boolean };
export type InventoryCharacter = { id: string; name: string; portraitRef?: string; own: boolean };
export type CarryState = { profile: CarryProfile; revision: number; capacity: number; used: number; attention: AttentionLevel; openVisibleItems: string[]; warningItems: string[]; complete: boolean };
export type InventoryProjection = { characters: InventoryCharacter[]; selectedCharacter: InventoryCharacter | null; requiresCharacterSelection: boolean; inventorySummary: { active: number; archived: number; equipped: number; carried: number; stored: number }; items: InventoryItem[]; carry: CarryState; permissions: { canCreate: boolean; canEdit: boolean; canChangeProfile: boolean; allowedVisibilities: Visibility[] } };

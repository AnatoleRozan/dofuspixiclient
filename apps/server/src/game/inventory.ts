/* ------------------------------------------------------------------ */
/*  Character Inventory — bag + equipment management                  */
/* ------------------------------------------------------------------ */

import { db } from "../db/database.ts";
import { getItem, type ItemDefinition, type ItemEffect } from "./items.ts";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface InventoryEntry {
  itemId: number;
  quantity: number;
  /** -1 = in bag, 0-6 = equipped slot (matches ItemDefinition.slot) */
  slot: number;
}

export interface SerializedInventory {
  items: InventoryEntry[];
}

/* ------------------------------------------------------------------ */
/*  Load / Save                                                       */
/* ------------------------------------------------------------------ */

/**
 * Load inventory from the DB JSON column.
 * Returns an empty array if column is null or malformed.
 */
export async function loadInventory(characterId: number): Promise<InventoryEntry[]> {
  const row = await db
    .selectFrom("characters")
    .select(["inventory"])
    .where("id", "=", characterId)
    .executeTakeFirst();

  if (!row || !row.inventory) return [];

  try {
    const parsed =
      typeof row.inventory === "string"
        ? JSON.parse(row.inventory)
        : row.inventory;
    if (Array.isArray(parsed)) return parsed as InventoryEntry[];
    if (parsed && Array.isArray(parsed.items)) return parsed.items as InventoryEntry[];
    return [];
  } catch {
    return [];
  }
}

/**
 * Save inventory to DB.
 */
export async function saveInventory(
  characterId: number,
  items: InventoryEntry[]
): Promise<void> {
  await db
    .updateTable("characters")
    .set({ inventory: JSON.stringify(items) })
    .where("id", "=", characterId)
    .execute();
}

/* ------------------------------------------------------------------ */
/*  Buy                                                               */
/* ------------------------------------------------------------------ */

export interface BuyResult {
  ok: boolean;
  error?: string;
  newKama?: number;
  inventory?: InventoryEntry[];
}

export async function buyItem(
  characterId: number,
  itemId: number
): Promise<BuyResult> {
  const item = getItem(itemId);
  if (!item) return { ok: false, error: "Item inconnu." };

  const character = await db
    .selectFrom("characters")
    .select(["kama", "inventory"])
    .where("id", "=", characterId)
    .executeTakeFirst();

  if (!character) return { ok: false, error: "Personnage introuvable." };

  if (character.kama < item.price) {
    return { ok: false, error: "Pas assez de kamas !" };
  }

  // Parse current inventory
  let items: InventoryEntry[];
  try {
    const raw = character.inventory;
    const parsed = typeof raw === "string" ? JSON.parse(raw || "[]") : raw ?? [];
    items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
  } catch {
    items = [];
  }

  // Check if item already in bag (non-equipped) → increase quantity
  const existing = items.find((e) => e.itemId === itemId && e.slot === -1);
  if (existing) {
    existing.quantity++;
  } else {
    items.push({ itemId, quantity: 1, slot: -1 });
  }

  const newKama = character.kama - item.price;

  await db
    .updateTable("characters")
    .set({
      kama: newKama,
      inventory: JSON.stringify(items),
    })
    .where("id", "=", characterId)
    .execute();

  return { ok: true, newKama, inventory: items };
}

/* ------------------------------------------------------------------ */
/*  Equip / Unequip                                                   */
/* ------------------------------------------------------------------ */

export interface EquipResult {
  ok: boolean;
  error?: string;
  inventory?: InventoryEntry[];
}

export async function equipItem(
  characterId: number,
  itemId: number
): Promise<EquipResult> {
  const itemDef = getItem(itemId);
  if (!itemDef) return { ok: false, error: "Item inconnu." };

  const items = await loadInventory(characterId);

  // Find a bag entry for this item
  const bagEntry = items.find((e) => e.itemId === itemId && e.slot === -1);
  if (!bagEntry || bagEntry.quantity <= 0) {
    return { ok: false, error: "Tu n'as pas cet objet dans ton sac." };
  }

  const targetSlot = itemDef.slot;

  // Unequip whatever is in this slot currently
  const currentlyEquipped = items.find((e) => e.slot === targetSlot && e.slot >= 0);
  if (currentlyEquipped) {
    // Move it back to bag
    const existingBag = items.find(
      (e) => e.itemId === currentlyEquipped.itemId && e.slot === -1
    );
    if (existingBag) {
      existingBag.quantity++;
    } else {
      items.push({ itemId: currentlyEquipped.itemId, quantity: 1, slot: -1 });
    }
    // Remove equipped entry
    const idx = items.indexOf(currentlyEquipped);
    if (idx >= 0) items.splice(idx, 1);
  }

  // Remove one from bag
  bagEntry.quantity--;
  if (bagEntry.quantity <= 0) {
    const idx = items.indexOf(bagEntry);
    if (idx >= 0) items.splice(idx, 1);
  }

  // Add equipped entry
  items.push({ itemId, quantity: 1, slot: targetSlot });

  await saveInventory(characterId, items);
  return { ok: true, inventory: items };
}

export async function unequipItem(
  characterId: number,
  slot: number
): Promise<EquipResult> {
  const items = await loadInventory(characterId);

  const equipped = items.find((e) => e.slot === slot && e.slot >= 0);
  if (!equipped) return { ok: false, error: "Rien d'équipé dans cet emplacement." };

  // Move to bag
  const existingBag = items.find((e) => e.itemId === equipped.itemId && e.slot === -1);
  if (existingBag) {
    existingBag.quantity++;
  } else {
    items.push({ itemId: equipped.itemId, quantity: 1, slot: -1 });
  }

  // Remove equipped entry
  const idx = items.indexOf(equipped);
  if (idx >= 0) items.splice(idx, 1);

  await saveInventory(characterId, items);
  return { ok: true, inventory: items };
}

/* ------------------------------------------------------------------ */
/*  Equipment stat bonuses                                            */
/* ------------------------------------------------------------------ */

export interface EquipmentBonuses {
  vitality: number;
  wisdom: number;
  strength: number;
  chance: number;
  agility: number;
  intelligence: number;
}

/**
 * Calculate total stat bonuses from all equipped items.
 */
export async function getEquipmentBonuses(
  characterId: number
): Promise<EquipmentBonuses> {
  const items = await loadInventory(characterId);
  const bonuses: EquipmentBonuses = {
    vitality: 0,
    wisdom: 0,
    strength: 0,
    chance: 0,
    agility: 0,
    intelligence: 0,
  };

  for (const entry of items) {
    if (entry.slot < 0) continue; // Skip bag items
    const itemDef = getItem(entry.itemId);
    if (!itemDef) continue;

    for (const eff of itemDef.effects) {
      if (eff.stat in bonuses) {
        bonuses[eff.stat as keyof EquipmentBonuses] += eff.value;
      }
    }
  }

  return bonuses;
}

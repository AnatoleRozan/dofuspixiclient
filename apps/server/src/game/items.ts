/* ------------------------------------------------------------------ */
/*  Item Catalog — 20 PvP equipment items for Dofus 1.29              */
/* ------------------------------------------------------------------ */

export interface ItemEffect {
  stat: "vitality" | "wisdom" | "strength" | "chance" | "agility" | "intelligence";
  value: number;
}

export interface ItemDefinition {
  id: number;
  name: string;
  /** Equipment slot: 0=Amulette, 1=Arme, 2=Anneau, 3=Ceinture, 4=Bottes, 5=Coiffe, 6=Cape */
  slot: number;
  level: number;
  price: number;
  effects: ItemEffect[];
  description: string;
}

/** Equipment slot names for display */
export const SLOT_NAMES: Record<number, string> = {
  0: "Amulette",
  1: "Arme",
  2: "Anneau",
  3: "Ceinture",
  4: "Bottes",
  5: "Coiffe",
  6: "Cape",
};

/** All items in the game, keyed by ID. */
const ITEM_CATALOG = new Map<number, ItemDefinition>();

function defineItem(item: ItemDefinition): void {
  ITEM_CATALOG.set(item.id, item);
}

/* ------------------------------------------------------------------ */
/*  Tier 1 — Starter gear (cheap)                                     */
/* ------------------------------------------------------------------ */

defineItem({
  id: 1,
  name: "Coiffe du Piou",
  slot: 5,
  level: 1,
  price: 500,
  effects: [{ stat: "vitality", value: 5 }],
  description: "Un petit chapeau fait de plumes de Piou.",
});

defineItem({
  id: 2,
  name: "Cape du Piou",
  slot: 6,
  level: 1,
  price: 500,
  effects: [{ stat: "vitality", value: 5 }],
  description: "Une cape légère en plumes bleues.",
});

defineItem({
  id: 3,
  name: "Amulette du Piou",
  slot: 0,
  level: 1,
  price: 400,
  effects: [{ stat: "vitality", value: 3 }, { stat: "wisdom", value: 2 }],
  description: "Un collier orné d'une plume de Piou.",
});

defineItem({
  id: 4,
  name: "Anneau de Blé",
  slot: 2,
  level: 1,
  price: 300,
  effects: [{ stat: "chance", value: 5 }],
  description: "Un anneau rustique des champs d'Astrub.",
});

defineItem({
  id: 5,
  name: "Ceinture de Cuir",
  slot: 3,
  level: 1,
  price: 400,
  effects: [{ stat: "vitality", value: 5 }],
  description: "Une ceinture en cuir de Bouftou.",
});

defineItem({
  id: 6,
  name: "Sandales Légères",
  slot: 4,
  level: 1,
  price: 600,
  effects: [{ stat: "agility", value: 5 }],
  description: "Des sandales souples pour les débutants.",
});

defineItem({
  id: 7,
  name: "Épée de Boisaille",
  slot: 1,
  level: 1,
  price: 2000,
  effects: [{ stat: "strength", value: 10 }],
  description: "Une épée en bois d'If, solide mais rudimentaire.",
});

/* ------------------------------------------------------------------ */
/*  Tier 2 — Mid gear                                                 */
/* ------------------------------------------------------------------ */

defineItem({
  id: 8,
  name: "Coiffe du Bouftou",
  slot: 5,
  level: 10,
  price: 8_000,
  effects: [{ stat: "vitality", value: 20 }, { stat: "wisdom", value: 5 }],
  description: "Un casque fait de cornes de Bouftou.",
});

defineItem({
  id: 9,
  name: "Cape du Bouftou",
  slot: 6,
  level: 10,
  price: 7_000,
  effects: [{ stat: "vitality", value: 10 }, { stat: "strength", value: 8 }],
  description: "Une cape en laine de Bouftou.",
});

defineItem({
  id: 10,
  name: "Amulette du Bouftou",
  slot: 0,
  level: 10,
  price: 6_000,
  effects: [{ stat: "vitality", value: 10 }, { stat: "wisdom", value: 8 }],
  description: "Une amulette ornée d'une corne de Bouftou.",
});

defineItem({
  id: 11,
  name: "Anneau du Bouftou",
  slot: 2,
  level: 10,
  price: 5_000,
  effects: [{ stat: "strength", value: 10 }],
  description: "Un anneau forgé dans une corne de Bouftou.",
});

defineItem({
  id: 12,
  name: "Ceinture du Bouftou",
  slot: 3,
  level: 10,
  price: 5_500,
  effects: [{ stat: "vitality", value: 15 }],
  description: "Une large ceinture en cuir de Bouftou.",
});

defineItem({
  id: 13,
  name: "Bottes du Bouftou",
  slot: 4,
  level: 10,
  price: 6_500,
  effects: [{ stat: "agility", value: 10 }, { stat: "vitality", value: 5 }],
  description: "Des bottes robustes en cuir de Bouftou.",
});

defineItem({
  id: 14,
  name: "Baguette de Glace",
  slot: 1,
  level: 10,
  price: 10_000,
  effects: [{ stat: "intelligence", value: 15 }, { stat: "vitality", value: 5 }],
  description: "Une baguette imprégnée de givre éternel.",
});

/* ------------------------------------------------------------------ */
/*  Tier 3 — End gear (expensive)                                     */
/* ------------------------------------------------------------------ */

defineItem({
  id: 15,
  name: "Coiffe du Tofu Royal",
  slot: 5,
  level: 30,
  price: 50_000,
  effects: [{ stat: "vitality", value: 35 }, { stat: "wisdom", value: 15 }],
  description: "La couronne du légendaire Tofu Royal.",
});

defineItem({
  id: 16,
  name: "Cape du Tofu Royal",
  slot: 6,
  level: 30,
  price: 45_000,
  effects: [{ stat: "vitality", value: 25 }, { stat: "intelligence", value: 15 }],
  description: "Une cape majestueuse en plumes dorées.",
});

defineItem({
  id: 17,
  name: "Amulette du Tofu Royal",
  slot: 0,
  level: 30,
  price: 40_000,
  effects: [{ stat: "intelligence", value: 18 }, { stat: "wisdom", value: 10 }],
  description: "Un pendentif royal d'une puissance ancienne.",
});

defineItem({
  id: 18,
  name: "Anneau du Tofu Royal",
  slot: 2,
  level: 30,
  price: 35_000,
  effects: [{ stat: "chance", value: 15 }, { stat: "vitality", value: 10 }],
  description: "Un anneau serti d'une plume dorée.",
});

defineItem({
  id: 19,
  name: "Ceinture du Tofu Royal",
  slot: 3,
  level: 30,
  price: 38_000,
  effects: [{ stat: "vitality", value: 30 }, { stat: "wisdom", value: 8 }],
  description: "Une ceinture royale d'une solidité remarquable.",
});

defineItem({
  id: 20,
  name: "Marteau du Bouftou Royal",
  slot: 1,
  level: 30,
  price: 80_000,
  effects: [
    { stat: "strength", value: 25 },
    { stat: "vitality", value: 15 },
    { stat: "agility", value: 5 },
  ],
  description: "Un marteau légendaire forgé dans les cornes du Bouftou Royal.",
});

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export function getItem(id: number): ItemDefinition | undefined {
  return ITEM_CATALOG.get(id);
}

export function getAllItems(): ItemDefinition[] {
  return [...ITEM_CATALOG.values()];
}

export function getItemCatalogForShop(): ItemDefinition[] {
  return getAllItems().sort((a, b) => a.price - b.price);
}

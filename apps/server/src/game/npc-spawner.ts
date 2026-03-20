import type { MapInstance } from "./map-instance.ts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface NpcDefinition {
  /** Unique NPC ID (large negative to avoid collision with monsters) */
  id: number;
  /** Display name */
  name: string;
  /** Sprite ID (from spritesheets) */
  gfxId: number;
  /** Map where this NPC spawns */
  mapId: number;
  /** Cell on the map */
  cellId: number;
  /** Facing direction (0-7) */
  direction: number;
}

/* ------------------------------------------------------------------ */
/*  NPC Registry                                                       */
/* ------------------------------------------------------------------ */

/** All scripted NPCs in the game, keyed by NPC ID. */
const NPC_REGISTRY = new Map<number, NpcDefinition>();

/** NPCs indexed by mapId for quick lookup during map join. */
const npcsByMap = new Map<number, NpcDefinition[]>();

/**
 * Register a static NPC definition.
 */
function registerNpc(npc: NpcDefinition): void {
  NPC_REGISTRY.set(npc.id, npc);

  let list = npcsByMap.get(npc.mapId);
  if (!list) {
    list = [];
    npcsByMap.set(npc.mapId, list);
  }
  list.push(npc);
}

/* ------------------------------------------------------------------ */
/*  NPC Definitions                                                    */
/* ------------------------------------------------------------------ */

// Otomaï — Alchimiste PvP, zaap d'Astrub [4, -19] (map 7411)
registerNpc({
  id: -100_001,
  name: "Otomaï",
  gfxId: 9066,
  mapId: 7411,
  cellId: 300,
  direction: 3,
});

// Marchand d'équipements PvP, zaap d'Astrub [4, -19] (map 7411)
registerNpc({
  id: -100_002,
  name: "Marchand d'Armes",
  gfxId: 9062,
  mapId: 7411,
  cellId: 330,
  direction: 1,
});

/* ------------------------------------------------------------------ */
/*  Spawn helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Spawn all NPCs for a given map into the map instance.
 * Call this *before* sending MAP_ACTORS so NPCs appear in the initial actor list.
 * Idempotent — checks if the NPC actor already exists.
 */
export function spawnNpcsForMap(mapInstance: MapInstance, mapId: number): void {
  const npcs = npcsByMap.get(mapId);
  if (!npcs || npcs.length === 0) return;

  for (const npc of npcs) {
    // Skip if already added (idempotent)
    if (mapInstance.hasActor(npc.id)) continue;

    const look = `${npc.gfxId}|||`;
    mapInstance.addNpc(npc.id, npc.name, npc.cellId, npc.direction, look);
  }

  console.log(`[NPC] Spawned ${npcs.length} NPC(s) on map ${mapId}`);
}

/**
 * Get an NPC definition by ID (used by interaction handler).
 */
export function getNpc(npcId: number): NpcDefinition | undefined {
  return NPC_REGISTRY.get(npcId);
}

/**
 * Check if an actor ID belongs to an NPC.
 */
export function isNpcId(id: number): boolean {
  return NPC_REGISTRY.has(id);
}

import { getMap } from "../maps/map-store.ts";
import { getPathfinding } from "../maps/pathfinding.ts";
import { encodeServerMessage } from "../protocol/codec.ts";
import {
  type ActorMovePayload,
  ServerMessageType,
} from "../protocol/types.ts";
import { getMapInstance } from "./game-manager.ts";
import type { MapInstance } from "./map-instance.ts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MonsterDef {
  gfxId: number;
  level: number;
}

interface MonsterState {
  id: number;
  mapId: number;
  cellId: number;
  direction: number;
  gfxId: number;
  level: number;
  name: string;
  /** Countdown (ms) until the next random walk attempt */
  nextMoveMs: number;
  /** True while the monster is "walking" (prevents overlapping moves) */
  isMoving: boolean;
  /** Countdown (ms) until the current walk animation ends server-side */
  moveEndMs: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Minimum / maximum interval (ms) between random walks */
const MIN_MOVE_INTERVAL = 3_000;
const MAX_MOVE_INTERVAL = 8_000;

/** Estimated single-cell walk duration (ms) */
const WALK_DURATION = 600;

/**
 * Monster ID → display name.
 * IDs come from the original Dofus 1.29 database `monsters` column.
 * Source: dofusserveurprive.wordpress.com/2013/03/30/liste-des-id-des-monstres/
 */
const MONSTER_NAMES: Record<number, string> = {
  // ── Pious (all share sprite 1212) ──
  236: "Piou Violet",
  489: "Piou Rouge",
  490: "Piou Vert",
  491: "Piou Bleu",
  492: "Piou Rose",
  493: "Piou Jaune",

  // ── Bouftous ──
  36: "Bouftou",
  101: "Bouftou",
  134: "Boufton Blanc",
  147: "Bouftou Royal",
  148: "Chef de Guerre Bouftou",
  149: "Boufton Noir",

  // ── Arakne ──
  52: "Arakne",
  246: "Arakne",
  255: "Arakne Agressive",
  259: "Arakne Majeure",
  474: "Arakne Malade",

  // ── Tofu ──
  43: "Tofu",
  98: "Tofu",
  382: "Tofu Royal",
  473: "Tofu Malade",

  // ── Larves ──
  31: "Larve Bleue",
  34: "Larve Verte",
  46: "Larve Orange",

  // ── Moskito ──
  61: "Moskito",

  // ── Crabe ──
  63: "Crabe",

  // ── Chafers ──
  54: "Chafer",
  110: "Chafer Invisible",
  290: "Chafer Lancier",
  291: "Chafer Archer",
  292: "Chafer d'Élite",

  // ── Gelées ──
  55: "Gelée Bleue",
  56: "Gelée Menthe",
  57: "Gelée Fraise",
  58: "Gelée R. Bleue",
  85: "Gelée R. Menthe",
  86: "Gelée R. Fraise",

  // ── Wabbits ──
  64: "Wabbit",
  65: "Black Wabbit",
  68: "Black Tiwabbit",
  72: "Tiwabbit Kiafin",
  96: "Tiwabbit",
  97: "Wo Wabbit",

  // ── Scarafeuilles ──
  194: "Scarafeuille Rouge",
  198: "Scarafeuille Bleu",
  240: "Scarafeuille Vert",
  241: "Scarafeuille Blanc",
  795: "Scarafeuille Noir",

  // ── Bworks ──
  53: "Bwork Mage",
  74: "Bwork Archer",
  178: "Gobelin",

  // ── Blops ──
  273: "Blop Coco",
  274: "Blop Indigo",
  275: "Blop Griotte",
  276: "Blop Reinette",
  281: "Corbac",

  // ── Plantes / Champs ──
  40: "Sanglier",
  41: "Prespic",
  48: "Tournesol Sauvage",
  59: "Champ Champ",
  78: "Rose Démoniaque",
  79: "Pissenlit Diabolique",
  103: "Prespic",
  104: "Sanglier",
  297: "Sanglier des Plaines",

  // ── Craqueleurs ──
  106: "Craqueleur",
  293: "Craqueleur des Plaines",
  483: "Craqueboule",

  // ── Abraknydes ──
  47: "Abraknyde",
  253: "Abraknyde Sombre",
  257: "Chêne Mou",

  // ── Mulou ──
  102: "Mulou",
  159: "Milimulou",
  232: "Meulou",
  233: "Trooll",

  // ── Kwaks / Bwaks ──
  235: "Kwak de Terre",
  265: "Bwak de Feu",
  266: "Bwak de Terre",
  267: "Bwak d'Air",
  268: "Bwak d'Eau",

  // ── Flammèches ──
  242: "Flammèche Feu",
  243: "Flammèche Eau",
  244: "Flammèche Terre",
  245: "Flammèche Air",

  // ── Divers ──
  107: "Dark Vlad",
  112: "Boo",
  113: "Dragon Cochon",
  121: "Minotoror",
  127: "Vampire",
  261: "Crocodaille",
  287: "Kanigrou",
  288: "Serpentin",
  298: "Scorbute",
  299: "Croc Gland",
  300: "Kolérat",
  301: "Ouginak",
  343: "Cavalier Porkass",
  344: "Berger Porkass",
  371: "Maître Bolet",
  372: "Guerrier",
  442: "Rat d'Égoutant",

  // ── Fouduglen / Pandala / Cania ──
  463: "Fouduglen",
  524: "Bambouto",
  546: "Bambouto Sacré",
  568: "Tanukouï San",
  569: "Tanuki Chan",

  // ── Koalaks ──
  744: "Koalak Sanguin",
};

/**
 * Monster ID (from DB) → spritesheet ID (in assets/spritesheets/sprites/).
 * Only monsters with a valid mapping will be spawned.
 * Source: dream-dofus.forumactif.com/t12-id-de-morph
 */
const SPRITE_GFX: Record<number, number> = {
  // ── Pious (all share sprite 1212) ──
  236: 1212,
  489: 1212,
  490: 1212,
  491: 1212,
  492: 1212,
  493: 1212,

  // ── Bouftous ──
  36: 1566,
  101: 1566,
  134: 1570,  // Boufton Blanc
  147: 1574,  // Bouftou Royal
  148: 1573,  // Chef de Guerre Bouftou
  149: 1571,  // Boufton Noir

  // ── Arakne ──
  52: 1564,
  246: 1564,
  255: 1564,  // Arakne Agressive
  259: 1161,  // Arakne Majeure
  474: 1564,  // Arakne Malade

  // ── Tofu ──
  43: 1558,
  98: 1558,
  382: 1151,  // Tofu Royal
  473: 1019,  // Tofu Malade

  // ── Larves ──
  31: 1563,   // Larve Bleue
  34: 1568,   // Larve Verte
  46: 1567,   // Larve Orange

  // ── Moskito ──
  61: 1572,

  // ── Crabe ──
  63: 1009,

  // ── Chafers ──
  54: 1014,
  110: 1047,  // Chafer Invisible
  290: 1189,  // Chafer Lancier
  291: 1190,  // Chafer Archer
  292: 1048,  // Chafer d'Élite

  // ── Gelées ──
  55: 1062,
  56: 1064,
  57: 1066,
  58: 1061,
  85: 1063,
  86: 1065,

  // ── Wabbits ──
  64: 1050,
  65: 1051,
  68: 1054,   // Black Tiwabbit
  72: 1055,   // Tiwabbit Kiafin
  96: 1053,
  97: 1052,

  // ── Scarafeuilles ──
  194: 1136,
  198: 1135,
  240: 1137,
  241: 1138,
  795: 1453,

  // ── Bworks ──
  53: 1012,
  74: 1004,
  178: 1076,  // Gobelin

  // ── Blops ──
  273: 1174,
  274: 1171,
  275: 1172,
  276: 1173,
  277: 1175,
  278: 1178,
  279: 1176,
  280: 1177,
  281: 1179,  // Corbac

  // ── Plantes / Champs ──
  40: 1562,   // Sanglier
  41: 1020,   // Prespic
  48: 1569,   // Tournesol Sauvage
  59: 1565,   // Champ Champ
  78: 1561,   // Rose Démoniaque
  79: 1560,   // Pissenlit Diabolique
  103: 1020,  // Prespic
  104: 1562,  // Sanglier
  297: 1070,  // Sanglier des Plaines

  // ── Craqueleurs ──
  106: 1008,
  293: 1049,  // Craqueleur des Plaines
  483: 1248,  // Craqueboule

  // ── Abraknydes ──
  47: 1001,
  253: 1158,  // Abraknyde Sombre
  257: 1157,  // Chêne Mou

  // ── Mulou ──
  102: 1069,
  159: 1107,  // Milimulou
  232: 1134,  // Meulou
  233: 1131,  // Trooll

  // ── Kwaks / Bwaks ──
  235: 1149,
  265: 1166,
  266: 1168,
  267: 1169,
  268: 1167,

  // ── Flammèches ──
  242: 1145,
  243: 1146,
  244: 1147,
  245: 1148,

  // ── Divers ──
  107: 1071,  // Dark Vlad
  112: 1067,  // Boo
  113: 1037,  // Dragon Cochon
  121: 1088,  // Minotoror
  127: 1077,  // Vampire
  261: 1159,  // Crocodaille
  287: 1039,  // Kanigrou
  288: 1013,  // Serpentin
  298: 1198,  // Scorbute
  299: 1201,  // Croc Gland
  300: 1085,  // Kolérat
  301: 1196,  // Ouginak
  343: 1038,  // Cavalier Porkass
  344: 1040,  // Berger Porkass
  371: 1209,  // Maître Bolet
  372: 1205,  // Guerrier
  442: 1155,  // Rat d'Égoutant
  467: 1044,  // Rose Obscure

  // ── Fouduglen / Pandala / Cania ──
  463: 1249,
  465: 1226,
  475: 1226,
  494: 1219,
  495: 1251,
  496: 1252,
  498: 1253,
  524: 1285,
  527: 1276,
  528: 1275,
  529: 1275,
  546: 1286,
  549: 1248,
  568: 1283,  // Tanukouï San
  569: 1284,  // Tanuki Chan

  // ── Koalaks ──
  744: 1361,
  745: 1362,
  746: 1363,
  747: 1364,
  748: 1365,
  751: 1359,
  752: 1359,
  753: 1359,
  754: 1359,
  755: 1366,

  // ── Divers hauts niveaux ──
  785: 1446,
  786: 1449,
  796: 1462,
};

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

/** Global negative-ID counter — each monster gets a unique negative ID */
let nextMonsterId = -1;

/** All spawned monster states, keyed by mapId */
const monstersByMap = new Map<number, MonsterState[]>();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function randomInterval(): number {
  return (
    MIN_MOVE_INTERVAL +
    Math.random() * (MAX_MOVE_INTERVAL - MIN_MOVE_INTERVAL)
  );
}

/**
 * Parse the `monsters` column from the maps table.
 * Format: `|gfxId,level|gfxId,level|...`
 */
function parseMonsters(str: string): MonsterDef[] {
  if (!str || str.length < 3) return [];

  const defs: MonsterDef[] = [];
  const parts = str.split("|").filter(Boolean);

  for (const part of parts) {
    const [gfxStr, lvlStr] = part.split(",");
    const gfxId = parseInt(gfxStr, 10);
    const level = parseInt(lvlStr, 10);
    if (!isNaN(gfxId) && !isNaN(level)) {
      defs.push({ gfxId, level });
    }
  }

  return defs;
}

/* ------------------------------------------------------------------ */
/*  Spawn / Despawn                                                    */
/* ------------------------------------------------------------------ */

/**
 * Spawn monsters for a map instance (idempotent).
 * Call this *before* sending MAP_ACTORS so monsters are included.
 */
export async function spawnMonstersForMap(
  mapInstance: MapInstance,
  mapId: number
): Promise<void> {
  // Already spawned?
  if (monstersByMap.has(mapId)) return;

  const map = await getMap(mapId);
  if (!map) return;

  const defs = parseMonsters(map.monsters);
  if (defs.length === 0) return;

  const pf = await getPathfinding(mapId);
  if (!pf) return;

  const walkable = map.walkableIds;
  if (!walkable || walkable.length === 0) return;

  const monsters: MonsterState[] = [];

  for (const def of defs) {
    // Pick a random walkable cell that isn't already occupied
    let cellId: number | null = null;
    const shuffled = [...walkable].sort(() => Math.random() - 0.5);

    for (const candidate of shuffled) {
      // Avoid cells occupied by other monsters or players
      const isOccupied = monsters.some((m) => m.cellId === candidate);
      if (!isOccupied) {
        cellId = candidate;
        break;
      }
    }

    if (cellId === null) continue;

    const id = nextMonsterId--;
    const direction = Math.floor(Math.random() * 8);
    // Skip monsters we don't have a sprite mapping for
    const spriteGfx = SPRITE_GFX[def.gfxId];
    if (spriteGfx === undefined) continue;

    const name = MONSTER_NAMES[def.gfxId] ?? "";
    const look = `${spriteGfx}|||`;

    const state: MonsterState = {
      id,
      mapId,
      cellId,
      direction,
      gfxId: def.gfxId,
      level: def.level,
      name,
      nextMoveMs: randomInterval(),
      isMoving: false,
      moveEndMs: 0,
    };

    monsters.push(state);

    // Register in pathfinding occupancy
    pf.addOccupied(cellId);

    // Add to the map instance (broadcasts ACTOR_ADD to current subscribers)
    mapInstance.addMonster(id, name, cellId, direction, look);
  }

  monstersByMap.set(mapId, monsters);
  console.log(
    `[Monsters] Spawned ${monsters.length} monsters on map ${mapId}`
  );
}

/**
 * Remove all monster state for a map (called when map instance is cleaned up).
 */
export async function despawnMonstersForMap(mapId: number): Promise<void> {
  const monsters = monstersByMap.get(mapId);
  if (!monsters) return;

  const pf = await getPathfinding(mapId);

  for (const m of monsters) {
    if (pf) pf.removeOccupied(m.cellId);
  }

  monstersByMap.delete(mapId);
  console.log(`[Monsters] Despawned monsters on map ${mapId}`);
}

/* ------------------------------------------------------------------ */
/*  Tick — random walk AI                                              */
/* ------------------------------------------------------------------ */

/**
 * Tick handler registered at 20Hz.
 * Iterates all spawned monsters and moves them randomly.
 */
export function tickMonsters(deltaMs: number): void {
  for (const [mapId, monsters] of monstersByMap) {
    const mapInstance = getMapInstance(mapId);
    if (!mapInstance) continue;

    for (const m of monsters) {
      if (m.isMoving) {
        m.moveEndMs -= deltaMs;
        if (m.moveEndMs <= 0) {
          m.isMoving = false;
        }
        continue;
      }

      m.nextMoveMs -= deltaMs;
      if (m.nextMoveMs > 0) continue;

      // Time to move — reset timer regardless of outcome
      m.nextMoveMs = randomInterval();

      // Get pathfinding to find walkable neighbors
      // We use a fire-and-forget async call since the tick is synchronous
      void moveMonster(m, mapInstance);
    }
  }
}

async function moveMonster(
  m: MonsterState,
  mapInstance: MapInstance
): Promise<void> {
  const pf = await getPathfinding(m.mapId);
  if (!pf) return;

  const map = await getMap(m.mapId);
  if (!map) return;

  const walkableSet = new Set(map.walkableIds);
  const neighbors = pf.getNeighbors(m.cellId);

  // Filter to walkable, non-occupied cells
  const candidates = neighbors.filter(
    (n) => walkableSet.has(n)
  );

  if (candidates.length === 0) return;

  const targetCell = candidates[Math.floor(Math.random() * candidates.length)];
  const oldCell = m.cellId;

  // Update pathfinding occupancy
  pf.removeOccupied(oldCell);
  pf.addOccupied(targetCell);

  // Compute direction
  const direction = pf.getDirection(oldCell, targetCell);

  // Update monster state
  m.cellId = targetCell;
  m.direction = direction;
  m.isMoving = true;
  m.moveEndMs = WALK_DURATION;

  // Update map instance actor
  mapInstance.updateActorCell(m.id, targetCell, direction);

  // Broadcast ACTOR_MOVE to all players on the map
  const movePayload: ActorMovePayload = {
    id: m.id,
    path: [oldCell, targetCell],
  };
  const msg = encodeServerMessage(ServerMessageType.ACTOR_MOVE, movePayload);
  mapInstance.broadcastToAll(msg);
}

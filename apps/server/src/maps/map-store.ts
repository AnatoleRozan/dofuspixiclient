import { db } from "../db/database.ts";

interface CachedMap {
  id: number;
  width: number;
  height: number;
  x: number;
  y: number;
  superarea: number;
  background: number;
  places: string;
  cells: unknown[];
  cellsGzip: Buffer;
  walkableIds: number[];
  monsters: string;
}

const cache = new Map<number, CachedMap>();
const MAX_CACHE_SIZE = 500;

async function loadFromDb(mapId: number): Promise<CachedMap | null> {
  const row = await db
    .selectFrom("maps")
    .select([
      "id",
      "width",
      "height",
      "x",
      "y",
      "superarea",
      "background",
      "places",
      "cells",
      "cells_gzip",
      "walkable_ids",
      "monsters",
    ])
    .where("id", "=", mapId)
    .executeTakeFirst();

  if (!row) return null;

  const cells =
    typeof row.cells === "string" ? JSON.parse(row.cells) : row.cells;

  const entry: CachedMap = {
    id: row.id,
    width: row.width,
    height: row.height,
    x: row.x,
    y: row.y,
    superarea: row.superarea,
    background: row.background ?? 0,
    places: row.places ?? "",
    cells: cells as unknown[],
    cellsGzip: row.cells_gzip,
    walkableIds: row.walkable_ids,
    monsters: row.monsters ?? "",
  };

  // LRU eviction
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value!;
    cache.delete(firstKey);
  }

  cache.set(mapId, entry);
  return entry;
}

export async function getMap(mapId: number): Promise<CachedMap | null> {
  const cached = cache.get(mapId);
  if (cached) {
    // Move to end for LRU
    cache.delete(mapId);
    cache.set(mapId, cached);
    return cached;
  }
  return loadFromDb(mapId);
}

export async function getCompressedMap(mapId: number): Promise<Buffer | null> {
  const map = await getMap(mapId);
  return map?.cellsGzip ?? null;
}

export async function getWalkableIds(mapId: number): Promise<number[] | null> {
  const map = await getMap(mapId);
  return map?.walkableIds ?? null;
}

export async function mapExists(mapId: number): Promise<boolean> {
  const map = await getMap(mapId);
  return map !== null;
}

/**
 * Find the 4 adjacent maps (N, S, E, W) by coordinate offset.
 * Returns an array of { mapId, width, height, background, cellsGzip } for each neighbor found.
 */
export async function getAdjacentMaps(
  mapId: number
): Promise<
  Array<{
    mapId: number;
    width: number;
    height: number;
    background: number;
    cellsGzip: Buffer;
  }>
> {
  const map = await getMap(mapId);
  if (!map) return [];

  const offsets = [
    { dx: 0, dy: -1 }, // North
    { dx: 0, dy: 1 },  // South
    { dx: 1, dy: 0 },  // East
    { dx: -1, dy: 0 }, // West
  ];

  const results: Array<{
    mapId: number;
    width: number;
    height: number;
    background: number;
    cellsGzip: Buffer;
  }> = [];

  for (const { dx, dy } of offsets) {
    const row = await db
      .selectFrom("maps")
      .select(["id", "width", "height", "background", "cells_gzip"])
      .where("x", "=", map.x + dx)
      .where("y", "=", map.y + dy)
      .where("superarea", "=", map.superarea)
      .executeTakeFirst();

    if (row && row.cells_gzip) {
      results.push({
        mapId: row.id,
        width: row.width,
        height: row.height,
        background: row.background ?? 0,
        cellsGzip: row.cells_gzip,
      });
    }
  }

  return results;
}

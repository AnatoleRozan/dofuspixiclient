import type { ClientSession } from "../ws/client-session.ts";
import { getServer } from "../ws/server-ref.ts";
import { encodeServerMessage } from "../protocol/codec.ts";
import {
  type ActorAddPayload,
  type ActorRemovePayload,
  ServerMessageType,
} from "../protocol/types.ts";

interface MapActor {
  id: number;
  type: number;
  cellId: number;
  direction: number;
  name: string;
  look: string;
  session?: ClientSession;
}

export class MapInstance {
  readonly mapId: number;
  private actors = new Map<number, MapActor>();

  constructor(mapId: number) {
    this.mapId = mapId;
  }

  get topic(): string {
    return `map:${this.mapId}`;
  }

  addActor(
    session: ClientSession,
    characterId: number,
    name: string,
    cellId: number,
    direction: number,
    look: string
  ): void {
    this.actors.set(characterId, {
      id: characterId,
      type: 0,
      cellId,
      direction,
      name,
      look,
      session,
    });

    // Subscribe to map topic
    session.ws.subscribe(this.topic);

    // Broadcast ACTOR_ADD to others on this map
    const addPayload: ActorAddPayload = {
      id: characterId,
      type: 0,
      cellId,
      direction,
      name,
      look,
    };
    const msg = encodeServerMessage(ServerMessageType.ACTOR_ADD, addPayload);
    session.ws.publish(this.topic, msg);
  }

  removeActor(characterId: number): void {
    const actor = this.actors.get(characterId);
    if (!actor) return;

    // Broadcast ACTOR_REMOVE before unsubscribing
    const removePayload: ActorRemovePayload = { id: characterId };
    const msg = encodeServerMessage(
      ServerMessageType.ACTOR_REMOVE,
      removePayload
    );

    if (actor.session) {
      actor.session.ws.publish(this.topic, msg);
      actor.session.ws.unsubscribe(this.topic);
    } else {
      this.broadcastToAll(msg);
    }

    this.actors.delete(characterId);
  }

  /**
   * Add a monster actor (no WebSocket session).
   */
  addMonster(
    id: number,
    name: string,
    cellId: number,
    direction: number,
    look: string
  ): void {
    this.actors.set(id, {
      id,
      type: 1,
      cellId,
      direction,
      name,
      look,
    });

    // Broadcast to all current subscribers via server-level publish
    const addPayload: ActorAddPayload = {
      id,
      type: 1,
      cellId,
      direction,
      name,
      look,
    };
    const msg = encodeServerMessage(ServerMessageType.ACTOR_ADD, addPayload);
    this.broadcastToAll(msg);
  }

  /**
   * Remove a monster actor.
   */
  removeMonster(monsterId: number): void {
    const actor = this.actors.get(monsterId);
    if (!actor) return;

    const removePayload: ActorRemovePayload = { id: monsterId };
    const msg = encodeServerMessage(
      ServerMessageType.ACTOR_REMOVE,
      removePayload
    );
    this.broadcastToAll(msg);

    this.actors.delete(monsterId);
  }

  updateActorCell(
    characterId: number,
    cellId: number,
    direction: number
  ): void {
    const actor = this.actors.get(characterId);
    if (actor) {
      actor.cellId = cellId;
      actor.direction = direction;
    }
  }

  getActors(): ActorAddPayload[] {
    const result: ActorAddPayload[] = [];
    for (const actor of this.actors.values()) {
      result.push({
        id: actor.id,
        type: actor.type,
        cellId: actor.cellId,
        direction: actor.direction,
        name: actor.name,
        look: actor.look,
      });
    }
    return result;
  }

  /**
   * Broadcast data to all subscribers of this map's topic via the Bun server.
   * Works without needing a specific WebSocket session (used for monster broadcasts).
   */
  broadcastToAll(data: Uint8Array): void {
    getServer().publish(this.topic, data);
  }

  broadcast(data: Uint8Array, sender: ClientSession): void {
    sender.ws.publish(this.topic, data);
  }

  get actorCount(): number {
    return this.actors.size;
  }

  /**
   * Count only player actors (type === 0).
   */
  get playerCount(): number {
    let count = 0;
    for (const a of this.actors.values()) {
      if (a.type === 0) count++;
    }
    return count;
  }

  /**
   * A map is empty when there are no player actors.
   * Monsters alone don't keep a map instance alive.
   */
  isEmpty(): boolean {
    return this.playerCount === 0;
  }
}

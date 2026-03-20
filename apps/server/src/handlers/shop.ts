/* ------------------------------------------------------------------ */
/*  Shop & Inventory handlers                                         */
/* ------------------------------------------------------------------ */

import {
  buyItem,
  equipItem,
  loadInventory,
  unequipItem,
  type InventoryEntry,
} from "../game/inventory.ts";
import { getItem } from "../game/items.ts";
import { encodeServerMessage } from "../protocol/codec.ts";
import { ServerMessageType } from "../protocol/types.ts";
import type { ClientSession } from "../ws/client-session.ts";
import { sendCharacterStats } from "./stats.ts";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function enrichInventory(items: InventoryEntry[]) {
  return items.map((e) => {
    const def = getItem(e.itemId);
    return {
      itemId: e.itemId,
      name: def?.name ?? "???",
      effects: def?.effects ?? [],
      description: def?.description ?? "",
      itemSlot: def?.slot ?? -1,
      quantity: e.quantity,
      slot: e.slot,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Send full inventory to client                                     */
/* ------------------------------------------------------------------ */

export async function sendInventoryData(session: ClientSession): Promise<void> {
  if (!session.characterId) return;

  const items = await loadInventory(session.characterId);
  session.ws.send(
    encodeServerMessage(ServerMessageType.INVENTORY_DATA, {
      items: enrichInventory(items),
    })
  );
}

/* ------------------------------------------------------------------ */
/*  Buy                                                               */
/* ------------------------------------------------------------------ */

export async function handleShopBuy(
  session: ClientSession,
  payload: { itemId: number }
): Promise<void> {
  if (!session.characterId) return;

  const result = await buyItem(session.characterId, payload.itemId);

  if (!result.ok) {
    session.ws.send(
      encodeServerMessage(ServerMessageType.INTERACT_DIALOG, {
        npcId: 0,
        npcName: "Marchand",
        messages: [result.error ?? "Erreur."],
      })
    );
    return;
  }

  console.log(
    `[Shop] ${session.characterName} bought item ${payload.itemId} (kamas: ${result.newKama})`
  );

  // Send updated inventory
  session.ws.send(
    encodeServerMessage(ServerMessageType.INVENTORY_UPDATE, {
      items: enrichInventory(result.inventory!),
    })
  );

  // Send updated stats (kamas changed)
  await sendCharacterStats(session);
}

/* ------------------------------------------------------------------ */
/*  Equip                                                             */
/* ------------------------------------------------------------------ */

export async function handleInventoryEquip(
  session: ClientSession,
  payload: { itemId: number }
): Promise<void> {
  if (!session.characterId) return;

  const result = await equipItem(session.characterId, payload.itemId);

  if (!result.ok) {
    session.ws.send(
      encodeServerMessage(ServerMessageType.INTERACT_DIALOG, {
        npcId: 0,
        npcName: "Système",
        messages: [result.error ?? "Erreur."],
      })
    );
    return;
  }

  console.log(`[Inventory] ${session.characterName} equipped item ${payload.itemId}`);

  session.ws.send(
    encodeServerMessage(ServerMessageType.INVENTORY_UPDATE, {
      items: enrichInventory(result.inventory!),
    })
  );

  // Recalculate stats with equipment bonuses
  await sendCharacterStats(session);
}

/* ------------------------------------------------------------------ */
/*  Unequip                                                           */
/* ------------------------------------------------------------------ */

export async function handleInventoryUnequip(
  session: ClientSession,
  payload: { slot: number }
): Promise<void> {
  if (!session.characterId) return;

  const result = await unequipItem(session.characterId, payload.slot);

  if (!result.ok) {
    session.ws.send(
      encodeServerMessage(ServerMessageType.INTERACT_DIALOG, {
        npcId: 0,
        npcName: "Système",
        messages: [result.error ?? "Erreur."],
      })
    );
    return;
  }

  console.log(`[Inventory] ${session.characterName} unequipped slot ${payload.slot}`);

  session.ws.send(
    encodeServerMessage(ServerMessageType.INVENTORY_UPDATE, {
      items: enrichInventory(result.inventory!),
    })
  );

  // Recalculate stats without equipment bonuses
  await sendCharacterStats(session);
}

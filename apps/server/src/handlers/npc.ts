import { db } from "../db/database.ts";
import { getCharacterById } from "../game/character.ts";
import { getItemCatalogForShop } from "../game/items.ts";
import { getNpc, isNpcId } from "../game/npc-spawner.ts";
import { encodeServerMessage } from "../protocol/codec.ts";
import { ServerMessageType } from "../protocol/types.ts";
import type { ClientSession } from "../ws/client-session.ts";
import { sendCharacterStats } from "./stats.ts";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Kamas reward from Otomaï */
const OTOMAI_KAMA_REWARD = 1_000_000;

/** NPC IDs */
const OTOMAI_NPC_ID = -100_001;
const MERCHANT_NPC_ID = -100_002;

/* ------------------------------------------------------------------ */
/*  NPC interaction handler                                            */
/* ------------------------------------------------------------------ */

export async function handleInteractNpc(
  session: ClientSession,
  payload: { npcId: number }
): Promise<void> {
  const { npcId } = payload;

  if (!session.characterId) return;
  if (!isNpcId(npcId)) {
    console.warn(`[NPC] Unknown NPC ID: ${npcId}`);
    return;
  }

  const npc = getNpc(npcId);
  if (!npc) return;

  // Make sure the player is on the same map as the NPC
  if (session.mapId !== npc.mapId) {
    console.warn(`[NPC] Player not on NPC map (player: ${session.mapId}, npc: ${npc.mapId})`);
    return;
  }

  console.log(`[NPC] ${session.characterName} interacts with ${npc.name}`);

  // Dispatch to the right NPC script
  if (npcId === OTOMAI_NPC_ID) {
    await handleOtomaiInteraction(session);
  } else if (npcId === MERCHANT_NPC_ID) {
    handleMerchantInteraction(session);
  }
}

/* ------------------------------------------------------------------ */
/*  Otomaï script                                                      */
/* ------------------------------------------------------------------ */

async function handleOtomaiInteraction(session: ClientSession): Promise<void> {
  if (!session.characterId) return;

  const character = await getCharacterById(session.characterId);
  if (!character) return;

  // Give kamas
  const newKama = character.kama + OTOMAI_KAMA_REWARD;
  await db
    .updateTable("characters")
    .set({ kama: newKama })
    .where("id", "=", session.characterId)
    .execute();

  console.log(
    `[NPC] Otomaï gave ${OTOMAI_KAMA_REWARD.toLocaleString()} kamas to ${session.characterName} (total: ${newKama.toLocaleString()})`
  );

  // Send dialogue to client
  session.ws.send(
    encodeServerMessage(ServerMessageType.INTERACT_DIALOG, {
      npcId: OTOMAI_NPC_ID,
      npcName: "Otomaï",
      messages: [
        "Bienvenue, aventurier ! Je suis Otomaï, maître alchimiste.",
        "J'ai entendu parler de ta bravoure... Tu mérites une récompense.",
        `Voici ${OTOMAI_KAMA_REWARD.toLocaleString()} kamas pour toi. Utilise-les sagement pour t'équiper auprès du marchand !`,
      ],
    })
  );

  // Send updated stats (so kama count updates in UI)
  await sendCharacterStats(session);
}

/* ------------------------------------------------------------------ */
/*  Marchand d'Armes script — opens the shop                          */
/* ------------------------------------------------------------------ */

function handleMerchantInteraction(session: ClientSession): void {
  const items = getItemCatalogForShop();

  session.ws.send(
    encodeServerMessage(ServerMessageType.SHOP_OPEN, {
      npcName: "Marchand d'Armes",
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        slot: item.slot,
        level: item.level,
        price: item.price,
        effects: item.effects,
        description: item.description,
      })),
    })
  );

  console.log(`[NPC] Opened shop for ${session.characterName}`);
}

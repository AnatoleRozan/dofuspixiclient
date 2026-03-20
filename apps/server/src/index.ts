import { Elysia } from "elysia";

import { runMigrations } from "./db/database.ts";
import { getMapInstanceCount, getOnlineCount } from "./game/game-manager.ts";
import { tickMonsters } from "./game/monster-spawner.ts";
import { registerTickHandler, startTickLoop } from "./tick.ts";
import { getSessionCount } from "./ws/client-session.ts";
import { gameWs } from "./ws/game-ws.ts";
import { setServer } from "./ws/server-ref.ts";

const PORT = Number(process.env.PORT ?? 8080);

const app = new Elysia()
  .get("/health", () => ({
    status: "ok",
    online: getOnlineCount(),
    sessions: getSessionCount(),
    maps: getMapInstanceCount(),
    uptime: process.uptime(),
  }))
  .use(gameWs)
  .listen(PORT);

// Store the Bun server reference for topic broadcasting (used by monster AI)
setServer(app.server!);

// Run lightweight DB migrations (add columns if missing)
await runMigrations();

// Start the 20Hz game tick loop
startTickLoop();

// Register monster random-walk AI on the tick loop
registerTickHandler(tickMonsters);

console.log(
  `[Server] Dofus game server running on ws://localhost:${PORT}/game`
);
console.log(`[Server] Health check at http://localhost:${PORT}/health`);

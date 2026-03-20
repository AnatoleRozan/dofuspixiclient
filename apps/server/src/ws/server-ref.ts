/**
 * Holds a reference to the Bun server so we can call
 * `server.publish(topic, data)` without needing a specific WebSocket session.
 */

interface ServerRef {
  publish(topic: string, data: string | Uint8Array | ArrayBuffer): void;
}

let _server: ServerRef | null = null;

export function setServer(server: ServerRef): void {
  _server = server;
}

export function getServer(): ServerRef {
  if (!_server) throw new Error("Server not initialized");
  return _server;
}

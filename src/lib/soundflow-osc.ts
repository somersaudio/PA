// Bidirectional OSC bridge to SoundFlow
// Sends commands on port 9456, receives responses on port 9457

import { Client, Server, Message } from "node-osc";

const SEND_PORT = 9456;   // SoundFlow listens here
const RECV_PORT = 9457;   // We listen here for responses
const HOST = "127.0.0.1";
const TIMEOUT_MS = 10000;

let oscServer: InstanceType<typeof Server> | null = null;
let responseResolvers = new Map<string, (data: unknown) => void>();
let serverReady = false;

// Start the response listener (singleton)
function ensureServer() {
  if (oscServer) return;

  oscServer = new Server(RECV_PORT, HOST);
  oscServer.on("message", (msg: unknown[]) => {
    // msg = [address, ...args]
    if (msg[0] === "/pa/response" && msg[1]) {
      try {
        const data = JSON.parse(msg[1] as string);
        // Resolve any waiting promises
        for (const [, resolve] of responseResolvers) {
          resolve(data);
        }
        responseResolvers.clear();
      } catch {}
    }
  });
  oscServer.on("listening", () => {
    serverReady = true;
    console.log("[OSC] Listening for SoundFlow responses on port", RECV_PORT);
  });
  oscServer.on("error", (err: Error) => {
    console.error("[OSC] Server error:", err.message);
    // Port might be in use, try to recover
    oscServer = null;
    serverReady = false;
  });
}

// Send a command to SoundFlow and wait for a response
export async function sendCommand(
  action: string,
  args: Record<string, unknown> = {}
): Promise<{ ok: boolean; action?: string; data?: unknown; error?: string }> {
  ensureServer();

  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random()}`;
    const client = new Client(HOST, SEND_PORT);

    // Set up response listener
    const timer = setTimeout(() => {
      responseResolvers.delete(id);
      client.close();
      resolve({ ok: false, error: `Timeout after ${TIMEOUT_MS}ms — SoundFlow may not be listening on port ${SEND_PORT}. Check the OSC trigger is set up.` });
    }, TIMEOUT_MS);

    responseResolvers.set(id, (data) => {
      clearTimeout(timer);
      responseResolvers.delete(id);
      client.close();
      resolve(data as { ok: boolean; action?: string; data?: unknown; error?: string });
    });

    // Build OSC message with all args as JSON
    const allArgs = { action, ...args };
    const msg = new Message("/pa", JSON.stringify(allArgs));
    client.send(msg, () => {});
  });
}

// Convenience methods
export const SoundFlow = {
  ping: () => sendCommand("ping"),

  // Track data (BIDIRECTIONAL — gets real data back!)
  getTrackNames: () => sendCommand("getTrackNames"),
  getTrackInfo: (trackName: string) => sendCommand("getTrackInfo", { trackName }),
  getAllTrackInfo: () => sendCommand("getAllTrackInfo"),
  getInserts: (trackName: string) => sendCommand("getInserts", { trackName }),
  getSessionName: () => sendCommand("getSessionName"),

  // Track control
  selectTrack: (trackName: string) => sendCommand("selectTrack", { trackName }),
  muteTrack: (trackName: string, value = "Toggle") => sendCommand("muteTrack", { trackName, value }),
  soloTrack: (trackName: string, value = "Toggle") => sendCommand("soloTrack", { trackName, value }),
  clearAllSolos: () => sendCommand("clearAllSolos"),
  clearAllMutes: () => sendCommand("clearAllMutes"),

  // Volume
  setVolume: (trackName: string, db: number) => sendCommand("setVolume", { trackName, db }),
  nudgeVolume: (trackName: string, db: number) => sendCommand("nudgeVolume", { trackName, db }),
  resetVolume: (trackName: string) => sendCommand("resetVolume", { trackName }),

  // Pan
  resetPan: (trackName: string) => sendCommand("resetPan", { trackName }),

  // Plugins
  bypassInsert: (trackName: string, slot: number) => sendCommand("bypassInsert", { trackName, slot }),

  // Automation
  setAutomation: (mode: string) => sendCommand("setAutomation", { mode }),

  // Transport
  play: () => sendCommand("transport", { command: "play" }),
  stop: () => sendCommand("transport", { command: "stop" }),
  record: () => sendCommand("transport", { command: "record" }),
  returnToZero: () => sendCommand("transport", { command: "returnToZero" }),

  // Track management
  renameTrack: (trackName: string, newName: string) => sendCommand("renameTrack", { trackName, newName }),

  // Edit
  save: () => sendCommand("save"),
  undo: () => sendCommand("undo"),
  redo: () => sendCommand("redo"),

  // Menu
  menuClick: (menuPath: string[]) => sendCommand("menuClick", { menuPath: JSON.stringify(menuPath) }),

  // Keys
  pressKeys: (keys: string) => sendCommand("pressKeys", { keys }),

  // Raw
  rawScript: (code: string) => sendCommand("rawScript", { code }),
};

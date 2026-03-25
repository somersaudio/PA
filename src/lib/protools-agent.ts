// Agentic Pro Tools Mix Engineer
// AppleScript + Vision as primary control, SoundFlow for data when available

import Anthropic from "@anthropic-ai/sdk";
import { proToolsKey, clickAt, doubleClickAt, SoundFlowCommands } from "./soundflow";
import { captureProToolsScreenshot, analyzeScreenshot } from "./protools-vision";

const client = new Anthropic();

export type AgentStep = {
  type: "think" | "command" | "vision" | "result" | "error";
  content: string;
  timestamp: number;
};

export type AgentMode = "supervised" | "semi-autonomous" | "autonomous";

// Key codes
const K = {
  space: 49, return: 36, escape: 53, delete: 51,
  up: 126, down: 125, left: 123, right: 124,
  m: 46, s: 1, z: 6, a: 0, f: 3, d: 2, c: 8, v: 9, x: 7,
  equal: 24, leftBracket: 33, rightBracket: 30,
};

const AGENT_TOOLS: Anthropic.Tool[] = [
  // === VISION ===
  {
    name: "look_at_protools",
    description: "Screenshot Pro Tools and analyze it. Use to see track names, fader positions, meters, plugins, coordinates. Note X,Y coords of tracks for clicking.",
    input_schema: {
      type: "object" as const,
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
  // === SOUNDFLOW DATA (bonus — may timeout if SoundFlow CLI isn't working) ===
  {
    name: "sf_get_track_names",
    description: "Get track names via SoundFlow (fast, accurate). Falls back to screenshot if unavailable.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "sf_get_all_track_info",
    description: "Get all tracks with mute/solo state via SoundFlow.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "sf_mute_track",
    description: "Mute/unmute a track via SoundFlow (by exact name). More reliable than clicking.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_name: { type: "string" },
        value: { type: "string", enum: ["Enable", "Disable", "Toggle"] },
      },
      required: ["track_name"],
    },
  },
  {
    name: "sf_solo_track",
    description: "Solo/unsolo a track via SoundFlow (by exact name).",
    input_schema: {
      type: "object" as const,
      properties: {
        track_name: { type: "string" },
        value: { type: "string", enum: ["Enable", "Disable", "Toggle"] },
      },
      required: ["track_name"],
    },
  },
  {
    name: "sf_nudge_volume",
    description: "Nudge a track's volume via SoundFlow (by exact name, ~0.1dB steps).",
    input_schema: {
      type: "object" as const,
      properties: {
        track_name: { type: "string" },
        db: { type: "number", description: "Relative dB (+louder, -quieter)" },
      },
      required: ["track_name", "db"],
    },
  },
  {
    name: "sf_get_inserts",
    description: "Get plugin inserts on a track via SoundFlow.",
    input_schema: {
      type: "object" as const,
      properties: { track_name: { type: "string" } },
      required: ["track_name"],
    },
  },
  {
    name: "sf_run_script",
    description: "Run arbitrary SoundFlow script. Use sf.ui.proTools API. Set __result = {ok:true, data:...} for return value.",
    input_schema: {
      type: "object" as const,
      properties: {
        script: { type: "string" },
        description: { type: "string" },
      },
      required: ["script", "description"],
    },
  },
  // === APPLESCRIPT CONTROL (always works) ===
  {
    name: "click_at",
    description: "Click at screen coordinates. Use to select tracks, press buttons. Get coords from screenshots.",
    input_schema: {
      type: "object" as const,
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        double_click: { type: "boolean" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "transport",
    description: "Transport control: play, stop, returnToZero.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["play", "stop", "returnToZero"] },
      },
      required: ["action"],
    },
  },
  {
    name: "mute_selected",
    description: "Press M to toggle mute on currently selected track.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "solo_selected",
    description: "Press S to toggle solo on currently selected track.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "nudge_volume_selected",
    description: "Nudge currently selected track's volume. Must click track first.",
    input_schema: {
      type: "object" as const,
      properties: {
        db: { type: "number", description: "Relative dB" },
      },
      required: ["db"],
    },
  },
  {
    name: "clear_all_solos",
    description: "Clear all solos (Alt+S).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "clear_all_mutes",
    description: "Clear all mutes (Alt+M).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "undo",
    description: "Undo (Cmd+Z).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "save",
    description: "Save session (Cmd+S).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "toggle_mix_edit",
    description: "Toggle between Mix and Edit window (Cmd+=).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "zoom",
    description: "Zoom control.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["in", "out", "fit", "selection"] },
      },
      required: ["action"],
    },
  },
];

type ToolInput = Record<string, unknown>;

function r(result: { success: boolean; error?: string }, label: string): string {
  return result.success ? `Done: ${label}` : `FAILED: ${result.error}`;
}

function sfr(result: { ok: boolean; data?: unknown; error?: string }): string {
  if (!result.ok) return `FAILED: ${result.error}`;
  return typeof result.data === "string" ? result.data : JSON.stringify(result.data);
}

async function executeAgentTool(name: string, input: ToolInput): Promise<string> {
  try {
    switch (name) {
      // Vision
      case "look_at_protools": {
        const screenshot = await captureProToolsScreenshot();
        return analyzeScreenshot(screenshot, input.question as string);
      }

      // SoundFlow data
      case "sf_get_track_names": return sfr(await SoundFlowCommands.getTrackNames());
      case "sf_get_all_track_info": return sfr(await SoundFlowCommands.getAllTrackInfo());
      case "sf_mute_track": return sfr(await SoundFlowCommands.muteTrack(input.track_name as string, (input.value as string) || "Toggle"));
      case "sf_solo_track": return sfr(await SoundFlowCommands.soloTrack(input.track_name as string, (input.value as string) || "Toggle"));
      case "sf_nudge_volume": return sfr(await SoundFlowCommands.nudgeVolume(input.track_name as string, input.db as number));
      case "sf_get_inserts": return sfr(await SoundFlowCommands.getInserts(input.track_name as string));
      case "sf_run_script": {
        const { runSoundFlowScript } = await import("./soundflow");
        return sfr(await runSoundFlowScript(input.script as string));
      }

      // AppleScript control
      case "click_at":
        return r(input.double_click ? doubleClickAt(input.x as number, input.y as number) : clickAt(input.x as number, input.y as number),
          `${input.double_click ? "double-" : ""}click at (${input.x}, ${input.y})`);
      case "transport": {
        const codes: Record<string, [number, string[]]> = {
          play: [K.space, []], stop: [K.space, []], returnToZero: [K.return, []],
        };
        const [kc, mods] = codes[input.action as string] || [K.space, []];
        return r(proToolsKey(kc, mods), input.action as string);
      }
      case "mute_selected": return r(proToolsKey(K.m), "mute toggle");
      case "solo_selected": return r(proToolsKey(K.s), "solo toggle");
      case "nudge_volume_selected": {
        const db = input.db as number;
        const kc = db > 0 ? K.up : K.down;
        const steps = Math.round(Math.abs(db) * 10);
        for (let i = 0; i < Math.min(steps, 100); i++) {
          proToolsKey(kc, ["control down"]);
        }
        return `Done: nudged ${db}dB (${steps} steps)`;
      }
      case "clear_all_solos": return r(proToolsKey(K.s, ["option down"]), "clear all solos");
      case "clear_all_mutes": return r(proToolsKey(K.m, ["option down"]), "clear all mutes");
      case "undo": return r(proToolsKey(K.z, ["command down"]), "undo");
      case "save": return r(proToolsKey(K.s, ["command down"]), "save");
      case "toggle_mix_edit": return r(proToolsKey(K.equal, ["command down"]), "toggle mix/edit");
      case "zoom": {
        const zoomCodes: Record<string, [number, string[]]> = {
          in: [K.rightBracket, ["command down"]], out: [K.leftBracket, ["command down"]],
          fit: [K.a, ["option down"]], selection: [K.f, ["option down"]],
        };
        const [kc, mods] = zoomCodes[input.action as string] || [K.rightBracket, ["command down"]];
        return r(proToolsKey(kc, mods), `zoom ${input.action}`);
      }

      default: return `Unknown tool: ${name}`;
    }
  } catch (e: unknown) {
    return `Error: ${(e as Error).message}`;
  }
}

const SYSTEM_PROMPT = `You are an expert mix engineer AI controlling Pro Tools.

## Two Control Paths

### 1. SoundFlow (preferred when available)
Use sf_* tools to control Pro Tools by track name. These are precise and reliable:
- sf_get_track_names → real track list
- sf_get_all_track_info → mute/solo states
- sf_mute_track, sf_solo_track → control by name
- sf_nudge_volume → volume by name
- sf_get_inserts → plugin list
- sf_run_script → any SoundFlow API call

If sf_ tools return FAILED/timeout, fall back to AppleScript.

### 2. AppleScript + Vision (always works)
- look_at_protools → screenshot to see everything
- click_at → click tracks/buttons at coordinates from screenshot
- mute_selected, solo_selected → keyboard on selected track
- nudge_volume_selected → volume on selected track

### Workflow
1. Try sf_get_track_names first for track list
2. If it works, use sf_ tools for everything
3. If it fails, screenshot → identify tracks → click to select → keyboard to act

## RULES
- ALWAYS get track names first before making changes
- Use exact names (case-sensitive)
- Report failures honestly
- Max 3 screenshots per task
- Be efficient — sf_ tools are faster than screenshots`;

export async function runMixAgent(
  instruction: string,
  mode: AgentMode = "supervised",
  onStep?: (step: AgentStep) => void,
): Promise<{ steps: AgentStep[]; summary: string }> {
  const steps: AgentStep[] = [];
  const addStep = (step: AgentStep) => { steps.push(step); onStep?.(step); };

  addStep({ type: "think", content: `Processing: "${instruction}"`, timestamp: Date.now() });

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: instruction },
  ];

  let maxIterations = mode === "autonomous" ? 15 : 8;

  while (maxIterations > 0) {
    maxIterations--;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 8000 },
      system: SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "thinking") {
        addStep({ type: "think", content: block.thinking, timestamp: Date.now() });
      }
    }

    const toolUses = response.content.filter((b) => b.type === "tool_use");

    if (toolUses.length === 0) {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      addStep({ type: "result", content: text, timestamp: Date.now() });
      return { steps, summary: text };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const input = block.input as ToolInput;
        addStep({ type: "command", content: `${block.name}(${JSON.stringify(input)})`, timestamp: Date.now() });

        const result = await executeAgentTool(block.name, input);
        const isData = block.name.startsWith("sf_get") || block.name === "look_at_protools";

        addStep({
          type: isData ? "vision" : "result",
          content: result.slice(0, 800),
          timestamp: Date.now(),
        });

        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }

    messages.push(
      { role: "assistant", content: response.content },
      { role: "user", content: toolResults },
    );
  }

  return { steps, summary: "Reached max steps." };
}

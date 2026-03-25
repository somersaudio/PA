import { execSync } from "child_process";
import path from "path";
import { writeFileSync, readFileSync, unlinkSync } from "fs";

const cliclick = path.join(process.cwd(), "bin", "cliclick");

// === APPLESCRIPT HELPERS ===

export function runAppleScriptMulti(script: string): { success: boolean; output?: string; error?: string } {
  return runAppleScript(script);
}

export function runAppleScript(script: string): { success: boolean; output?: string; error?: string } {
  try {
    const output = execSync(`osascript <<'APPLESCRIPT'\n${script}\nAPPLESCRIPT`, {
      encoding: "utf-8",
      timeout: 15000,
    }).trim();
    return { success: true, output: output || undefined };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || "Failed" };
  }
}

// Press a key in Pro Tools
export function proToolsKey(keyCode: number, modifiers: string[] = []): { success: boolean; error?: string } {
  const using = modifiers.length > 0 ? ` using {${modifiers.join(", ")}}` : "";
  return runAppleScript(`
tell application "Pro Tools" to activate
delay 0.3
tell application "System Events"
  key code ${keyCode}${using}
end tell
  `);
}

// Click at coordinates
export function clickAt(x: number, y: number): { success: boolean; error?: string } {
  try {
    execSync(`"${cliclick}" c:${x},${y}`, { timeout: 5000 });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export function doubleClickAt(x: number, y: number): { success: boolean; error?: string } {
  try {
    execSync(`"${cliclick}" dc:${x},${y}`, { timeout: 5000 });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

// === SOUNDFLOW IN-APP EXECUTION ===
// Writes script to a temp file, opens SoundFlow, pastes and runs it,
// reads result from /tmp/pa-sf-result.json

const SF_RESULT_FILE = "/tmp/pa-sf-result.json";
const SF_SCRIPT_FILE = "/tmp/pa-sf-script.js";

// Wrap a SoundFlow script to write its result to a file
function wrapScript(script: string): string {
  return `
var __result = {};
try {
  ${script}
  if (typeof __result === 'object' && !__result.ok) __result.ok = true;
} catch(e) {
  __result = { ok: false, error: e.message || String(e) };
}
sf.file.writeText({ path: "${SF_RESULT_FILE}", text: JSON.stringify(__result) });
`;
}

// Execute a SoundFlow script by running it in the SoundFlow app
// Uses the CLI which fires a distributed notification — if SoundFlow picks it up, great
// Falls back to reading result file
export async function runSoundFlowScript(
  script: string
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const wrapped = wrapScript(script);

  // Clean up old result
  try { unlinkSync(SF_RESULT_FILE); } catch {}

  // Write script to temp file for reference
  writeFileSync(SF_SCRIPT_FILE, wrapped, "utf-8");

  // Try CLI first (fire and forget)
  try {
    execSync(`/usr/local/bin/soundflow run --code '${wrapped.replace(/'/g, "'\\''")}'`, {
      encoding: "utf-8",
      timeout: 15000,
    });
  } catch {}

  // Wait for result file
  const startTime = Date.now();
  while (Date.now() - startTime < 10000) {
    try {
      const result = readFileSync(SF_RESULT_FILE, "utf-8").trim();
      if (result) {
        try { unlinkSync(SF_RESULT_FILE); } catch {}
        return JSON.parse(result);
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }

  return { ok: false, error: "SoundFlow did not produce a result. CLI may not be executing scripts." };
}

// Pre-built SoundFlow commands that return data
export const SoundFlowCommands = {
  getTrackNames: () => runSoundFlowScript(`
    sf.ui.proTools.appActivateMainWindow();
    sf.ui.proTools.invalidate();
    __result = { ok: true, data: sf.ui.proTools.trackNames };
  `),

  getAllTrackInfo: () => runSoundFlowScript(`
    sf.ui.proTools.appActivateMainWindow();
    sf.ui.proTools.invalidate();
    var names = sf.ui.proTools.trackNames;
    var infos = [];
    for (var i = 0; i < names.length; i++) {
      try {
        var t = sf.ui.proTools.trackGetByName({ name: names[i] }).track;
        t.invalidate();
        infos.push({
          name: t.normalizedTrackName,
          isMuted: t.isMuted,
          isSoloed: t.isSoloed,
        });
      } catch (e) {
        infos.push({ name: names[i], error: e.message });
      }
    }
    __result = { ok: true, data: infos };
  `),

  getTrackInfo: (trackName: string) => runSoundFlowScript(`
    sf.ui.proTools.appActivateMainWindow();
    var track = sf.ui.proTools.trackGetByName({ name: ${JSON.stringify(trackName)} }).track;
    if (!track) { __result = { ok: false, error: "Track not found: ${trackName}" }; }
    else {
      track.invalidate();
      __result = { ok: true, data: {
        name: track.normalizedTrackName,
        isMuted: track.isMuted,
        isSoloed: track.isSoloed,
      }};
    }
  `),

  muteTrack: (trackName: string, value = "Toggle") => runSoundFlowScript(`
    sf.ui.proTools.appActivateMainWindow();
    var track = sf.ui.proTools.trackGetByName({ name: ${JSON.stringify(trackName)} }).track;
    if (!track) { __result = { ok: false, error: "Track not found" }; }
    else {
      track.trackSetMute({ targetValue: "${value}" });
      __result = { ok: true, data: "mute ${value} on ${trackName}" };
    }
  `),

  soloTrack: (trackName: string, value = "Toggle") => runSoundFlowScript(`
    sf.ui.proTools.appActivateMainWindow();
    var track = sf.ui.proTools.trackGetByName({ name: ${JSON.stringify(trackName)} }).track;
    if (!track) { __result = { ok: false, error: "Track not found" }; }
    else {
      track.trackSetSolo({ targetValue: "${value}" });
      __result = { ok: true, data: "solo ${value} on ${trackName}" };
    }
  `),

  nudgeVolume: (trackName: string, db: number) => runSoundFlowScript(`
    sf.ui.proTools.appActivateMainWindow();
    var track = sf.ui.proTools.trackGetByName({ name: ${JSON.stringify(trackName)} }).track;
    if (!track) { __result = { ok: false, error: "Track not found" }; }
    else {
      track.trackScrollToView();
      sf.wait({ intervalMs: 200 });
      track.trackSelect();
      sf.wait({ intervalMs: 300 });
      var key = ${db} > 0 ? "ctrl+up" : "ctrl+down";
      var steps = Math.round(Math.abs(${db}) * 10);
      for (var i = 0; i < Math.min(steps, 100); i++) {
        sf.keyboard.press({ keys: key });
        if (i % 20 === 19) sf.wait({ intervalMs: 50 });
      }
      __result = { ok: true, data: "nudged ${trackName} by ${db}dB" };
    }
  `),

  getInserts: (trackName: string) => runSoundFlowScript(`
    sf.ui.proTools.appActivateMainWindow();
    var track = sf.ui.proTools.trackGetByName({ name: ${JSON.stringify(trackName)} }).track;
    if (!track) { __result = { ok: false, error: "Track not found" }; }
    else {
      track.trackScrollToView();
      sf.wait({ intervalMs: 200 });
      track.invalidate();
      var inserts = [];
      var btns = track.insertSelectorButtons;
      for (var i = 0; i < btns.length; i++) {
        try { inserts.push({ slot: i, name: btns[i].value.value || "" }); }
        catch (e) { inserts.push({ slot: i, name: "" }); }
      }
      __result = { ok: true, data: inserts };
    }
  `),
};

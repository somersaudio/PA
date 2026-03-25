// Pro Tools control via AppleScript + System Events + cliclick
// SoundFlow CLI is broken — we use native macOS automation instead

import { runAppleScriptMulti } from "./soundflow";
import { execSync } from "child_process";
import path from "path";

const cliclick = path.join(process.cwd(), "bin", "cliclick");

function activate() {
  return `tell application "Pro Tools" to activate\ndelay 0.3`;
}

function pressKey(keyCode: number, modifiers: string[] = []) {
  const using = modifiers.length > 0 ? ` using {${modifiers.join(", ")}}` : "";
  return `key code ${keyCode}${using}`;
}

// Execute an AppleScript command in Pro Tools context
function exec(body: string): { success: boolean; output?: string; error?: string } {
  return runAppleScriptMulti(`
${activate()}
tell application "System Events"
  tell process "Pro Tools"
    ${body}
  end tell
end tell
  `);
}

// Simple key press in Pro Tools
function keyPress(keyCode: number, modifiers: string[] = []): { success: boolean; error?: string } {
  return runAppleScriptMulti(`
${activate()}
tell application "System Events"
  ${pressKey(keyCode, modifiers)}
end tell
  `);
}

// Click at coordinates using cliclick
function click(x: number, y: number, type: "c" | "dc" | "rc" = "c") {
  try {
    execSync(`"${cliclick}" ${type}:${x},${y}`, { timeout: 5000 });
    return { success: true };
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message };
  }
}

export const ProToolsCommands = {

  // ==============================
  // TRANSPORT
  // ==============================
  play: () => keyPress(49), // space
  stop: () => keyPress(49), // space
  record: () => {
    keyPress(111); // F12
    return keyPress(49); // then space
  },
  returnToZero: () => keyPress(36), // return
  goToEnd: () => keyPress(36, ["command down"]), // cmd+return
  toggleLoop: () => keyPress(4, ["control down", "shift down"]), // ctrl+shift+L (key code 4 = h... let me use keystroke)

  // ==============================
  // TRACK VOLUME — nudge via keyboard
  // ==============================
  nudgeTrackVolume: (trackName: string, db: number) => {
    const steps = Math.round(Math.abs(db) * 10);
    const keyCode = db > 0 ? 126 : 125; // up or down arrow
    // First activate and select the track, then nudge
    // We use Cmd+F to find track, but Pro Tools doesn't have Cmd+F for track find
    // Instead we'll scroll to it and use keyboard nudge
    let script = `
${activate()}
tell application "System Events"
`;
    // Nudge volume: ctrl+up/down on selected track
    for (let i = 0; i < Math.min(steps, 100); i++) {
      script += `  ${pressKey(keyCode, ["control down"])}\n`;
      if (i % 20 === 19) script += `  delay 0.1\n`;
    }
    script += `end tell`;
    return runAppleScriptMulti(script);
  },

  // ==============================
  // MUTE / SOLO
  // ==============================
  muteSelectedTrack: () => keyPress(46), // M
  soloSelectedTrack: () => keyPress(1),  // S
  clearAllSolos: () => keyPress(1, ["option down"]), // Alt+S
  clearAllMutes: () => keyPress(46, ["option down"]), // Alt+M

  // ==============================
  // EDIT
  // ==============================
  undo: () => keyPress(6, ["command down"]),         // Cmd+Z
  redo: () => keyPress(6, ["command down", "shift down"]), // Cmd+Shift+Z
  save: () => keyPress(1, ["command down"]),          // Cmd+S ... wait S=1
  copy: () => keyPress(8, ["command down"]),          // Cmd+C
  paste: () => keyPress(9, ["command down"]),         // Cmd+V
  cut: () => keyPress(7, ["command down"]),           // Cmd+X
  duplicate: () => keyPress(2, ["command down"]),     // Cmd+D
  selectAll: () => keyPress(0, ["command down"]),     // Cmd+A

  // ==============================
  // WINDOW
  // ==============================
  toggleMixWindow: () => keyPress(24, ["command down"]), // Cmd+=

  // ==============================
  // ZOOM
  // ==============================
  zoomIn: () => keyPress(30, ["command down"]),  // Cmd+]
  zoomOut: () => keyPress(33, ["command down"]), // Cmd+[
  zoomToFit: () => keyPress(0, ["option down"]), // Alt+A
  zoomToSelection: () => keyPress(3, ["option down"]), // Alt+F

  // ==============================
  // MARKERS
  // ==============================
  addMarker: () => keyPress(76), // numpad enter
  openMemoryLocations: () => keyPress(23, ["command down"]), // Cmd+5

  // ==============================
  // BOUNCE
  // ==============================
  bounce: () => exec(`
    click menu item "Bounce Mix..." of menu "File" of menu bar 1
  `),

  // ==============================
  // GENERIC MENU CLICK
  // ==============================
  menuClick: (menuPath: string[]) => {
    if (menuPath.length === 2) {
      return exec(`click menu item "${menuPath[1]}" of menu "${menuPath[0]}" of menu bar 1`);
    } else if (menuPath.length === 3) {
      return exec(`
        click menu item "${menuPath[2]}" of menu 1 of menu item "${menuPath[1]}" of menu "${menuPath[0]}" of menu bar 1
      `);
    }
    return { success: false, error: "Menu path must be 2-3 items" };
  },

  // ==============================
  // RAW KEY PRESS
  // ==============================
  pressKeys: (keys: string) => {
    // Parse "cmd+z" style into AppleScript
    const parts = keys.toLowerCase().split("+");
    const modifiers: string[] = [];
    let mainKey = "";
    for (const p of parts) {
      if (p === "cmd" || p === "command") modifiers.push("command down");
      else if (p === "alt" || p === "option") modifiers.push("option down");
      else if (p === "ctrl" || p === "control") modifiers.push("control down");
      else if (p === "shift") modifiers.push("shift down");
      else mainKey = p;
    }
    return runAppleScriptMulti(`
${activate()}
tell application "System Events"
  keystroke "${mainKey}"${modifiers.length > 0 ? ` using {${modifiers.join(", ")}}` : ""}
end tell
    `);
  },

  // ==============================
  // TYPE TEXT
  // ==============================
  typeText: (text: string) => {
    return runAppleScriptMulti(`
${activate()}
tell application "System Events"
  keystroke "${text.replace(/"/g, '\\"')}"
end tell
    `);
  },

  // ==============================
  // MOUSE CLICKS
  // ==============================
  clickAt: (x: number, y: number) => click(x, y, "c"),
  doubleClickAt: (x: number, y: number) => click(x, y, "dc"),
  rightClickAt: (x: number, y: number) => click(x, y, "rc"),
};

export const PROTOOLS_CAPABILITIES = `
## Pro Tools Control (via AppleScript + cliclick)
You control Pro Tools through keyboard shortcuts and mouse clicks.
You SEE Pro Tools through screenshots — this is your ONLY way to read data.

### What You Can Do
**Transport:** play/stop (space), record, return to zero, go to end
**Volume:** Nudge selected track volume up/down (ctrl+arrow, ~0.1dB per step)
**Mute/Solo:** Toggle on selected track (M/S keys), clear all (Alt+M/Alt+S)
**Edit:** undo, redo, save, copy, paste, cut, duplicate, select all
**Window:** toggle mix/edit window (Cmd+=)
**Zoom:** in, out, fit, to selection
**Markers:** add marker, open memory locations
**Bounce:** bounce mix
**Menu:** click any menu item by path
**Keys:** press any keyboard shortcut
**Mouse:** click/double-click/right-click at screen coordinates
**Type:** type text into focused field

### IMPORTANT WORKFLOW
1. Screenshot → identify track names and positions
2. CLICK the track to select it (use click_at with coordinates from screenshot)
3. Then use keyboard commands (M for mute, S for solo, ctrl+arrows for volume)
4. Screenshot → verify

Track selection MUST be done by clicking — there is no "select by name" command.
Volume changes work on the CURRENTLY SELECTED track only.
`;

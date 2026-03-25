// ============================================================
// CTPA ↔ SoundFlow OSC Bridge
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Open SoundFlow app
// 2. Create a new Command (+ button → New Command)
// 3. Paste this ENTIRE script into the command editor
// 4. Add an OSC Trigger:
//    - Click "Add Trigger" → OSC
//    - Port: 9456
//    - Address: /pa
// 5. Copy the Command ID (right-click → Copy Command ID)
// 6. Save
//
// The bridge receives commands on port 9456 and sends
// responses back to port 9457 on localhost.
// ============================================================

// Figure out where OSC data lives
var args = {};
try {
    // Try various ways SoundFlow might deliver OSC args
    var ea = event.arguments || {};
    var raw = ea.arg1 || ea.arg0 || ea[0] || ea.value || null;

    // If nothing in arguments, check trigger props
    if (!raw && event.trigger) {
        raw = event.trigger.arg1 || event.trigger.arg0 || event.trigger.value || null;
    }

    // If still nothing, check event.props
    if (!raw && event.props) {
        raw = event.props.arg1 || event.props.arg0 || null;
    }

    // Log what we got for debugging
    log("OSC raw: " + JSON.stringify({ ea: ea, trigger: event.trigger, raw: raw }));

    if (raw && typeof raw === "string") {
        args = JSON.parse(raw);
    }
} catch (e) {
    log("Parse error: " + e.message);
    args = {};
}
var action = args.action || "ping";
var responsePort = 9457;
var responseAddr = "/pa/response";

function sendResponse(data) {
    sf.osc.sendMessage({
        host: "127.0.0.1",
        port: responsePort,
        address: responseAddr,
        arguments: [JSON.stringify(data)],
    });
}

try {
    switch (action) {

        // === PING / TEST ===
        case "ping": {
            sendResponse({ ok: true, action: "pong" });
            break;
        }

        // === GET ALL TRACK NAMES ===
        case "getTrackNames": {
            sf.ui.proTools.appActivateMainWindow();
            sf.ui.proTools.invalidate();
            var trackNames = sf.ui.proTools.trackNames;
            sendResponse({ ok: true, action: "trackNames", data: trackNames });
            break;
        }

        // === GET TRACK INFO ===
        case "getTrackInfo": {
            var name = args.trackName;
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: name }).track;
            if (!track) {
                sendResponse({ ok: false, error: "Track not found: " + name });
                break;
            }
            track.trackScrollToView();
            sf.wait({ intervalMs: 200 });
            track.invalidate();
            sendResponse({
                ok: true,
                action: "trackInfo",
                data: {
                    name: track.normalizedTrackName,
                    isMuted: track.isMuted,
                    isSoloed: track.isSoloed,
                    isSelected: track.isSelected,
                }
            });
            break;
        }

        // === GET ALL TRACKS INFO ===
        case "getAllTrackInfo": {
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
                        isSelected: t.isSelected,
                    });
                } catch (e) {
                    infos.push({ name: names[i], error: e.message });
                }
            }
            sendResponse({ ok: true, action: "allTrackInfo", data: infos });
            break;
        }

        // === SELECT TRACK ===
        case "selectTrack": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackSelect();
            sendResponse({ ok: true, action: "selected", data: args.trackName });
            break;
        }

        // === MUTE TRACK ===
        case "muteTrack": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            var target = args.value || "Toggle"; // "Enable", "Disable", "Toggle"
            track.trackSetMute({ targetValue: target });
            sendResponse({ ok: true, action: "muted", data: { track: args.trackName, value: target } });
            break;
        }

        // === SOLO TRACK ===
        case "soloTrack": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            var target = args.value || "Toggle";
            track.trackSetSolo({ targetValue: target });
            sendResponse({ ok: true, action: "soloed", data: { track: args.trackName, value: target } });
            break;
        }

        // === CLEAR ALL SOLOS ===
        case "clearAllSolos": {
            sf.ui.proTools.appActivateMainWindow();
            sf.keyboard.press({ keys: "alt+s" });
            sendResponse({ ok: true, action: "clearedSolos" });
            break;
        }

        // === CLEAR ALL MUTES ===
        case "clearAllMutes": {
            sf.ui.proTools.appActivateMainWindow();
            sf.keyboard.press({ keys: "alt+m" });
            sendResponse({ ok: true, action: "clearedMutes" });
            break;
        }

        // === SET TRACK VOLUME (absolute dB via output window) ===
        case "setVolume": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackScrollToView();
            sf.wait({ intervalMs: 200 });
            track.trackSelect();
            sf.wait({ intervalMs: 200 });
            // Open output window, type value
            track.trackOutputWindowOpen();
            sf.wait({ intervalMs: 500 });
            var outputWin = sf.ui.proTools.windows.whoseTitle.startsWith("Output").first;
            var volField = outputWin.textFields.whoseTitle.is("Volume Numerical").first;
            volField.mouseClickElement();
            sf.wait({ intervalMs: 100 });
            sf.keyboard.press({ keys: "cmd+a" });
            sf.keyboard.type({ text: String(args.db) });
            sf.keyboard.press({ keys: "return" });
            sf.wait({ intervalMs: 200 });
            outputWin.windowClose();
            sendResponse({ ok: true, action: "volumeSet", data: { track: args.trackName, db: args.db } });
            break;
        }

        // === NUDGE VOLUME (relative dB via keyboard) ===
        case "nudgeVolume": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackScrollToView();
            sf.wait({ intervalMs: 200 });
            track.trackSelect();
            sf.wait({ intervalMs: 300 });
            var db = Number(args.db);
            var key = db > 0 ? "ctrl+up" : "ctrl+down";
            var steps = Math.round(Math.abs(db) * 10);
            for (var i = 0; i < Math.min(steps, 100); i++) {
                sf.keyboard.press({ keys: key });
                if (i % 20 === 19) sf.wait({ intervalMs: 50 });
            }
            sendResponse({ ok: true, action: "volumeNudged", data: { track: args.trackName, db: db } });
            break;
        }

        // === RESET VOLUME TO UNITY ===
        case "resetVolume": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackScrollToView();
            sf.wait({ intervalMs: 200 });
            var volSlider = track.groups.whoseTitle.is("Audio IO").first.sliders.whoseTitle.is("Volume").first;
            volSlider.mouseClickElement({ isOption: true });
            sendResponse({ ok: true, action: "volumeReset", data: args.trackName });
            break;
        }

        // === RESET PAN ===
        case "resetPan": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackScrollToView();
            sf.wait({ intervalMs: 200 });
            var panKnob = track.groups.whoseTitle.is("Audio IO").first.sliders.whoseTitle.is("Pan").first;
            panKnob.mouseClickElement({ isOption: true });
            sendResponse({ ok: true, action: "panReset", data: args.trackName });
            break;
        }

        // === BYPASS INSERT ===
        case "bypassInsert": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackScrollToView();
            sf.wait({ intervalMs: 200 });
            track.insertSelectorButtons[Number(args.slot)].mouseClickElement({ isCommand: true });
            sendResponse({ ok: true, action: "insertBypassed", data: { track: args.trackName, slot: args.slot } });
            break;
        }

        // === GET INSERTS ===
        case "getInserts": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackScrollToView();
            sf.wait({ intervalMs: 200 });
            track.invalidate();
            var inserts = [];
            var btns = track.insertSelectorButtons;
            for (var i = 0; i < btns.length; i++) {
                try { inserts.push({ slot: i, name: btns[i].value.value || "" }); }
                catch (e) { inserts.push({ slot: i, name: "" }); }
            }
            sendResponse({ ok: true, action: "inserts", data: { track: args.trackName, inserts: inserts } });
            break;
        }

        // === SET AUTOMATION MODE ===
        case "setAutomation": {
            sf.ui.proTools.appActivateMainWindow();
            sf.ui.proTools.automationModeSet({
                automationModeName: args.mode,
                trackTargetMode: "SelectedTracks",
            });
            sendResponse({ ok: true, action: "automationSet", data: args.mode });
            break;
        }

        // === TRANSPORT ===
        case "transport": {
            sf.ui.proTools.appActivateMainWindow();
            switch (args.command) {
                case "play": sf.ui.proTools.transport.play(); break;
                case "stop": sf.ui.proTools.transport.stop(); break;
                case "record": sf.ui.proTools.transport.record(); break;
                case "returnToZero": sf.ui.proTools.transport.returnToStart(); break;
                default: sendResponse({ ok: false, error: "Unknown transport: " + args.command }); return;
            }
            sendResponse({ ok: true, action: "transport", data: args.command });
            break;
        }

        // === RENAME TRACK ===
        case "renameTrack": {
            sf.ui.proTools.appActivateMainWindow();
            var track = sf.ui.proTools.trackGetByName({ name: args.trackName }).track;
            if (!track) { sendResponse({ ok: false, error: "Track not found" }); break; }
            track.trackSelect();
            sf.wait({ intervalMs: 200 });
            track.titleButton.mouseDoubleClickElement();
            sf.wait({ intervalMs: 300 });
            sf.keyboard.press({ keys: "cmd+a" });
            sf.keyboard.type({ text: args.newName });
            sf.keyboard.press({ keys: "return" });
            sendResponse({ ok: true, action: "renamed", data: { from: args.trackName, to: args.newName } });
            break;
        }

        // === MENU CLICK ===
        case "menuClick": {
            sf.ui.proTools.appActivateMainWindow();
            sf.ui.proTools.menuClick({ menuPath: JSON.parse(args.menuPath) });
            sendResponse({ ok: true, action: "menuClicked", data: args.menuPath });
            break;
        }

        // === KEYBOARD SHORTCUT ===
        case "pressKeys": {
            sf.ui.proTools.appActivateMainWindow();
            sf.keyboard.press({ keys: args.keys });
            sendResponse({ ok: true, action: "keysPressed", data: args.keys });
            break;
        }

        // === RAW SCRIPT ===
        case "rawScript": {
            eval(args.code);
            sendResponse({ ok: true, action: "rawExecuted" });
            break;
        }

        // === SAVE ===
        case "save": {
            sf.ui.proTools.appActivateMainWindow();
            sf.keyboard.press({ keys: "cmd+s" });
            sendResponse({ ok: true, action: "saved" });
            break;
        }

        // === UNDO ===
        case "undo": {
            sf.ui.proTools.appActivateMainWindow();
            sf.keyboard.press({ keys: "cmd+z" });
            sendResponse({ ok: true, action: "undone" });
            break;
        }

        // === REDO ===
        case "redo": {
            sf.ui.proTools.appActivateMainWindow();
            sf.keyboard.press({ keys: "cmd+shift+z" });
            sendResponse({ ok: true, action: "redone" });
            break;
        }

        // === SESSION NAME ===
        case "getSessionName": {
            sf.ui.proTools.appActivateMainWindow();
            var title = sf.ui.proTools.mainWindow.title.value;
            sendResponse({ ok: true, action: "sessionName", data: title });
            break;
        }

        default: {
            sendResponse({ ok: false, error: "Unknown action: " + action });
        }
    }
} catch (e) {
    sendResponse({ ok: false, error: e.message || String(e) });
}

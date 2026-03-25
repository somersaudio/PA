/**
 * CTPA Bridge Script for SoundFlow
 *
 * This is the main dispatcher that receives commands from CTPA
 * and routes them to the appropriate action.
 *
 * Import this script into SoundFlow, then trigger it via CLI:
 *   soundflow run user:pa-bridge '{"action":"adjustVolume","trackName":"Lead Vox","value":"+2"}'
 */

const args = event.props;

function main() {
    if (!args || !args.action) {
        throw new Error("No action specified. Pass {action, trackName, ...} as arguments.");
    }

    sf.ui.proTools.appActivateMainWindow();
    sf.ui.proTools.mainWindow.invalidate();

    switch (args.action) {
        case "adjustVolume":
        case "setVolume":
            setTrackVolume(args.trackName, args.value);
            break;
        case "mute":
            toggleTrackMute(args.trackName, true);
            break;
        case "unmute":
            toggleTrackMute(args.trackName, false);
            break;
        case "solo":
            toggleTrackSolo(args.trackName, true);
            break;
        case "unsolo":
            toggleTrackSolo(args.trackName, false);
            break;
        case "setPan":
            setTrackPan(args.trackName, args.value);
            break;
        case "setSendLevel":
            setTrackSendLevel(args.trackName, args.send, args.value);
            break;
        default:
            throw new Error("Unknown action: " + args.action);
    }

    log("CTPA: " + args.action + " completed for track '" + args.trackName + "'");
}

function selectTrack(trackName) {
    sf.ui.proTools.trackSelectByName({ names: [trackName] });
    sf.wait({ intervalMs: 100 });
}

function setTrackVolume(trackName, value) {
    selectTrack(trackName);

    // Open the Mix window to access faders
    sf.ui.proTools.menuClick({ menuPath: ["Window", "Mix"] });
    sf.wait({ intervalMs: 200 });

    var track = sf.ui.proTools.trackGetByName({ name: trackName });
    var volumeField = track.textFields.whoseTitle.is("Volume").first;

    if (value.indexOf("+") === 0 || value.indexOf("-") === 0) {
        // Relative adjustment
        var current = parseFloat(volumeField.value.value);
        var adjustment = parseFloat(value);
        var newValue = current + adjustment;
        volumeField.elementClick();
        sf.keyboard.type({ text: String(newValue) });
        sf.keyboard.press({ keys: "return" });
    } else {
        // Absolute value
        volumeField.elementClick();
        sf.keyboard.type({ text: String(value) });
        sf.keyboard.press({ keys: "return" });
    }
}

function toggleTrackMute(trackName, shouldMute) {
    selectTrack(trackName);
    var track = sf.ui.proTools.trackGetByName({ name: trackName });
    var muteBtn = track.buttons.whoseTitle.is("Mute").first;
    var isMuted = muteBtn.value.value === "on";

    if (shouldMute !== isMuted) {
        muteBtn.elementClick();
    }
}

function toggleTrackSolo(trackName, shouldSolo) {
    selectTrack(trackName);
    var track = sf.ui.proTools.trackGetByName({ name: trackName });
    var soloBtn = track.buttons.whoseTitle.is("Solo").first;
    var isSoloed = soloBtn.value.value === "on";

    if (shouldSolo !== isSoloed) {
        soloBtn.elementClick();
    }
}

function setTrackPan(trackName, value) {
    selectTrack(trackName);
    var track = sf.ui.proTools.trackGetByName({ name: trackName });
    var panField = track.textFields.whoseTitle.is("Pan").first;

    panField.elementClick();
    sf.keyboard.type({ text: String(value) });
    sf.keyboard.press({ keys: "return" });
}

function setTrackSendLevel(trackName, sendSlot, value) {
    selectTrack(trackName);
    var track = sf.ui.proTools.trackGetByName({ name: trackName });

    // Click on the send slot to open it
    var sendBtn = track.buttons.whoseTitle.contains("Send " + (sendSlot || "A")).first;
    sendBtn.elementClick();
    sf.wait({ intervalMs: 200 });

    var sendLevelField = sf.ui.proTools.windows.whoseTitle.contains("Send").first
        .textFields.whoseTitle.is("Send Level").first;
    sendLevelField.elementClick();
    sf.keyboard.type({ text: String(value) });
    sf.keyboard.press({ keys: "return" });
}

main();

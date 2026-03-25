import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function callClaude(systemPrompt: string, userMessage: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}

export const MIX_NOTE_SYSTEM_PROMPT = `You are a mix engineer assistant that translates natural language mix notes into structured SoundFlow commands for Pro Tools.

Given a mix note, output a JSON object with this exact structure:
{
  "commands": [
    {
      "action": "adjustVolume" | "setVolume" | "mute" | "unmute" | "solo" | "unsolo" | "setPan" | "setSendLevel" | "insertPlugin",
      "trackName": "the track name as referenced",
      "parameter": "volume" | "pan" | "send_A" | "send_B" | etc.,
      "value": "+2dB" | "-3dB" | "L25" | "R50" | etc.,
      "description": "human-readable description of what this does"
    }
  ],
  "soundflowScript": "// Complete runnable SoundFlow JavaScript code\\nsf.ui.proTools.appActivateMainWindow();\\n..."
}

Rules:
- "turn up" / "boost" / "more" = adjustVolume with positive dB
- "turn down" / "cut" / "less" = adjustVolume with negative dB
- "set to" / "at" = setVolume with absolute dB
- Track names should be preserved exactly as the user wrote them
- The soundflowScript must use SoundFlow's sf.ui.proTools API
- Common SoundFlow patterns:
  - sf.ui.proTools.appActivateMainWindow()
  - sf.ui.proTools.trackGetByName({ name: 'TrackName' })
  - sf.ui.proTools.selectedTrack.trackScrollToView()
  - Volume/pan changes use the Mix window fader controls
- Always wrap scripts in try/catch for error handling
- Output ONLY the JSON object, no markdown, no explanation`;

export const FOLLOWUP_SYSTEM_PROMPT = `You are a music industry professional helping a producer follow up on song pitches.

Given the pitch details and activity history, write a warm but professional follow-up message. Guidelines:
- Keep it brief (2-4 sentences)
- Reference the specific song title
- Be friendly, not pushy
- If there's been previous follow-up, acknowledge the time that's passed
- Suggest a specific next step (listen, meeting, call)
- Match the tone of the music industry (casual-professional)

Output ONLY the follow-up message text, no subject line, no greeting/signature.`;

// Pro Tools screenshot capture and vision analysis
import { execSync } from "child_process";
import { readFileSync, mkdirSync, statSync, unlinkSync } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const screenshotDir = path.join(process.cwd(), "data", "screenshots");
const MAX_IMAGE_BYTES = 4_800_000; // stay under 5MB limit

// Compress a PNG using sips (built into macOS) — always convert to JPEG and scale to fit under limit
function compressScreenshot(filepath: string): string {
  const jpgPath = filepath.replace(/\.png$/, ".jpg");

  // Always convert to JPEG at quality 60, scaled to 1920px max dimension
  execSync(`sips -s format jpeg -s formatOptions 60 -Z 1920 "${filepath}" --out "${jpgPath}"`, { encoding: "utf-8" });
  try { unlinkSync(filepath); } catch {}

  // If still too large, keep reducing
  let jpgSize = statSync(jpgPath).size;
  if (jpgSize > MAX_IMAGE_BYTES) {
    execSync(`sips -s format jpeg -s formatOptions 40 -Z 1440 "${jpgPath}" --out "${jpgPath}"`, { encoding: "utf-8" });
    jpgSize = statSync(jpgPath).size;
  }
  if (jpgSize > MAX_IMAGE_BYTES) {
    execSync(`sips -s format jpeg -s formatOptions 30 -Z 1080 "${jpgPath}" --out "${jpgPath}"`, { encoding: "utf-8" });
  }

  return jpgPath;
}

// Capture a screenshot of Pro Tools window
export async function captureProToolsScreenshot(): Promise<string> {
  mkdirSync(screenshotDir, { recursive: true });
  const filename = `protools-${Date.now()}.png`;
  const filepath = path.join(screenshotDir, filename);

  // Bring Pro Tools to front and screenshot
  try {
    execSync(`osascript -e 'tell application "Pro Tools" to activate'`, { encoding: "utf-8" });
    execSync("sleep 0.8");
  } catch {}
  execSync(`screencapture -x "${filepath}"`, { encoding: "utf-8" });

  return compressScreenshot(filepath);
}

// Capture a specific region of the screen (for focused analysis)
export async function captureRegion(x: number, y: number, w: number, h: number): Promise<string> {
  mkdirSync(screenshotDir, { recursive: true });
  const filename = `region-${Date.now()}.png`;
  const filepath = path.join(screenshotDir, filename);

  execSync(`screencapture -x -R${x},${y},${w},${h} "${filepath}"`, { encoding: "utf-8" });
  return compressScreenshot(filepath);
}

// Send screenshot to Claude Vision for analysis
export async function analyzeScreenshot(
  screenshotPath: string,
  prompt: string
): Promise<string> {
  const client = new Anthropic();
  const imageData = readFileSync(screenshotPath).toString("base64");
  const mediaType = screenshotPath.endsWith(".jpg") || screenshotPath.endsWith(".jpeg") ? "image/jpeg" : "image/png";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: imageData,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
}

// High-level: capture and analyze Pro Tools in one call
export async function readProToolsState(question?: string): Promise<string> {
  const screenshot = await captureProToolsScreenshot();
  const prompt = question || `Analyze this Pro Tools session screenshot. Report:
1. Session name (from title bar)
2. All visible track names, their types (audio, aux, master, etc.)
3. Approximate fader positions / volume levels
4. Any soloed or muted tracks (look for S/M buttons lit up)
5. Any visible plugin windows and their settings
6. The current playback position / timeline location
7. Any visible meter readings
8. The mix window vs edit window state

Be precise — this data will be used to make mixing decisions.`;

  return analyzeScreenshot(screenshot, prompt);
}

// Focused analysis: look at a specific track
export async function analyzeTrack(trackName: string): Promise<string> {
  const screenshot = await captureProToolsScreenshot();
  return analyzeScreenshot(
    screenshot,
    `Focus on the track named "${trackName}" in this Pro Tools session. Report:
- Current volume fader position (estimate in dB)
- Pan position
- Mute/Solo state
- Any visible inserts/plugins
- Meter reading
- Any automation visible
Be specific and precise.`
  );
}

// Verify a command was executed correctly
export async function verifyCommand(
  description: string,
  expectedResult: string
): Promise<{ success: boolean; observation: string }> {
  const screenshot = await captureProToolsScreenshot();
  const analysis = await analyzeScreenshot(
    screenshot,
    `I just executed this command in Pro Tools: "${description}"
The expected result was: "${expectedResult}"

Look at the current state and tell me:
1. Did the command execute successfully? (yes/no)
2. What do you actually see?
3. Any discrepancies between expected and actual?

Return your answer as JSON: {"success": true/false, "observation": "what you see"}`
  );

  try {
    const match = analysis.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch {}

  return { success: false, observation: analysis };
}

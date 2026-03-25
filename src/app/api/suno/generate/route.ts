import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const scriptPath = path.join(process.cwd(), "scripts", "suno-generate.applescript");
const generatedPath = path.join(process.cwd(), "downloads", "generated-titles.json");

function saveGeneratedTitles(titles: string[]) {
  let existing: string[] = [];
  try {
    existing = JSON.parse(readFileSync(generatedPath, "utf-8"));
  } catch {}
  const all = [...new Set([...existing, ...titles])];
  writeFileSync(generatedPath, JSON.stringify(all, null, 2), "utf-8");
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, titles, weirdnessLevels, audioFilePath } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return NextResponse.json({ error: "titles array required" }, { status: 400 });
    }

    const safePrompt = prompt.replace(/"/g, '\\"');
    const safeAudioPath = audioFilePath ? audioFilePath.replace(/"/g, '\\"') : "";

    // Build args: prompt, audioPath, then pairs of (title, weirdness)
    const args = [safePrompt, safeAudioPath];
    for (let i = 0; i < titles.length; i++) {
      args.push(titles[i].replace(/"/g, '\\"'));
      args.push(String(weirdnessLevels?.[i] ?? 55));
    }

    const argStr = args.map((a) => `"${a}"`).join(" ");

    const result = execSync(
      `osascript "${scriptPath}" ${argStr}`,
      { timeout: 600000, encoding: "utf-8" }
    ).trim();

    if (result === "OK") {
      saveGeneratedTitles(titles);
      return NextResponse.json({
        success: true,
        message: `${titles.length} songs submitted to Suno.`,
      });
    } else if (result === "LOGIN_TIMEOUT") {
      return NextResponse.json(
        { error: "Login timed out. Please log into Suno in Chrome and try again." },
        { status: 401 }
      );
    } else {
      return NextResponse.json(
        { error: `Could not complete: ${result}` },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate on Suno";
    console.error("Suno generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

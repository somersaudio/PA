import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, readdirSync, mkdirSync } from "fs";
import path from "path";

const downloadsDir = path.join(process.cwd(), "downloads");
const generatedPath = path.join(downloadsDir, "generated-titles.json");

let cachedToken: string | null = null;
let cachedTokenTime = 0;
const TOKEN_TTL = 5 * 60 * 1000;

function getSessionToken(): string {
  if (cachedToken && Date.now() - cachedTokenTime < TOKEN_TTL) {
    return cachedToken;
  }
  const cookie = execSync(
    `osascript "${path.join(process.cwd(), "scripts", "extract-suno-cookie.applescript")}"`,
    { timeout: 15000, encoding: "utf-8" }
  ).trim();
  const match = cookie.match(
    /(?:^|;\s*)__session=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
  );
  if (!match) throw new Error("No session token found.");
  cachedToken = match[1];
  cachedTokenTime = Date.now();
  return cachedToken;
}

function getGeneratedTitles(): Set<string> {
  try {
    const titles: string[] = JSON.parse(readFileSync(generatedPath, "utf-8"));
    return new Set(titles);
  } catch {
    return new Set();
  }
}

export async function POST() {
  try {
    const token = getSessionToken();
    mkdirSync(downloadsDir, { recursive: true });

    const generatedTitles = getGeneratedTitles();
    if (generatedTitles.size === 0) {
      return NextResponse.json({
        status: "up_to_date",
        message: "No generated songs to retry.",
        downloaded: [],
      });
    }

    // Get existing downloaded filenames
    const existingFiles = new Set(readdirSync(downloadsDir).filter((f) => f.endsWith(".mp3")));

    // Fetch recent songs from Suno
    const feedRes = await fetch(
      "https://studio-api-prod.suno.com/api/feed/v3?page=0&page_size=50",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
        },
        body: JSON.stringify({}),
      }
    );

    if (feedRes.status === 429) {
      return NextResponse.json(
        { error: "Rate limited by Suno. Try again in a minute." },
        { status: 429 }
      );
    }
    if (!feedRes.ok) {
      throw new Error(`Feed API failed: ${feedRes.status}`);
    }

    const feedData = await feedRes.json();
    const allClips = feedData.clips || [];

    // Only look at clips whose titles we generated AND aren't already downloaded
    const missing = allClips.filter((clip: { status: string; title: string; id: string; audio_url: string | null }) => {
      if (clip.status !== "complete" || !clip.audio_url) return false;
      if (!generatedTitles.has(clip.title)) return false;
      const safeTitle = (clip.title || clip.id).replace(/[^a-zA-Z0-9_ #-]/g, "");
      const filename = `${safeTitle} (${clip.id.slice(0, 8)}).mp3`;
      return !existingFiles.has(filename);
    });

    if (missing.length === 0) {
      return NextResponse.json({
        status: "up_to_date",
        message: "All generated songs are already downloaded.",
        downloaded: [],
      });
    }

    const downloaded: Array<{ title: string; path: string }> = [];

    for (const clip of missing) {
      const safeTitle = (clip.title || clip.id).replace(/[^a-zA-Z0-9_ #-]/g, "");
      const filename = `${safeTitle} (${clip.id.slice(0, 8)}).mp3`;
      const filepath = path.join(downloadsDir, filename);

      try {
        const audioRes = await fetch(clip.audio_url);
        if (!audioRes.ok) continue;
        const buffer = Buffer.from(await audioRes.arrayBuffer());
        writeFileSync(filepath, buffer);
        downloaded.push({ title: clip.title, path: filepath });
      } catch {
        continue;
      }
    }

    return NextResponse.json({
      status: "downloaded",
      message: `${downloaded.length} missing song(s) downloaded.`,
      downloaded,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Retry failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

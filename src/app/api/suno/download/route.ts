import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from "fs";
import path from "path";
import { copyToDropbox } from "@/lib/dropbox-sync";

const downloadsDir = path.join(process.cwd(), "downloads");

// Cache the token for 5 minutes to avoid hammering Chrome/Suno
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
  if (!match) throw new Error("No session token found. Make sure you're logged into Suno in Chrome.");

  cachedToken = match[1];
  cachedTokenTime = Date.now();
  return cachedToken;
}

export async function POST(req: NextRequest) {
  try {
    const { title, titles, weirdnessMap } = await req.json();
    const titleList: string[] = titles || (title ? [title] : []);
    if (titleList.length === 0) {
      return NextResponse.json({ error: "title or titles required" }, { status: 400 });
    }

    const token = getSessionToken();

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
      return NextResponse.json({
        status: "generating",
        message: "Rate limited by Suno, will retry...",
      });
    }

    if (!feedRes.ok) {
      throw new Error(`Feed API failed: ${feedRes.status}`);
    }

    const feedData = await feedRes.json();
    const allClips = feedData.clips || [];

    // Match clips with any of our titles
    const titleSet = new Set(titleList);
    const ourClips = allClips.filter(
      (c: { title: string }) => titleSet.has(c.title)
    );

    if (ourClips.length === 0) {
      const pendingAny = allClips.filter(
        (c: { status: string }) => c.status !== "complete" && c.status !== "error"
      );
      if (pendingAny.length > 0) {
        return NextResponse.json({
          status: "generating",
          message: "Songs still generating...",
        });
      }
      return NextResponse.json({
        status: "generating",
        message: "Waiting for songs to appear...",
      });
    }

    mkdirSync(downloadsDir, { recursive: true });

    // Get already-downloaded files to skip them
    const existingFiles = new Set(
      readdirSync(downloadsDir).filter((f) => f.endsWith(".mp3"))
    );

    // Load existing metadata
    const metaPath = path.join(downloadsDir, "metadata.json");
    let metadata: Record<string, { weirdness?: number }> = {};
    try {
      metadata = JSON.parse(readFileSync(metaPath, "utf-8"));
    } catch {}

    const downloaded: Array<{ title: string; path: string }> = [];
    let stillPending = 0;

    for (const clip of ourClips) {
      if (clip.status !== "complete" || !clip.audio_url) {
        if (clip.status !== "error") stillPending++;
        continue;
      }

      const safeTitle = (clip.title || clip.id).replace(/[^a-zA-Z0-9_ #-]/g, "");
      const filename = `${safeTitle} (${clip.id.slice(0, 8)}).mp3`;

      // Skip if already downloaded
      if (existingFiles.has(filename)) {
        downloaded.push({ title: clip.title, path: path.join(downloadsDir, filename) });
        continue;
      }

      const filepath = path.join(downloadsDir, filename);
      try {
        const audioRes = await fetch(clip.audio_url);
        if (!audioRes.ok) continue;
        const buffer = Buffer.from(await audioRes.arrayBuffer());
        writeFileSync(filepath, buffer);
        downloaded.push({ title: clip.title, path: filepath });
        // Also copy to Dropbox/New
        copyToDropbox(filename);

        if (weirdnessMap && weirdnessMap[clip.title] !== undefined) {
          metadata[filename] = { weirdness: weirdnessMap[clip.title] };
        }
      } catch {
        continue;
      }
    }

    writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf-8");

    // Suno generates 2 clips per title, so we expect titleList.length * 2 total
    const expectedCount = titleList.length * 2;
    const foundTotal = ourClips.length;

    if (stillPending > 0 || foundTotal < expectedCount) {
      return NextResponse.json({
        status: "generating",
        message: `${downloaded.length} downloaded, ${stillPending > 0 ? `${stillPending} generating` : `waiting for ${expectedCount - foundTotal} more clips`}...`,
      });
    }

    return NextResponse.json({
      status: "downloaded",
      message: `${downloaded.length} song(s) downloaded to /downloads`,
      downloaded,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Download failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

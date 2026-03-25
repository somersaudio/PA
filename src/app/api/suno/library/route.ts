import { NextResponse } from "next/server";
import { readdirSync, statSync, readFileSync } from "fs";
import path from "path";

const downloadsDir = path.join(process.cwd(), "downloads");
const likesPath = path.join(downloadsDir, "likes.json");
const metaPath = path.join(downloadsDir, "metadata.json");
const playedPath = path.join(downloadsDir, "played.json");

function getLikes(): Record<string, boolean> {
  try {
    return JSON.parse(readFileSync(likesPath, "utf-8"));
  } catch {
    return {};
  }
}

function getPlayed(): Record<string, boolean> {
  try {
    return JSON.parse(readFileSync(playedPath, "utf-8"));
  } catch {
    return {};
  }
}

function getMetadata(): Record<string, { weirdness?: number }> {
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    return {};
  }
}

export async function GET() {
  try {
    const likes = getLikes();
    const metadata = getMetadata();
    const played = getPlayed();
    const files = readdirSync(downloadsDir)
      .filter((f) => f.endsWith(".mp3"))
      .map((f) => {
        const filepath = path.join(downloadsDir, f);
        const stats = statSync(filepath);
        return {
          filename: f,
          title: f.replace(/\s*\([^)]*\)\.mp3$/, "").replace(/\.mp3$/, ""),
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          liked: !!likes[f],
          weirdness: metadata[f]?.weirdness ?? null,
          played: !!played[f],
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ files });
  } catch {
    return NextResponse.json({ files: [] });
  }
}

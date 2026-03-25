import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

function getSessionToken(): string {
  const cookie = execSync(
    `osascript "${path.join(process.cwd(), "scripts", "extract-suno-cookie.applescript")}"`,
    { timeout: 15000, encoding: "utf-8" }
  ).trim();

  const match = cookie.match(
    /(?:^|;\s*)__session=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
  );
  if (!match) throw new Error("No session token found.");
  return match[1];
}

export async function POST(req: NextRequest) {
  try {
    const { playlistName } = await req.json();
    if (!playlistName) {
      return NextResponse.json({ error: "playlistName is required" }, { status: 400 });
    }

    const token = getSessionToken();

    // Fetch recent songs to check for existing titles
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

    if (!feedRes.ok) {
      return NextResponse.json({ nextNumber: 1 });
    }

    const feedData = await feedRes.json();
    const clips = feedData.clips || [];

    // Find the highest existing number for this playlist name
    let maxNumber = 0;
    const pattern = new RegExp(`^${playlistName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} #?(\\d+)[a-c]?$`);

    for (const clip of clips) {
      const match = (clip.title || "").match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }

    return NextResponse.json({ nextNumber: maxNumber + 1 });
  } catch {
    return NextResponse.json({ nextNumber: 1 });
  }
}

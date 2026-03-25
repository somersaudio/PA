import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const playedPath = path.join(process.cwd(), "downloads", "played.json");

function getPlayed(): Record<string, boolean> {
  try {
    return JSON.parse(readFileSync(playedPath, "utf-8"));
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }
    const played = getPlayed();
    played[filename] = true;
    writeFileSync(playedPath, JSON.stringify(played, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

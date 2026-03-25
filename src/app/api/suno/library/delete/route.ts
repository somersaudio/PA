import { NextRequest, NextResponse } from "next/server";
import { unlinkSync, existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { removeFromDropbox } from "@/lib/dropbox-sync";

const downloadsDir = path.join(process.cwd(), "downloads");
const likesPath = path.join(downloadsDir, "likes.json");

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    const safe = path.basename(filename);
    const filepath = path.join(downloadsDir, safe);

    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }

    // Remove from Dropbox too
    removeFromDropbox(safe);

    // Also remove from likes
    try {
      const likes = JSON.parse(readFileSync(likesPath, "utf-8"));
      delete likes[safe];
      writeFileSync(likesPath, JSON.stringify(likes, null, 2), "utf-8");
    } catch {
      // no likes file, fine
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

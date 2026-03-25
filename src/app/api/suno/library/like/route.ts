import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { getDropboxPaths } from "@/lib/dropbox-sync";

const downloadsDir = path.join(process.cwd(), "downloads");
const likesPath = path.join(downloadsDir, "likes.json");

function getLikes(): Record<string, boolean> {
  try {
    return JSON.parse(readFileSync(likesPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveLikes(likes: Record<string, boolean>) {
  writeFileSync(likesPath, JSON.stringify(likes, null, 2), "utf-8");
}

function getGroupName(filename: string): string {
  const title = filename.replace(/\s*\([^)]*\)\.mp3$/, "").replace(/\.mp3$/, "");
  const match = title.match(/^(.+?)\s*#?\d+[a-c]?$/);
  return match ? match[1].trim() : title;
}

export async function POST(req: NextRequest) {
  try {
    const { filename, liked } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    const likes = getLikes();
    const paths = getDropboxPaths();
    const groupName = getGroupName(filename);

    if (liked) {
      likes[filename] = true;

      // Copy to Dropbox/Liked in a group subfolder
      if (paths) {
        const src = path.join(downloadsDir, filename);
        const likedDir = path.join(paths.liked, groupName);
        mkdirSync(likedDir, { recursive: true });
        const dest = path.join(likedDir, filename);
        if (existsSync(src) && !existsSync(dest)) {
          copyFileSync(src, dest);
        }
      }
    } else {
      delete likes[filename];

      // Remove from Dropbox/Liked
      if (paths) {
        const likedPath = path.join(paths.liked, groupName, filename);
        if (existsSync(likedPath)) try { unlinkSync(likedPath); } catch {}
        const likedRoot = path.join(paths.liked, filename);
        if (existsSync(likedRoot)) try { unlinkSync(likedRoot); } catch {}
      }
    }

    saveLikes(likes);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { readdirSync, copyFileSync, unlinkSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const LOCAL_DOWNLOADS = path.join(process.cwd(), "downloads");
const LIKES_PATH = path.join(LOCAL_DOWNLOADS, "likes.json");
const CONFIG_PATH = path.join(process.cwd(), "data", "dropbox-config.json");

function getDropboxBase(): string | null {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    return config.folderPath || null;
  } catch {
    return null;
  }
}

export function getDropboxPaths() {
  const base = getDropboxBase();
  if (!base) return null;
  return {
    base,
    new: path.join(base, "New"),
    liked: path.join(base, "Liked"),
    rejected: path.join(base, "Rejected"),
  };
}

// Extract group name: "Drake x Rihanna 3 (abc12345).mp3" -> "Drake x Rihanna"
function getGroupName(filename: string): string {
  const title = filename.replace(/\s*\([^)]*\)\.mp3$/, "").replace(/\.mp3$/, "");
  const match = title.match(/^(.+?)\s*#?\d+[a-c]?$/);
  return match ? match[1].trim() : title;
}

export function copyToDropbox(filename: string): boolean {
  const paths = getDropboxPaths();
  if (!paths) return false;
  try {
    const src = path.join(LOCAL_DOWNLOADS, filename);
    const groupName = getGroupName(filename);
    const groupDir = path.join(paths.new, groupName);
    mkdirSync(groupDir, { recursive: true });
    const dest = path.join(groupDir, filename);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Recursively find all mp3 files in a directory (including subfolders)
function findMp3s(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        results.push(...findMp3s(path.join(dir, entry.name)));
      } else if (entry.name.endsWith(".mp3")) {
        results.push(entry.name);
      }
    }
  } catch {}
  return results;
}

export function syncFromDropbox(): { liked: string[]; rejected: string[] } {
  const paths = getDropboxPaths();
  if (!paths) return { liked: [], rejected: [] };

  return {
    liked: findMp3s(paths.liked),
    rejected: findMp3s(paths.rejected),
  };
}

export function fullSync(): { newLikes: number; newRejects: number } {
  const paths = getDropboxPaths();
  if (!paths) return { newLikes: 0, newRejects: 0 };

  const { liked: dropboxLiked, rejected: dropboxRejected } = syncFromDropbox();

  let likes: Record<string, boolean> = {};
  try {
    likes = JSON.parse(readFileSync(LIKES_PATH, "utf-8"));
  } catch {}

  let newLikes = 0;
  for (const f of dropboxLiked) {
    if (!likes[f]) {
      likes[f] = true;
      newLikes++;
    }
  }

  let newRejects = 0;
  for (const f of dropboxRejected) {
    const localPath = path.join(LOCAL_DOWNLOADS, f);
    if (existsSync(localPath)) {
      unlinkSync(localPath);
      delete likes[f];
      newRejects++;
    }
    // Remove from Dropbox/New (could be in a subfolder)
    const groupName = getGroupName(f);
    const newPath = path.join(paths.new, groupName, f);
    if (existsSync(newPath)) {
      try { unlinkSync(newPath); } catch {}
    }
    const newPathRoot = path.join(paths.new, f);
    if (existsSync(newPathRoot)) {
      try { unlinkSync(newPathRoot); } catch {}
    }
    // Delete from Rejected folder too (cleanup)
    const rejPath = path.join(paths.rejected, f);
    if (existsSync(rejPath)) {
      try { unlinkSync(rejPath); } catch {}
    }
    // Check in subfolders of Rejected
    const rejSubPath = path.join(paths.rejected, groupName, f);
    if (existsSync(rejSubPath)) {
      try { unlinkSync(rejSubPath); } catch {}
    }
  }

  writeFileSync(LIKES_PATH, JSON.stringify(likes, null, 2), "utf-8");
  return { newLikes, newRejects };
}

// When a song is deleted in-app, remove from Dropbox too
export function removeFromDropbox(filename: string) {
  const paths = getDropboxPaths();
  if (!paths) return;
  const groupName = getGroupName(filename);

  // Remove from New
  const newPath = path.join(paths.new, groupName, filename);
  if (existsSync(newPath)) try { unlinkSync(newPath); } catch {}
  const newRoot = path.join(paths.new, filename);
  if (existsSync(newRoot)) try { unlinkSync(newRoot); } catch {}

  // Remove from Liked
  const likedPath = path.join(paths.liked, filename);
  if (existsSync(likedPath)) try { unlinkSync(likedPath); } catch {}
  const likedSub = path.join(paths.liked, groupName, filename);
  if (existsSync(likedSub)) try { unlinkSync(likedSub); } catch {}
}

export function initialSync(): number {
  const paths = getDropboxPaths();
  if (!paths) return 0;
  let copied = 0;
  try {
    const files = readdirSync(LOCAL_DOWNLOADS).filter((f) => f.endsWith(".mp3"));
    for (const f of files) {
      if (copyToDropbox(f)) copied++;
    }
  } catch {}
  return copied;
}

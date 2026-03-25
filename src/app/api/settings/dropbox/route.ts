import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "data", "dropbox-config.json");

function getConfig(): { folderPath: string | null } {
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return { folderPath: null };
  }
}

export async function GET() {
  const config = getConfig();
  const connected = !!config.folderPath && existsSync(config.folderPath);
  return NextResponse.json({ ...config, connected });
}

export async function POST(req: NextRequest) {
  try {
    const { folderPath } = await req.json();
    if (!folderPath) {
      return NextResponse.json({ error: "folderPath required" }, { status: 400 });
    }

    if (!existsSync(folderPath)) {
      return NextResponse.json({ error: "Folder not found" }, { status: 400 });
    }

    // Create subfolders
    const newDir = path.join(folderPath, "New");
    const likedDir = path.join(folderPath, "Liked");
    const rejectedDir = path.join(folderPath, "Rejected");
    mkdirSync(newDir, { recursive: true });
    mkdirSync(likedDir, { recursive: true });
    mkdirSync(rejectedDir, { recursive: true });

    // Save config
    mkdirSync(path.dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify({ folderPath }, null, 2), "utf-8");

    return NextResponse.json({ success: true, message: "Dropbox folder set" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

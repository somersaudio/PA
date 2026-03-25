import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const COMMANDS_FILE = path.join(process.cwd(), "data", "soundflow-commands.json");
const CONFIG_FILE = path.join(process.cwd(), "data", "soundflow-config.json");

type SoundFlowCommand = { id: string; name: string; description: string };

function loadConfig(): { userId: string } {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  // Extract from commands if config doesn't exist
  try {
    const commands: SoundFlowCommand[] = JSON.parse(readFileSync(COMMANDS_FILE, "utf-8")).commands || [];
    for (const cmd of commands) {
      const parts = cmd.id.split(":");
      if (parts.length >= 3 && parts[0] === "user") {
        return { userId: parts[1] };
      }
    }
  } catch {}
  return { userId: "" };
}

function saveConfig(config: { userId: string }) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

// GET — return current user ID
export async function GET() {
  const config = loadConfig();
  return NextResponse.json(config);
}

// PUT — update user ID and rewrite all command IDs
export async function PUT(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const newId = userId.trim();

  // Update all commands
  try {
    const data = JSON.parse(readFileSync(COMMANDS_FILE, "utf-8"));
    const commands: SoundFlowCommand[] = data.commands || [];
    let changed = 0;
    for (const cmd of commands) {
      const parts = cmd.id.split(":");
      if (parts.length >= 3 && parts[0] === "user") {
        parts[1] = newId;
        cmd.id = parts.join(":");
        changed++;
      }
    }
    writeFileSync(COMMANDS_FILE, JSON.stringify({ commands }, null, 2), "utf-8");
    saveConfig({ userId: newId });
    return NextResponse.json({ userId: newId, changed });
  } catch {
    saveConfig({ userId: newId });
    return NextResponse.json({ userId: newId, changed: 0 });
  }
}

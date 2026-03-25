import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const COMMANDS_FILE = path.join(process.cwd(), "data", "soundflow-commands.json");

type SoundFlowCommand = {
  id: string;
  name: string;
  description: string;
};

function loadCommands(): SoundFlowCommand[] {
  if (!existsSync(COMMANDS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(COMMANDS_FILE, "utf-8")).commands || [];
  } catch {
    return [];
  }
}

function saveCommands(commands: SoundFlowCommand[]) {
  writeFileSync(COMMANDS_FILE, JSON.stringify({ commands }, null, 2), "utf-8");
}

// GET — list all commands, with optional search
export async function GET(req: NextRequest) {
  const commands = loadCommands();
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase();
  if (q) {
    const filtered = commands.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
    return NextResponse.json(filtered);
  }
  return NextResponse.json(commands);
}

// POST — add a new command
export async function POST(req: NextRequest) {
  const data = await req.json();
  const commands = loadCommands();
  const newCmd: SoundFlowCommand = {
    id: (data.id || "").trim(),
    name: (data.name || "").trim(),
    description: (data.description || "").trim(),
  };
  if (!newCmd.id || !newCmd.name) {
    return NextResponse.json({ error: "id and name required" }, { status: 400 });
  }
  commands.push(newCmd);
  saveCommands(commands);
  return NextResponse.json(newCmd);
}

// DELETE — delete by index
export async function DELETE(req: NextRequest) {
  const { index } = await req.json();
  const commands = loadCommands();
  if (index < 0 || index >= commands.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const removed = commands.splice(index, 1)[0];
  saveCommands(commands);
  return NextResponse.json(removed);
}

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

const SOUNDFLOW_CLI = "/usr/local/bin/soundflow";

// POST — run a SoundFlow command by ID
export async function POST(req: NextRequest) {
  try {
    const { commandId } = await req.json();
    if (!commandId) {
      return NextResponse.json({ error: "commandId required" }, { status: 400 });
    }

    const result = execSync(`${SOUNDFLOW_CLI} run ${commandId}`, {
      encoding: "utf-8",
      timeout: 10000,
    }).trim();

    return NextResponse.json({ ok: true, result: result || "OK" });
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string };
    return NextResponse.json({
      ok: false,
      error: err.stderr?.trim() || err.message || "Command failed",
    });
  }
}

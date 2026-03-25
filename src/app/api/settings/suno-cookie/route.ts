import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");

export async function GET() {
  const hasCookie = !!process.env.SUNO_COOKIE;
  return NextResponse.json({ configured: hasCookie });
}

export async function POST(req: NextRequest) {
  try {
    const { cookie } = await req.json();
    if (!cookie || typeof cookie !== "string") {
      return NextResponse.json({ error: "Cookie is required" }, { status: 400 });
    }

    // Read current .env.local
    let envContent = "";
    try {
      envContent = readFileSync(envPath, "utf-8");
    } catch {
      envContent = "";
    }

    // Update or add SUNO_COOKIE
    const escapedCookie = cookie.replace(/"/g, '\\"');
    if (envContent.includes("SUNO_COOKIE=")) {
      envContent = envContent.replace(
        /SUNO_COOKIE=.*/,
        `SUNO_COOKIE="${escapedCookie}"`
      );
    } else {
      envContent += `\n# Suno cookie\nSUNO_COOKIE="${escapedCookie}"\n`;
    }

    writeFileSync(envPath, envContent, "utf-8");

    // Update the runtime env so it takes effect immediately
    process.env.SUNO_COOKIE = cookie;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save cookie";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

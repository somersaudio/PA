import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");
const scriptPath = path.join(process.cwd(), "scripts", "extract-suno-cookie.applescript");

export async function POST() {
  try {
    let cookieString = "";
    try {
      cookieString = execSync(`osascript "${scriptPath}"`, {
        timeout: 30000,
        encoding: "utf-8",
      }).trim();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("JavaScript through AppleScript is turned off")) {
        throw new Error(
          "Enable JavaScript from AppleScript in Chrome: View > Developer > Allow JavaScript from Apple Events"
        );
      }
      throw new Error(
        "Could not connect to Chrome. Make sure it's open and you're on suno.com."
      );
    }

    if (!cookieString || cookieString.length < 50) {
      throw new Error(
        "Could not extract cookies. Make sure Chrome is open with suno.com."
      );
    }

    if (!cookieString.includes("__session")) {
      throw new Error(
        "Not logged into Suno. Go to suno.com in Chrome, log in, then try again."
      );
    }

    // Save to .env.local
    let envContent = "";
    try {
      envContent = readFileSync(envPath, "utf-8");
    } catch {
      envContent = "";
    }

    const escapedCookie = cookieString.replace(/"/g, '\\"');
    envContent = envContent.replace(/# Suno cookie[^\n]*\n/g, "");
    envContent = envContent.replace(/SUNO_COOKIE="[^"]*"/g, "");
    envContent = envContent.replace(/SUNO_COOKIE=[^\n]*/g, "");
    envContent = envContent.trimEnd();
    envContent += `\n\n# Suno cookie (auto-extracted)\nSUNO_COOKIE="${escapedCookie}"\n`;

    writeFileSync(envPath, envContent, "utf-8");
    process.env.SUNO_COOKIE = cookieString;

    return NextResponse.json({
      success: true,
      message: "Suno connected via Chrome.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to extract cookie";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

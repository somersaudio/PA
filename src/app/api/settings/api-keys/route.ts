import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env.local");

function getEnv(): Record<string, string> {
  try {
    const content = readFileSync(envPath, "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

export async function GET() {
  const env = getEnv();
  return NextResponse.json({
    anthropic: !!env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY !== "your-api-key-here",
    openai: !!env.OPENAI_API_KEY,
    gemini: !!env.GEMINI_API_KEY,
    spotify: !!env.SPOTIFY_CLIENT_ID && !!env.SPOTIFY_CLIENT_SECRET,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { provider, key, clientId, clientSecret } = await req.json();

    // Spotify uses two keys
    if (provider === "spotify") {
      if (!clientId || !clientSecret) {
        return NextResponse.json({ error: "clientId and clientSecret required" }, { status: 400 });
      }
      let content = "";
      try { content = readFileSync(envPath, "utf-8"); } catch {}

      for (const [envVar, val] of [["SPOTIFY_CLIENT_ID", clientId], ["SPOTIFY_CLIENT_SECRET", clientSecret]]) {
        const regex = new RegExp(`^${envVar}=.*$`, "m");
        if (regex.test(content)) {
          content = content.replace(regex, `${envVar}=${val}`);
        } else {
          content = content.trimEnd() + `\n${envVar}=${val}\n`;
        }
        process.env[envVar] = val;
      }

      writeFileSync(envPath, content, "utf-8");
      return NextResponse.json({ success: true });
    }

    if (!provider || !key) {
      return NextResponse.json({ error: "provider and key required" }, { status: 400 });
    }

    const envMap: Record<string, string> = {
      anthropic: "ANTHROPIC_API_KEY",
      openai: "OPENAI_API_KEY",
      gemini: "GEMINI_API_KEY",
    };

    const envVar = envMap[provider];
    if (!envVar) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    let content = "";
    try {
      content = readFileSync(envPath, "utf-8");
    } catch {
      content = "";
    }

    // Update or add the key
    const regex = new RegExp(`^${envVar}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${envVar}=${key}`);
    } else {
      content = content.trimEnd() + `\n${envVar}=${key}\n`;
    }

    writeFileSync(envPath, content, "utf-8");

    // Update runtime env
    process.env[envVar] = key;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

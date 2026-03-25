import { NextRequest, NextResponse } from "next/server";
import { getSunoSongStatus } from "@/lib/suno-api";

export async function POST(req: NextRequest) {
  try {
    const { cookie, clipIds } = await req.json();
    const sunoCookie = cookie || process.env.SUNO_COOKIE;
    if (!sunoCookie || !clipIds || !Array.isArray(clipIds)) {
      return NextResponse.json({ error: "cookie and clipIds are required" }, { status: 400 });
    }

    const clips = await getSunoSongStatus(sunoCookie, clipIds);
    return NextResponse.json({ clips });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

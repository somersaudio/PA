import { NextRequest, NextResponse } from "next/server";
import { getSunoCredits } from "@/lib/suno-api";

export async function POST(req: NextRequest) {
  try {
    const { cookie } = await req.json();
    const sunoCookie = cookie || process.env.SUNO_COOKIE;
    if (!sunoCookie) {
      return NextResponse.json({ error: "Suno cookie is required" }, { status: 400 });
    }

    const credits = await getSunoCredits(sunoCookie);
    return NextResponse.json(credits);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get credits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

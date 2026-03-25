import { NextRequest, NextResponse } from "next/server";
import { callClaude, MIX_NOTE_SYSTEM_PROMPT } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();
    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const result = await callClaude(MIX_NOTE_SYSTEM_PROMPT, rawText);

    // Parse Claude's JSON response
    const parsed = JSON.parse(result);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Mix note parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse mix note" },
      { status: 500 }
    );
  }
}

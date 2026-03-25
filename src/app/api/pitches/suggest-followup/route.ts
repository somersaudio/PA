import { NextRequest, NextResponse } from "next/server";
import { callClaude, FOLLOWUP_SYSTEM_PROMPT } from "@/lib/claude";
import { db } from "@/db";
import { pitches, pitchActivities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { pitchId } = await req.json();
    if (!pitchId) {
      return NextResponse.json({ error: "pitchId is required" }, { status: 400 });
    }

    const pitch = db.select().from(pitches).where(eq(pitches.id, pitchId)).get();
    if (!pitch) {
      return NextResponse.json({ error: "Pitch not found" }, { status: 404 });
    }

    const activities = db
      .select()
      .from(pitchActivities)
      .where(eq(pitchActivities.pitchId, pitchId))
      .orderBy(desc(pitchActivities.createdAt))
      .all();

    const context = `Song: "${pitch.songTitle}"
Recipient: ${pitch.recipientName}${pitch.recipientCompany ? ` at ${pitch.recipientCompany}` : ""}
Current Status: ${pitch.status}
Date Sent: ${pitch.dateSent || "Not yet sent"}
Notes: ${pitch.notes || "None"}

Activity History:
${activities.length > 0
  ? activities.map((a) => `- [${a.type}] ${a.content} (${a.createdAt})`).join("\n")
  : "No previous activity"}`;

    const suggestion = await callClaude(FOLLOWUP_SYSTEM_PROMPT, context);
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("Follow-up suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to generate follow-up suggestion" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { runSoundFlowScript } from "@/lib/soundflow";
import { db } from "@/db";
import { mixNotes } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { noteId } = await req.json();
    if (!noteId) {
      return NextResponse.json({ error: "noteId is required" }, { status: 400 });
    }

    const note = db.select().from(mixNotes).where(eq(mixNotes.id, noteId)).get();
    if (!note) {
      return NextResponse.json({ error: "Mix note not found" }, { status: 404 });
    }
    if (note.status !== "approved") {
      return NextResponse.json(
        { error: "Mix note must be approved before execution" },
        { status: 400 }
      );
    }
    if (!note.soundflowScript) {
      return NextResponse.json(
        { error: "No SoundFlow script available" },
        { status: 400 }
      );
    }

    // Update status to executing
    db.update(mixNotes)
      .set({ status: "executing", updatedAt: new Date().toISOString() })
      .where(eq(mixNotes.id, noteId))
      .run();

    const result = await runSoundFlowScript(note.soundflowScript);

    // Update status based on result
    db.update(mixNotes)
      .set({
        status: result.ok ? "done" : "failed",
        errorMessage: result.error || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(mixNotes.id, noteId))
      .run();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Mix note execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute mix note" },
      { status: 500 }
    );
  }
}

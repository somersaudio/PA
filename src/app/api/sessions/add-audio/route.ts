import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, filePath, filename, fromEmail } = await req.json();
    if (!sessionId || !filePath) {
      return NextResponse.json({ error: "sessionId and filePath required" }, { status: 400 });
    }

    const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Add to fileReferences
    const existing = (session.fileReferences as string[]) || [];
    const newRef = JSON.stringify({ path: filePath, filename: filename || filePath.split("/").pop(), fromEmail: fromEmail || null, addedAt: new Date().toISOString() });

    // Avoid duplicates
    if (existing.some((r) => {
      try { return JSON.parse(r).path === filePath; } catch { return r === filePath; }
    })) {
      return NextResponse.json({ message: "File already in session" });
    }

    const updated = [...existing, newRef];
    db.update(sessions)
      .set({ fileReferences: updated, updatedAt: new Date().toISOString() })
      .where(eq(sessions.id, sessionId))
      .run();

    return NextResponse.json({ success: true, message: `Added to "${session.projectName}"` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

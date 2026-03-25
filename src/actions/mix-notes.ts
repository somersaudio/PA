"use server";

import { db } from "@/db";
import { mixNotes, type MixNote } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function createMixNote(rawText: string, sessionId?: number) {
  const result = db
    .insert(mixNotes)
    .values({
      rawText,
      sessionId: sessionId || null,
      status: "pending",
    })
    .returning()
    .get();
  return result;
}

export async function getMixNotes(filter?: {
  status?: MixNote["status"];
  sessionId?: number;
}) {
  if (filter?.status) {
    return db
      .select()
      .from(mixNotes)
      .where(eq(mixNotes.status, filter.status))
      .orderBy(desc(mixNotes.createdAt))
      .all();
  }
  if (filter?.sessionId) {
    return db
      .select()
      .from(mixNotes)
      .where(eq(mixNotes.sessionId, filter.sessionId))
      .orderBy(desc(mixNotes.createdAt))
      .all();
  }
  return db.select().from(mixNotes).orderBy(desc(mixNotes.createdAt)).all();
}

export async function getMixNote(id: number) {
  return db.select().from(mixNotes).where(eq(mixNotes.id, id)).get() || null;
}

export async function updateMixNoteStatus(
  id: number,
  status: "pending" | "parsed" | "approved" | "executing" | "done" | "failed",
  error?: string
) {
  const result = db
    .update(mixNotes)
    .set({
      status,
      errorMessage: error || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(mixNotes.id, id))
    .returning()
    .get();
  return result;
}

export async function updateMixNoteParsed(
  id: number,
  parsedCommands: unknown[],
  soundflowScript: string
) {
  const result = db
    .update(mixNotes)
    .set({
      parsedCommands: parsedCommands as any,
      soundflowScript,
      status: "parsed",
      updatedAt: new Date().toISOString(),
    })
    .where(eq(mixNotes.id, id))
    .returning()
    .get();
  return result;
}

export async function approveMixNote(id: number) {
  return updateMixNoteStatus(id, "approved");
}

export async function deleteMixNote(id: number) {
  db.delete(mixNotes).where(eq(mixNotes.id, id)).run();
}

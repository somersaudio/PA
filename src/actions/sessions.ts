"use server";

import { db } from "@/db";
import { sessions, sessionNotes } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export async function createSession(data: {
  projectName: string;
  artistName?: string;
  date: string;
  status?: "scheduled" | "in-progress" | "completed" | "archived";
}) {
  const result = db
    .insert(sessions)
    .values({
      projectName: data.projectName,
      artistName: data.artistName || null,
      date: data.date,
      status: data.status || "scheduled",
    })
    .returning()
    .get();
  return result;
}

export async function updateSession(
  id: number,
  data: {
    projectName?: string;
    artistName?: string;
    date?: string;
    status?: "scheduled" | "in-progress" | "completed" | "archived";
    fileReferences?: string[];
  }
) {
  const result = db
    .update(sessions)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(sessions.id, id))
    .returning()
    .get();
  return result;
}

export async function deleteSession(id: number) {
  db.delete(sessions).where(eq(sessions.id, id)).run();
}

export async function getSessions(filter?: {
  status?: "scheduled" | "in-progress" | "completed" | "archived";
}) {
  if (filter?.status) {
    return db.select().from(sessions).where(eq(sessions.status, filter.status)).orderBy(asc(sessions.date)).all();
  }
  return db.select().from(sessions).orderBy(asc(sessions.date)).all();
}

export async function getSession(id: number) {
  const session = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!session) return null;
  const notes = db
    .select()
    .from(sessionNotes)
    .where(eq(sessionNotes.sessionId, id))
    .orderBy(desc(sessionNotes.timestamp))
    .all();
  return { ...session, notes };
}

export async function addSessionNote(sessionId: number, content: string) {
  const result = db
    .insert(sessionNotes)
    .values({ sessionId, content })
    .returning()
    .get();
  return result;
}

export async function deleteSessionNote(id: number) {
  db.delete(sessionNotes).where(eq(sessionNotes.id, id)).run();
}

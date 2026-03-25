"use server";

import { db } from "@/db";
import { pitches, pitchActivities } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function createPitch(data: {
  songTitle: string;
  recipientName: string;
  recipientEmail?: string;
  recipientCompany?: string;
  notes?: string;
}) {
  const result = db
    .insert(pitches)
    .values({
      songTitle: data.songTitle,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail || null,
      recipientCompany: data.recipientCompany || null,
      notes: data.notes || null,
    })
    .returning()
    .get();
  return result;
}

export async function updatePitch(
  id: number,
  data: {
    songTitle?: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientCompany?: string;
    status?: "new" | "pitched" | "follow-up" | "closed-won" | "closed-lost";
    dateSent?: string;
    notes?: string;
  }
) {
  const result = db
    .update(pitches)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(pitches.id, id))
    .returning()
    .get();
  return result;
}

export async function updatePitchStatus(
  id: number,
  status: "new" | "pitched" | "follow-up" | "closed-won" | "closed-lost"
) {
  const result = db
    .update(pitches)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(pitches.id, id))
    .returning()
    .get();

  // Auto-log status change as activity
  db.insert(pitchActivities)
    .values({
      pitchId: id,
      type: "note",
      content: `Status changed to ${status}`,
    })
    .run();

  return result;
}

export async function deletePitch(id: number) {
  db.delete(pitches).where(eq(pitches.id, id)).run();
}

export async function getPitches(filter?: { status?: "new" | "pitched" | "follow-up" | "closed-won" | "closed-lost" }) {
  if (filter?.status) {
    return db
      .select()
      .from(pitches)
      .where(eq(pitches.status, filter.status))
      .orderBy(desc(pitches.updatedAt))
      .all();
  }
  return db.select().from(pitches).orderBy(desc(pitches.updatedAt)).all();
}

export async function getPitch(id: number) {
  const pitch = db.select().from(pitches).where(eq(pitches.id, id)).get();
  if (!pitch) return null;
  const activities = db
    .select()
    .from(pitchActivities)
    .where(eq(pitchActivities.pitchId, id))
    .orderBy(desc(pitchActivities.createdAt))
    .all();
  return { ...pitch, activities };
}

export async function addPitchActivity(
  pitchId: number,
  type: "sent" | "follow-up" | "response" | "note",
  content: string
) {
  const result = db
    .insert(pitchActivities)
    .values({ pitchId, type, content })
    .returning()
    .get();
  return result;
}

export async function getStalePitches(days: number = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  // Pitches that are not closed and have no activity in the last N days
  return db
    .select()
    .from(pitches)
    .where(
      sql`${pitches.status} NOT IN ('closed-won', 'closed-lost') AND ${pitches.updatedAt} < ${cutoffStr}`
    )
    .orderBy(pitches.updatedAt)
    .all();
}

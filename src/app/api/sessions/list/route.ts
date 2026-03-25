import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const all = db.select().from(sessions).orderBy(desc(sessions.date)).all();
  return NextResponse.json({ sessions: all });
}

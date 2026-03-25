import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

const dataDir = path.join(process.cwd(), "data");
const collabPath = path.join(dataDir, "session-collaborators.json");

type Collaborator = {
  name: string;
  role: string; // "artist" | "writer" | "engineer" | "producer" | "vocalist" | etc.
};

type AllCollabs = Record<string, Collaborator[]>; // keyed by session ID

function getAll(): AllCollabs {
  try {
    return JSON.parse(readFileSync(collabPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveAll(data: AllCollabs) {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(collabPath, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ collaborators: [] });
  }
  const all = getAll();
  return NextResponse.json({ collaborators: all[sessionId] || [] });
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, name, role, action } = await req.json();
    if (!sessionId || !name) {
      return NextResponse.json({ error: "sessionId and name required" }, { status: 400 });
    }

    const all = getAll();
    if (!all[sessionId]) all[sessionId] = [];

    if (action === "remove") {
      all[sessionId] = all[sessionId].filter((c) => c.name !== name);
    } else {
      // Add if not duplicate
      if (!all[sessionId].some((c) => c.name === name)) {
        all[sessionId].push({ name, role: role || "artist" });
      }
    }

    saveAll(all);

    // Sync session artistName with collaborators
    const collabs = all[sessionId] || [];
    const artistName = collabs.map((c) => c.name).join(", ") || null;
    db.update(sessions)
      .set({ artistName, updatedAt: new Date().toISOString() })
      .where(eq(sessions.id, Number(sessionId)))
      .run();

    return NextResponse.json({ success: true, collaborators: collabs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

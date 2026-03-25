import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const queuePath = path.join(process.cwd(), "data", "suno-queue.json");

export type SunoQueueItem = {
  artists: string;
  count: number;
  weirdness1: number;
  weirdness2: number;
  extraPrompt?: string;
  createdAt: number;
};

function readQueue(): SunoQueueItem[] {
  try {
    return JSON.parse(readFileSync(queuePath, "utf-8"));
  } catch {
    return [];
  }
}

function writeQueue(items: SunoQueueItem[]) {
  mkdirSync(path.dirname(queuePath), { recursive: true });
  writeFileSync(queuePath, JSON.stringify(items, null, 2), "utf-8");
}

// POST — add to queue
export async function POST(req: NextRequest) {
  const item: SunoQueueItem = await req.json();
  const queue = readQueue();
  queue.push({ ...item, createdAt: Date.now() });
  writeQueue(queue);
  return NextResponse.json({ ok: true });
}

// GET — read and clear queue
export async function GET() {
  const queue = readQueue();
  if (queue.length > 0) {
    writeQueue([]);
  }
  return NextResponse.json({ items: queue });
}

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

const markersPath = path.join(process.cwd(), "downloads", "markers.json");

type Marker = {
  id: string;
  time: number;
  comments: string[];
};

function getAll(): Record<string, Marker[]> {
  try {
    return JSON.parse(readFileSync(markersPath, "utf-8"));
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, Marker[]>) {
  writeFileSync(markersPath, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get("file");
  if (!filename) {
    return NextResponse.json({ markers: [] });
  }
  const all = getAll();
  return NextResponse.json({ markers: all[filename] || [] });
}

export async function POST(req: NextRequest) {
  try {
    const { filename, markers } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }
    const all = getAll();
    if (markers && markers.length > 0) {
      all[filename] = markers;
    } else {
      delete all[filename];
    }
    saveAll(all);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save markers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

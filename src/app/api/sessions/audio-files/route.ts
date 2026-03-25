import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const { fileReferences } = await req.json();
    if (!fileReferences || !Array.isArray(fileReferences)) {
      return NextResponse.json({ files: [] });
    }

    const valid = fileReferences.filter((ref: string) => {
      try {
        const parsed = JSON.parse(ref);
        if (!parsed.path) return false;
        // Check both absolute path and relative to downloads
        if (existsSync(parsed.path)) return true;
        if (existsSync(path.join(process.cwd(), parsed.path))) return true;
        return false;
      } catch {
        return false;
      }
    });

    return NextResponse.json({ files: valid });
  } catch {
    return NextResponse.json({ files: [] });
  }
}

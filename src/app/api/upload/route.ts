import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    mkdirSync(uploadsDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(uploadsDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      filePath,
      filename: safeName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

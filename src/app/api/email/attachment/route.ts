import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, createReadStream } from "fs";

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stat = statSync(filePath);
  const fileSize = stat.size;
  const ext = filePath.split(".").pop()?.toLowerCase() || "";

  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aiff: "audio/aiff",
    aif: "audio/aiff",
    flac: "audio/flac",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    pdf: "application/pdf",
    zip: "application/zip",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };

  const contentType = mimeTypes[ext] || "application/octet-stream";
  const range = req.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filePath, { start, end });
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const stream = createReadStream(filePath);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
      "Content-Type": contentType,
    },
  });
}

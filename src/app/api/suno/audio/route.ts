import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, createReadStream } from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get("file");
  if (!filename) {
    return NextResponse.json({ error: "file param required" }, { status: 400 });
  }

  const safe = path.basename(filename);
  const filepath = path.join(process.cwd(), "downloads", safe);

  if (!existsSync(filepath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stat = statSync(filepath);
  const fileSize = stat.size;
  const range = req.headers.get("range");

  if (range) {
    // Parse range header: "bytes=start-end"
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(filepath, { start, end });
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
        "Content-Type": "audio/mpeg",
      },
    });
  }

  // No range — return full file with Accept-Ranges header
  const stream = createReadStream(filepath);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  return new NextResponse(buffer, {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(fileSize),
      "Content-Type": "audio/mpeg",
    },
  });
}

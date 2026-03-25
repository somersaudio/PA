import { NextResponse } from "next/server";
import { fullSync, initialSync, getDropboxPaths } from "@/lib/dropbox-sync";
import { existsSync } from "fs";

export async function GET() {
  const paths = getDropboxPaths();
  const connected = !!paths && existsSync(paths.base);

  return NextResponse.json({ connected, paths });
}

export async function POST() {
  try {
    // First ensure all local files are in Dropbox/New
    const copied = initialSync();

    // Then sync likes/rejects from Dropbox back to app
    const { newLikes, newRejects } = fullSync();

    return NextResponse.json({
      success: true,
      copied,
      newLikes,
      newRejects,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

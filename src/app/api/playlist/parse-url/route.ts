import { NextRequest, NextResponse } from "next/server";
import { extractSpotifyPlaylistId, getSpotifyPlaylistTracks } from "@/lib/spotify";
import { extractSunoPlaylistId, getSunoPlaylistTracks } from "@/lib/suno";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Detect platform
    const spotifyId = extractSpotifyPlaylistId(url);
    const sunoId = extractSunoPlaylistId(url);

    if (spotifyId) {
      const result = await getSpotifyPlaylistTracks(spotifyId);
      return NextResponse.json({
        platform: "spotify",
        name: result.name,
        tracks: result.tracks,
      });
    }

    if (sunoId) {
      const result = await getSunoPlaylistTracks(sunoId);
      return NextResponse.json({
        platform: "suno",
        name: result.name,
        tracks: result.tracks,
      });
    }

    return NextResponse.json(
      { error: "URL not recognized. Paste a Spotify or Suno playlist link." },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse playlist URL";
    console.error("Playlist parse error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

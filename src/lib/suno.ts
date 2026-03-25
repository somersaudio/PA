import { callClaude } from "./claude";

type SunoTrack = {
  artist: string;
  title: string;
};

export function extractSunoPlaylistId(url: string): string | null {
  // Handles:
  // https://suno.com/playlist/xxxxx
  // https://www.suno.com/playlist/xxxxx
  const match = url.match(/suno\.com\/playlist\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

export async function getSunoPlaylistTracks(playlistId: string): Promise<{
  name: string;
  tracks: SunoTrack[];
}> {
  // Fetch the Suno playlist page
  const res = await fetch(`https://suno.com/playlist/${playlistId}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Suno playlist: ${res.status}`);
  }

  const html = await res.text();

  // Try to extract JSON data from the page (Suno embeds data in script tags)
  const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    try {
      const data = JSON.parse(scriptMatch[1]);
      const playlist = data?.props?.pageProps?.playlist;
      if (playlist) {
        return {
          name: playlist.name || "Suno Playlist",
          tracks: (playlist.clips || playlist.songs || []).map(
            (clip: { title?: string; display_name?: string; metadata?: { tags?: string } }) => ({
              artist: clip.display_name || "Unknown",
              title: clip.title || "Untitled",
            })
          ),
        };
      }
    } catch {
      // Fall through to Claude parsing
    }
  }

  // Fallback: send the HTML to Claude for extraction
  const extracted = await callClaude(
    `Extract all song titles and artist/creator names from this Suno playlist HTML page. Output a JSON array: [{"artist": "...", "title": "..."}]. Also extract the playlist name if visible. Wrap in {"name": "playlist name", "tracks": [...]}. Output ONLY valid JSON.`,
    html.slice(0, 30000) // Limit to avoid token overload
  );

  try {
    const parsed = JSON.parse(extracted);
    return {
      name: parsed.name || "Suno Playlist",
      tracks: parsed.tracks || [],
    };
  } catch {
    throw new Error(
      "Could not parse Suno playlist. The page format may have changed."
    );
  }
}

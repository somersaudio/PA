type SpotifyTrack = {
  artist: string;
  title: string;
};

export function extractSpotifyPlaylistId(url: string): string | null {
  const urlMatch = url.match(/playlist[/:]([a-zA-Z0-9]+)/);
  return urlMatch ? urlMatch[1] : null;
}

export async function getSpotifyPlaylistTracks(playlistId: string): Promise<{
  name: string;
  tracks: SpotifyTrack[];
}> {
  // Use the embed page — no API credentials needed, works for all public playlists
  const res = await fetch(
    `https://open.spotify.com/embed/playlist/${playlistId}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify playlist: ${res.status}`);
  }

  const html = await res.text();

  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/
  );
  if (!match) {
    throw new Error("Could not parse Spotify embed page. The format may have changed.");
  }

  const data = JSON.parse(match[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error("No playlist data found in Spotify embed.");
  }

  const playlistName = entity.name || "Spotify Playlist";
  const trackList = entity.trackList || [];

  if (trackList.length === 0) {
    throw new Error("Playlist appears to be empty.");
  }

  const tracks: SpotifyTrack[] = trackList.map(
    (t: { title: string; subtitle: string }) => ({
      artist: t.subtitle || "Unknown",
      title: t.title || "Untitled",
    })
  );

  return { name: playlistName, tracks };
}

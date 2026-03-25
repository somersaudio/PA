import { NextRequest, NextResponse } from "next/server";

const imageCache = new Map<string, string | null>();
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("No Spotify credentials");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken!;
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const cacheKey = name.toLowerCase().trim();
  if (imageCache.has(cacheKey)) {
    return NextResponse.json({ imageUrl: imageCache.get(cacheKey) });
  }

  try {
    const token = await getToken();
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      imageCache.set(cacheKey, null);
      return NextResponse.json({ imageUrl: null });
    }

    const data = await res.json();
    const artist = data?.artists?.items?.[0];

    // Only use the image if the name is an exact match (case-insensitive)
    const imageUrl = artist?.name?.toLowerCase() === cacheKey
      ? (artist?.images?.[0]?.url || null)
      : null;

    imageCache.set(cacheKey, imageUrl);
    return NextResponse.json({ imageUrl });
  } catch {
    imageCache.set(cacheKey, null);
    return NextResponse.json({ imageUrl: null });
  }
}

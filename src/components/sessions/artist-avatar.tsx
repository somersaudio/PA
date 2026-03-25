"use client";

import { useState, useEffect } from "react";

// Persistent client-side cache (localStorage + in-memory)
const CACHE_KEY = "pa-artist-avatars";
const avatarCache = new Map<string, string | null>();
let cacheLoaded = false;

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    for (const [k, v] of Object.entries(stored)) {
      avatarCache.set(k, v as string | null);
    }
  } catch {}
}

function persistCache() {
  try {
    const obj: Record<string, string | null> = {};
    avatarCache.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {}
}

function AvatarSingle({ name, size, style }: { name: string; size: number; style?: React.CSSProperties }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadCache();
    const key = name.toLowerCase();
    if (avatarCache.has(key)) {
      setImageUrl(avatarCache.get(key) || null);
      setLoaded(true);
      return;
    }

    fetch(`/api/spotify/artist-image?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((d) => {
        avatarCache.set(key, d.imageUrl || null);
        persistCache();
        setImageUrl(d.imageUrl || null);
        setLoaded(true);
      })
      .catch(() => {
        avatarCache.set(key, null);
        persistCache();
        setLoaded(true);
      });
  }, [name]);

  if (!loaded) {
    return (
      <div
        className="rounded-full bg-muted animate-pulse shrink-0 border-2 border-background"
        style={{ width: size, height: size, ...style }}
      />
    );
  }

  if (!imageUrl) {
    const initials = name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    return (
      <div
        className="rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground font-bold border-2 border-background"
        style={{ width: size, height: size, fontSize: size * 0.35, ...style }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={name}
      className="rounded-full object-cover shrink-0 border-2 border-background"
      style={{ width: size, height: size, ...style }}
    />
  );
}

function splitArtists(name: string): string[] {
  // Split by comma, " x ", " & ", " and ", " feat ", " ft "
  return name
    .split(/\s*[,]\s*|\s+x\s+|\s+&\s+|\s+and\s+|\s+feat\.?\s+|\s+ft\.?\s+/i)
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

export function ArtistAvatar({ name, size = 36, reverse = false }: { name: string; size?: number; reverse?: boolean }) {
  const artists = splitArtists(name);

  if (artists.length <= 1) {
    return <AvatarSingle name={name} size={size} />;
  }

  // Multiple artists — stack them with overlap
  const overlap = size * 0.35;
  const totalWidth = size + (artists.length - 1) * (size - overlap);

  return (
    <div className="flex shrink-0" style={{ width: totalWidth, height: size, position: "relative" }}>
      {artists.map((artist, i) => (
        <AvatarSingle
          key={artist}
          name={artist}
          size={size}
          style={{
            position: "absolute",
            ...(reverse
              ? { right: i * (size - overlap) }
              : { left: i * (size - overlap) }),
            zIndex: artists.length - i,
          }}
        />
      ))}
    </div>
  );
}

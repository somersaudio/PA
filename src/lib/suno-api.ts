const SUNO_BASE_URL = "https://studio-api-prod.suno.com";

async function getSessionToken(cookie: string): Promise<string> {
  // Strategy 1: Extract __session JWT directly from cookie string
  // This is the fastest path — the cookie already contains the access token
  const sessionMatch = cookie.match(
    /(?:^|;\s*)__session=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
  );
  if (sessionMatch) {
    return sessionMatch[1];
  }

  // Strategy 2: Try auth.suno.com (new Clerk endpoint)
  for (const baseUrl of [
    "https://auth.suno.com",
    "https://clerk.suno.com",
  ]) {
    try {
      const res = await fetch(
        `${baseUrl}/v1/client?_clerk_js_version=5.117.0`,
        {
          headers: {
            Cookie: cookie,
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          },
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const sessions =
        data?.response?.sessions || data?.client?.sessions || [];
      if (sessions.length === 0) continue;

      const lastSession = sessions[sessions.length - 1];
      const token =
        lastSession?.last_active_token?.jwt ||
        lastSession?.last_active_session_token;
      if (token) return token;
    } catch {
      continue;
    }
  }

  // Strategy 3: Try extracting __session_Jnxw-muT or similar variant
  const variantMatch = cookie.match(
    /(?:^|;\s*)__session[^=]*=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/
  );
  if (variantMatch) {
    return variantMatch[1];
  }

  throw new Error(
    "Could not extract Suno session token. Go to Settings and reconnect to Suno."
  );
}

export async function generateSunoSong(
  cookie: string,
  prompt: string,
  options?: {
    title?: string;
    tags?: string;
    instrumental?: boolean;
  }
): Promise<{
  id: string;
  clips: Array<{
    id: string;
    title: string;
    status: string;
    audio_url: string | null;
    metadata: Record<string, unknown>;
  }>;
}> {
  const token = await getSessionToken(cookie);

  const body: Record<string, unknown> = {
    params: {
      prompt,
      generation_type: "TEXT",
      ...(options?.tags ? { tags: options.tags } : {}),
      ...(options?.title ? { title: options.title } : {}),
      make_instrumental: options?.instrumental ?? false,
    },
  };

  console.log("Suno generate: using token", token.slice(0, 30) + "...");

  const res = await fetch(`${SUNO_BASE_URL}/api/generate/v2/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Suno generate error:", res.status, text);
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "Suno auth failed. Go to Settings and reconnect to Suno."
      );
    }
    throw new Error(`Suno generation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    id: data.id || data.clips?.[0]?.id || "unknown",
    clips: data.clips || [],
  };
}

export async function getSunoSongStatus(
  cookie: string,
  clipIds: string[]
): Promise<
  Array<{
    id: string;
    title: string;
    status: string;
    audio_url: string | null;
    image_url: string | null;
    duration: number | null;
  }>
> {
  const token = await getSessionToken(cookie);
  const idsParam = clipIds.join(",");

  const res = await fetch(`${SUNO_BASE_URL}/api/feed/?ids=${idsParam}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to check song status: ${res.status}`);
  }

  const data = await res.json();
  return (data || []).map(
    (clip: {
      id: string;
      title: string;
      status: string;
      audio_url: string | null;
      image_url: string | null;
      metadata?: { duration?: number };
    }) => ({
      id: clip.id,
      title: clip.title,
      status: clip.status,
      audio_url: clip.audio_url,
      image_url: clip.image_url,
      duration: clip.metadata?.duration || null,
    })
  );
}

export async function getSunoCredits(cookie: string): Promise<{
  credits_left: number;
  period: string;
}> {
  const token = await getSessionToken(cookie);

  const res = await fetch(`${SUNO_BASE_URL}/api/billing/info/`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get credits: ${res.status}`);
  }

  const data = await res.json();
  return {
    credits_left: data.total_credits_left ?? 0,
    period: data.period ?? "unknown",
  };
}

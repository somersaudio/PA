"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

type KeyStatus = {
  anthropic: boolean;
  openai: boolean;
  gemini: boolean;
  spotify: boolean;
};

const providers = [
  { id: "anthropic", logo: "/claude-logo.png", name: "Claude" },
  { id: "openai", logo: "/openai-logo.png", name: "OpenAI" },
  { id: "gemini", logo: "/gemini-logo.png", name: "Gemini" },
  { id: "spotify", logo: null, name: "Spotify" },
];

export function ApiStatus() {
  const [status, setStatus] = useState<KeyStatus>({ anthropic: false, openai: false, gemini: false, spotify: false });
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch("/api/settings/api-keys")
        .then((r) => r.json())
        .then((d) => setStatus(d))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Find the slot in the chat panel header
    const el = document.getElementById("api-status-slot");
    if (el) setSlot(el);
    // Retry in case chat panel mounts later
    const timer = setTimeout(() => {
      const el2 = document.getElementById("api-status-slot");
      if (el2) setSlot(el2);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const connected = providers.filter((p) => status[p.id as keyof KeyStatus]);
  if (connected.length === 0) return null;

  const content = (
    <div className="flex items-center gap-1.5">
      {connected.map((p) => (
        p.logo ? (
          <Image
            key={p.id}
            src={p.logo}
            alt={p.name}
            width={18}
            height={18}
            className={`rounded opacity-80 hover:opacity-100 transition-opacity ${p.id === "openai" ? "invert" : ""}`}
            title={`${p.name} connected`}
          />
        ) : p.id === "spotify" ? (
          <div key={p.id} className="w-[18px] h-[18px] rounded bg-[#1DB954] flex items-center justify-center opacity-80 hover:opacity-100 transition-opacity" title="Spotify connected">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
        ) : null
      ))}
    </div>
  );

  // Render into the chat panel slot if available, otherwise fixed position
  if (slot) {
    return createPortal(content, slot);
  }

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5">
      {content}
    </div>
  );
}

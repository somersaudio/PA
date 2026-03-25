"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArtistAvatar } from "@/components/sessions/artist-avatar";

type Session = {
  id: number;
  projectName: string;
  artistName: string | null;
  date: string;
  status: string;
};

export function SessionNavItem({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  const pathname = usePathname();
  const isActive = pathname.startsWith("/sessions");
  const [nextSession, setNextSession] = useState<Session | null>(null);

  useEffect(() => {
    function loadSessions() {
      fetch("/api/sessions/list")
        .then((r) => r.json())
        .then((d) => {
          const sessions: Session[] = d.sessions || [];
          const upcoming = sessions
            .filter((s) => s.status === "scheduled" || s.status === "in-progress")
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setNextSession(upcoming[0] || null);
        })
        .catch(() => {});
    }
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/sessions"
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      {nextSession?.artistName ? (
        <ArtistAvatar name={nextSession.artistName} size={40} />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      Sessions
    </Link>
  );
}

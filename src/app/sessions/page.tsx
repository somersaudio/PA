import { getSessions } from "@/actions/sessions";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewSessionDialog } from "@/components/sessions/new-session-dialog";
import { ArtistAvatar } from "@/components/sessions/artist-avatar";

export default async function SessionsPage() {
  const sessions = await getSessions();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Sessions</h1>
        <NewSessionDialog />
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No sessions yet. Create your first session to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`} className="block mb-4">
              <Card className="hover:shadow-md transition-shadow cursor-pointer !bg-[color-mix(in_srgb,var(--card)_75%,transparent)] !py-0 !gap-0 h-18 overflow-hidden">
                <CardContent className="flex items-center gap-3 h-full py-0">
                  {session.artistName && (
                    <ArtistAvatar name={session.artistName} size={50} reverse />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{session.projectName}</h3>
                    {session.artistName && (
                      <p className="text-sm text-muted-foreground">
                        with {session.artistName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {session.status !== "scheduled" && (
                      <Badge
                        variant={
                          session.status === "in-progress"
                            ? "default"
                            : session.status === "completed"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {session.status}
                      </Badge>
                    )}
                    <div className="text-center text-muted-foreground">
                      <div className="text-xs text-foreground font-medium">
                        {new Date(session.date + "T00:00:00").toLocaleDateString(undefined, { month: "long" })}
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        {new Date(session.date + "T00:00:00").getDate()}
                      </div>
                      <div className="text-[10px]">
                        {new Date(session.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long" })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

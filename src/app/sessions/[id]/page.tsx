import { getSession } from "@/actions/sessions";
import { getMixNotes } from "@/actions/mix-notes";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionControls } from "@/components/sessions/session-controls";
import { QuickNote } from "@/components/sessions/quick-note";
import { ArtistAvatar } from "@/components/sessions/artist-avatar";
import { SessionAudio } from "@/components/sessions/session-audio";
import { SessionCollaborators } from "@/components/sessions/session-collaborators";
import { DeleteNoteButton } from "@/components/sessions/delete-note-button";
import Link from "next/link";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(Number(id));
  if (!session) notFound();

  const mixNotesList = await getMixNotes({ sessionId: session.id });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {session.artistName && (
            <ArtistAvatar name={session.artistName} size={56} />
          )}
          <div>
            <Link
              href="/sessions"
              className="text-sm text-muted-foreground hover:underline"
            >
              Sessions
            </Link>
            <h1 className="text-3xl font-bold">{session.projectName}</h1>
            {session.artistName && (
              <p className="text-muted-foreground">with {session.artistName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={
              session.status === "in-progress" ? "default" : "secondary"
            }
          >
            {session.status}
          </Badge>
          <SessionControls session={session} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Note</CardTitle>
            </CardHeader>
            <CardContent>
              <QuickNote sessionId={session.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {session.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No notes yet. Add one above.
                </p>
              ) : (
                <div className="space-y-3">
                  {session.notes.map((note) => (
                    <div
                      key={note.id}
                      className="p-3 rounded-md bg-muted text-sm relative group"
                    >
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DeleteNoteButton noteId={note.id} />
                      </div>
                      <p>{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(note.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Collaborators</CardTitle>
            </CardHeader>
            <CardContent>
              <SessionCollaborators sessionId={session.id} />
            </CardContent>
          </Card>

          <SessionAudio fileReferences={(session.fileReferences as string[]) || []} />

          <Card>
            <CardHeader>
              <CardTitle>Linked Mix Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {mixNotesList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No mix notes linked to this session.
                </p>
              ) : (
                <div className="space-y-2">
                  {mixNotesList.map((note) => (
                    <Link
                      key={note.id}
                      href={`/mix-agent/${note.id}`}
                      className="block p-3 rounded-md hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium truncate">
                        {note.rawText}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {note.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

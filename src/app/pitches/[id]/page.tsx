import { getPitch } from "@/actions/pitches";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PitchControls } from "@/components/pitches/pitch-controls";
import { FollowUpSuggestion } from "@/components/pitches/followup-suggestion";
import { PitchActivityForm } from "@/components/pitches/pitch-activity-form";
import Link from "next/link";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "outline",
  pitched: "default",
  "follow-up": "secondary",
  "closed-won": "default",
  "closed-lost": "destructive",
};

const activityTypeIcons: Record<string, string> = {
  sent: "Sent",
  "follow-up": "Follow-up",
  response: "Response",
  note: "Note",
};

export default async function PitchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pitch = await getPitch(Number(id));
  if (!pitch) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/pitches"
          className="text-sm text-muted-foreground hover:underline"
        >
          Pitches
        </Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-3xl font-bold">{pitch.songTitle}</h1>
          <Badge variant={statusColors[pitch.status] || "outline"}>
            {pitch.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          → {pitch.recipientName}
          {pitch.recipientCompany && ` at ${pitch.recipientCompany}`}
        </p>
      </div>

      {/* Pipeline stepper */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto">
        {["new", "pitched", "follow-up", "closed-won", "closed-lost"].map(
          (stage, i) => (
            <div key={stage} className="flex items-center">
              {i > 0 && (
                <div className="w-8 h-px bg-border mx-1" />
              )}
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  pitch.status === stage
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {stage}
              </div>
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {pitch.recipientEmail && (
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {pitch.recipientEmail}
                </p>
              )}
              {pitch.dateSent && (
                <p>
                  <span className="text-muted-foreground">Date Sent:</span>{" "}
                  {pitch.dateSent}
                </p>
              )}
              {pitch.notes && (
                <div>
                  <span className="text-muted-foreground">Notes:</span>
                  <p className="mt-1 whitespace-pre-wrap">{pitch.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Follow-up Suggestion</CardTitle>
            </CardHeader>
            <CardContent>
              <FollowUpSuggestion pitchId={pitch.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <PitchControls pitch={pitch} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Log Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <PitchActivityForm pitchId={pitch.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {pitch.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity logged yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {pitch.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex gap-3 p-3 rounded-md bg-muted/50"
                    >
                      <Badge variant="outline" className="shrink-0 h-fit">
                        {activityTypeIcons[activity.type] || activity.type}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
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

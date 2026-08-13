import React from "react";
import { Link } from "wouter";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { Trophy, Flame, Info } from "lucide-react";
import { LoadingBlock } from "@/components/ui/primitives";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { PageShell, PageHeader, EmptyState } from "@/components/layout/PageShell";

interface Entry {
  rank: number;
  displayName: string;
  username: string | null;
  avatarSymbol: string | null;
  avatarColor: string | null;
  /** One-way seed from the server — never the raw owner key. */
  avatarSeed: string;
  xp: number;
  streak: number;
  isYou: boolean;
}

interface LeaderboardResponse {
  optedIn: boolean;
  grade: number | null;
  weekStart?: string;
  totalParticipants?: number;
  entries: Entry[];
  you: Entry | null;
}

export default function Leaderboard() {
  const sessionId = useSession();
  const [data, setData] = React.useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    async function load(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(
          `/api/leaderboard?sessionId=${encodeURIComponent(sessionId)}`,
        );
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled && showSpinner) setData(null);
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    }

    void load(true);

    // Keeps the board live while it is on screen. Polling rather than a socket:
    // the deployment is autoscale, so a long-lived connection per viewer would
    // pin instances open for a board that changes at most every few minutes.
    // Refreshes without the spinner so ranks update in place.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, 20_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId]);

  return (
    <>
      <SeoHead
        title="Leaderboard | StudyFilter"
        description="See how your weekly study XP compares with other CBSE students in your class."
        canonical="/leaderboard"
      />
      <PageShell width="narrow">
        <PageHeader
          icon={Trophy}
          title="Leaderboard"
          description="Weekly XP, reset every Monday."
        />

        {loading ? (
          <LoadingBlock full label="Loading this week's board…" />
        ) : !data?.optedIn ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">You&rsquo;re not on the leaderboard</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Taking part is optional. Turn it on in Settings and pick a display
              name — you never have to use your real name.
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/settings">Open Settings</Link>
            </Button>
          </div>
        ) : data.entries.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Nobody has scored yet this week"
            description="Answer a question or finish a focus session to get on the board."
          />
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground/80">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Ranked among Class {data.grade} students who opted in
                {typeof data.totalParticipants === "number"
                  ? ` (${data.totalParticipants})`
                  : ""}
                . Everyone starts level again each Monday.
              </span>
            </div>

            <ul className="mt-4 divide-y overflow-hidden rounded-xl border bg-card">
              {data.entries.map((e) => (
                <li
                  key={e.rank}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    e.isYou ? "bg-primary/5" : ""
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${
                      e.rank <= 3
                        ? "bg-warning-soft text-warning"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {e.rank}
                  </span>
                  <ProfileAvatar
                    seed={e.avatarSeed}
                    symbol={e.avatarSymbol}
                    color={e.avatarColor}
                    size="md"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-sm font-medium">{e.displayName}</span>
                    {e.isYou && (
                      <span className="ml-1.5 text-xs font-semibold text-primary">
                        you
                      </span>
                    )}
                    {e.username && (
                      <span className="block truncate text-xs text-muted-foreground">
                        @{e.username}
                      </span>
                    )}
                  </span>
                  {e.streak > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Flame className="h-3.5 w-3.5" />
                      {e.streak}
                    </span>
                  )}
                  <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {e.xp.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            {data.you && !data.entries.some((e) => e.isYou) && (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                You&rsquo;re ranked #{data.you.rank} with{" "}
                {data.you.xp.toLocaleString()} XP this week.
              </p>
            )}
          </>
        )}
      </PageShell>
    </>
  );
}

import React from "react";
import { useUser, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSession } from "@/hooks/use-session";
import { useGrade } from "@/hooks/use-grade";
import { LogOut, ShieldCheck, Trophy, UserRound } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { ProfileSection, type ProfileValues } from "@/components/settings/ProfileSection";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AccountSettings {
  leaderboardOptIn: boolean;
  displayName: string | null;
  username: string | null;
  avatarSymbol: string | null;
  avatarColor: string | null;
  grade: number | null;
}

/**
 * Account, privacy and data controls.
 *
 * Two deliberate choices, both because most of these students are around 15:
 * leaderboard participation is opt-in rather than opt-out, and the display
 * name is free text that defaults to nothing — a real name is never required
 * to take part.
 */
export function AccountSection() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { signOut } = useClerk();
  const sessionId = useSession();
  const { grade } = useGrade();
  const { toast } = useToast();

  const [settings, setSettings] = React.useState<AccountSettings | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/account/settings?sessionId=${encodeURIComponent(sessionId)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setSettings(json.settings);
      } catch {
        /* leave null; the section renders defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function save(next: Partial<AccountSettings>) {
    if (!sessionId) return;
    // `??` rather than a spread so an explicit null (clearing a username)
    // is not silently replaced by the previous value.
    const pick = <K extends keyof AccountSettings>(key: K): AccountSettings[K] =>
      key in next ? (next[key] as AccountSettings[K]) : ((settings?.[key] ?? null) as AccountSettings[K]);

    const merged: AccountSettings = {
      leaderboardOptIn: next.leaderboardOptIn ?? settings?.leaderboardOptIn ?? false,
      displayName: pick("displayName"),
      username: pick("username"),
      avatarSymbol: pick("avatarSymbol"),
      avatarColor: pick("avatarColor"),
      grade: settings?.grade ?? (grade ? Number(grade) : null),
    };
    setSettings(merged);
    setSaving(true);
    try {
      const res = await fetch("/api/account/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...merged }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Your data has been deleted." });
      try {
        localStorage.clear();
      } catch {
        /* ignore */
      }
      await signOut({ redirectUrl: basePath || "/" });
    } catch {
      toast({ title: "Could not delete your data", variant: "destructive" });
      setDeleting(false);
    }
  }

  return (
    <section className="mt-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Account</h2>
      </div>

      {/*
        Outside the signed-in branch on purpose. The avatar and handle work
        for anonymous sessions too — resolveOwnerKey falls back to the browser
        session id — and sign-in is optional here, so gating this meant most
        students could never change the avatar the leaderboard shows for them.
      */}
      {sessionId && (
        <div className="mt-4 border-b pb-5">
          <ProfileSection
            sessionId={sessionId}
            values={{
              username: settings?.username ?? null,
              avatarSymbol: settings?.avatarSymbol ?? null,
              avatarColor: settings?.avatarColor ?? null,
            }}
            onChange={(next: Partial<ProfileValues>) =>
              setSettings((s) => (s ? { ...s, ...next } : s))
            }
            onCommit={(next: Partial<ProfileValues>) => void save(next)}
          />
        </div>
      )}

      {!isLoaded ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Loading…
        </div>
      ) : !isSignedIn ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            You&rsquo;re studying as a guest. Your progress is saved to this
            browser only — clearing your history or switching to your phone
            starts you from zero.
          </p>
          <Button asChild size="sm">
            <Link href="/sign-in">Sign in to keep your progress</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <p className="text-sm font-medium">
              {user?.fullName ?? user?.firstName ?? "Signed in"}
            </p>
            <p className="text-xs text-muted-foreground">
              {user?.emailAddresses?.[0]?.emailAddress}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
              <ShieldCheck className="h-3.5 w-3.5" />
              Progress synced across your devices
            </p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
                  Show me on the leaderboard
                </p>
                <p className="text-xs text-muted-foreground">
                  Ranks weekly XP against others in your class. Off by default.
                </p>
              </div>
              <Switch
                aria-label="Appear on the leaderboard"
                checked={settings?.leaderboardOptIn ?? false}
                onCheckedChange={(v) => save({ leaderboardOptIn: v })}
              />
            </div>

            {settings?.leaderboardOptIn && (
              <div className="space-y-1.5">
                <Label className="text-xs">Display name</Label>
                <Input
                  value={settings?.displayName ?? ""}
                  onChange={(e) =>
                    setSettings((s) =>
                      s ? { ...s, displayName: e.target.value } : s,
                    )
                  }
                  onBlur={(e) => save({ displayName: e.target.value })}
                  placeholder="A nickname — not your real name"
                  maxLength={24}
                />
                <p className="text-xs text-muted-foreground">
                  Shown with your avatar and username on the board. Leave it
                  blank to appear as &ldquo;Anonymous&rdquo;.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Your data</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="/api/account/export">Download my data</a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Sign out
              </Button>
            </div>

            {!confirmDelete ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete my data
              </Button>
            ) : (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-xs">
                  This permanently deletes your XP, streak, saved work, study
                  plans and reports. It cannot be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting && <Spinner className="mr-1.5" />}
                    Yes, delete everything
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {saving && (
            <p className="text-xs text-muted-foreground">Saving…</p>
          )}
        </div>
      )}
    </section>
  );
}

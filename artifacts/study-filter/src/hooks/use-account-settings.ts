import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/hooks/use-session";

export interface AccountSettingsData {
  leaderboardOptIn: boolean;
  displayName: string | null;
  username: string | null;
  avatarSymbol: string | null;
  avatarColor: string | null;
  grade: number | null;
}

/**
 * The student's own profile settings.
 *
 * Shared through TanStack Query so the sidebar and Settings read one cached
 * copy rather than each fetching their own — the sidebar renders on every
 * page, and a second uncached request per navigation is a real cost for
 * something that changes about once ever.
 */
export function useAccountSettings() {
  const sessionId = useSession();

  return useQuery<AccountSettingsData | null>({
    queryKey: ["/api/account/settings", { sessionId }],
    enabled: Boolean(sessionId),
    // Profile settings change on the Settings page, which invalidates this
    // key itself; nothing else can change them behind our back.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(
        `/api/account/settings?sessionId=${encodeURIComponent(sessionId!)}`,
      );
      if (!res.ok) return null;
      const json = await res.json();
      return (json.settings ?? null) as AccountSettingsData | null;
    },
  });
}

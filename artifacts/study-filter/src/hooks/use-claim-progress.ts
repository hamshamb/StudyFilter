import { useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";

const CLAIMED_KEY = "sf_claimed_for";

/**
 * Links the progress a student built up anonymously to their account, once,
 * the first time they sign in on a given browser.
 *
 * Progress used to be keyed to a browser-local UUID. Now that the server keys
 * signed-in requests to the Clerk user instead, signing in would otherwise
 * present a brand-new empty account — the student's XP, streak and study plan
 * would still exist, just under the old anonymous key, invisible to them. This
 * moves those rows across.
 *
 * Guarded so it runs at most once per (browser, user) pair: the claim is
 * idempotent server-side, but there is no reason to fire it on every load.
 */
export function useClaimProgress() {
  const { user, isSignedIn, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id || inFlight.current) return;

    let anonymousId: string | null = null;
    let alreadyClaimed: string | null = null;
    try {
      anonymousId = localStorage.getItem("sf_session_id");
      alreadyClaimed = localStorage.getItem(CLAIMED_KEY);
    } catch {
      return; // storage unavailable — nothing to migrate
    }

    if (!anonymousId || alreadyClaimed === user.id) return;

    inFlight.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/account/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: anonymousId }),
        });
        if (res.ok) {
          try {
            localStorage.setItem(CLAIMED_KEY, user.id);
          } catch {
            // Non-fatal: the claim succeeded, we just may re-run it later.
          }
          // Progress/plans/settings all changed owner — refetch everything
          // rather than leave the UI showing the pre-sign-in cache.
          queryClient.invalidateQueries();
        }
      } catch {
        // Leave the flag unset so the next load retries.
      } finally {
        inFlight.current = false;
      }
    })();
  }, [isLoaded, isSignedIn, user?.id, queryClient]);
}

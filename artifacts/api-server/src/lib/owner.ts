import { getAuth } from "@clerk/express";
import type { Request } from "express";

/**
 * Resolves who a request's data belongs to.
 *
 * Before this existed, every row was keyed to a UUID the browser generated and
 * kept in localStorage. That had two consequences: clearing site data or moving
 * to another device silently created a brand-new student with no XP or streak,
 * and — because the key arrived as a query parameter — any client could read or
 * write any other student's rows just by guessing one.
 *
 * Now the server decides. A signed-in request is keyed to the verified Clerk
 * user, which is stable across devices and cannot be spoofed by the client.
 * Anonymous visitors still work, falling back to their localStorage id, so the
 * site stays usable logged-out.
 *
 * Clerk's session cookie rides along automatically: the API is same-origin, and
 * fetch sends cookies for same-origin requests by default.
 */

/** Prefix keeps Clerk-owned keys from ever colliding with a raw UUID. */
const CLERK_PREFIX = "clerk:";

export function clerkOwnerKey(userId: string): string {
  return `${CLERK_PREFIX}${userId}`;
}

export function isClerkOwnerKey(key: string): boolean {
  return key.startsWith(CLERK_PREFIX);
}

/**
 * The owner key to read and write rows under.
 *
 * Returns null when the request is anonymous AND supplied no usable session id,
 * which callers should treat as a 400 rather than silently reading nothing.
 */
export function resolveOwnerKey(
  req: Request,
  clientSessionId: unknown,
): string | null {
  const { userId } = getAuth(req);
  if (userId) return clerkOwnerKey(userId);

  return typeof clientSessionId === "string" && clientSessionId.trim()
    ? clientSessionId.trim()
    : null;
}

/** The signed-in Clerk user id, or null when anonymous. */
export function currentUserId(req: Request): string | null {
  return getAuth(req).userId ?? null;
}

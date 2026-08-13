/**
 * A thin typed client for the endpoints this pass added or extended.
 *
 * Why not the generated client? Because the generated one is produced by Orval
 * from `lib/api-spec/openapi.yaml`, and regenerating it is a step only the
 * repo owner can run. Several routes in this app already call the API with
 * plain `fetch` for exactly that reason — `/api/analytics`, `/api/account/*`,
 * `/api/leaderboard`, `/api/events`, `/api/feedback` — so this follows the
 * convention that is already here rather than inventing a second one.
 *
 * Response *types* still come from the generated package wherever a shape
 * already exists, so there is one definition of `StudyAnswer` in the codebase,
 * not two.
 */

export class StudyApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "StudyApiError";
    this.status = status;
  }
}

/**
 * The message a student should see. Never the raw body: a 500 with a stack
 * trace in it is not something to put in front of someone revising.
 */
function friendlyMessage(status: number, body: unknown): string {
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    const error = (body as { error: string }).error;
    // Server-authored messages are written for students; pass those through.
    if (error.length < 200) return error;
  }
  if (status === 429) return "That was a lot of requests at once. Give it a few seconds.";
  if (status === 503) return "This part of StudyFilter is unavailable right now.";
  if (status >= 500) return "Something went wrong on our side. Try again.";
  if (status === 404) return "We couldn't find that.";
  return "That request didn't go through.";
}

export async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...init,
    });
  } catch {
    // Offline, DNS failure, request aborted by a navigation.
    throw new StudyApiError(0, "You appear to be offline. Check your connection.");
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new StudyApiError(response.status, friendlyMessage(response.status, parsed));
  }
  return parsed as T;
}

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new StudyApiError(0, "You appear to be offline. Check your connection.");
  }
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    throw new StudyApiError(response.status, friendlyMessage(response.status, parsed));
  }
  return parsed as T;
}

/** Turns any thrown value into a sentence safe to render. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof StudyApiError) return error.message;
  if (error instanceof Error && error.message && error.message.length < 200) return error.message;
  return fallback;
}

import OpenAI from "openai";
import type { Logger } from "pino";

export const OPENAI_MODEL = process.env.OPENAI_ANSWER_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";

/**
 * Reasoning models (o1/o3/o4/gpt-5 family) spend part of max_completion_tokens
 * on hidden reasoning before writing visible content. Left at the API default
 * ("medium"+), reasoning can consume the entire budget and leave zero tokens
 * for the actual JSON output (finish_reason "length", empty content). Passing
 * reasoning_effort is rejected by non-reasoning models, so only apply it when
 * OPENAI_MODEL is actually a reasoning model.
 */
export function isReasoningModel(model: string): boolean {
  return /^(o1|o3|o4|gpt-5)/i.test(model);
}

export const REASONING_EFFORT_PARAMS = isReasoningModel(OPENAI_MODEL)
  ? ({ reasoning_effort: "low" } as const)
  : ({} as const);

export function getOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}

export function missingApiKeyResponse() {
  return {
    error: "OpenAI API key missing. Add OPENAI_API_KEY in Replit Secrets.",
  };
}

/**
 * `maxRetries: 0` is the important part.
 *
 * The SDK defaults to 2 retries and retries on timeout, so a call carrying
 * `{ timeout: 7_000 }` did not take at most 7 seconds — it took 7, then 7,
 * then 7 again, plus backoff, and surfaced as an APIConnectionTimeoutError
 * at ~23s. Every per-call timeout in study.ts was silently a third of the
 * real wall-clock bound, which is why a 9.5s budget produced 23-second
 * requests and 500s.
 *
 * With retries off, a timeout means what it says. That does give up the
 * SDK's automatic retry of transient 429/5xx responses; for this product
 * failing fast and letting the student retry beats holding a request open
 * for half a minute.
 */
export function getOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, maxRetries: 0 });
}

/**
 * Safely parses a JSON object out of an OpenAI chat completion's message
 * content. Logs the raw output server-side on failure instead of throwing
 * a generic error, so callers can return a friendly frontend message.
 */
export function safeParseOpenAIJson(
  completion: OpenAI.Chat.ChatCompletion,
  log?: Logger,
): Record<string, unknown> | null {
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    log?.error({ completion }, "OpenAI returned empty content");
    return null;
  }
  const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log?.error({ rawOutput: content }, "No JSON object found in OpenAI response");
    return null;
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    log?.error({ err, rawOutput: content }, "Failed to parse JSON from OpenAI response");
    return null;
  }
}

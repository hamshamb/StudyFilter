import { distanceKm, stateAt } from "./geo";
import { DEFAULT_TOLERANCE_KM, type MapQuestion } from "./questions";

export type MapVerdict = "correct" | "close" | "wrong";

export interface MapResult {
  verdict: MapVerdict;
  /** Distance from the target, for point questions. */
  distanceKm: number | null;
  /** State the student actually clicked in, if any. */
  clickedState: string | null;
  message: string;
}

/**
 * Grades a click.
 *
 * Deliberately generous. Nobody recalls Dandi to the kilometre, and the board
 * does not expect them to — the skill being tested is knowing roughly where
 * something is and, above all, which state it belongs to. So:
 *
 *  - a state question is correct anywhere inside that state;
 *  - a point question is correct inside a generous radius, regardless of which
 *    side of a nearby border it falls on;
 *  - landing in the right state but well outside the radius is "close", worth
 *    saying so rather than marking wrong outright;
 *  - landing in a different state is wrong, and says which one.
 *
 * Distance is checked BEFORE the state, on purpose. Many map items are ports,
 * which sit on the coastline — at the resolution the boundaries are simplified
 * to, a correct click on a port can fall marginally offshore, outside every
 * polygon. Grading on the state first would mark those wrong forever.
 */
export function gradeMapAnswer(
  question: MapQuestion,
  click: { lng: number; lat: number },
): MapResult {
  const clickedState = stateAt(click.lng, click.lat);

  if (question.kind === "state") {
    if (clickedState === question.state) {
      return {
        verdict: "correct",
        distanceKm: null,
        clickedState,
        message: `Correct — that's ${question.state}.`,
      };
    }
    return {
      verdict: "wrong",
      distanceKm: null,
      clickedState,
      message: clickedState
        ? `That's ${clickedState}. The answer is ${question.state}.`
        : `That's outside India. The answer is ${question.state}.`,
    };
  }

  // Point question.
  if (typeof question.lng !== "number" || typeof question.lat !== "number") {
    return {
      verdict: "wrong",
      distanceKm: null,
      clickedState,
      message: "This question has no target set.",
    };
  }

  const target = { lng: question.lng, lat: question.lat };
  const d = distanceKm(click, target);
  const tolerance = question.toleranceKm ?? DEFAULT_TOLERANCE_KM;

  if (d <= tolerance) {
    return {
      verdict: "correct",
      distanceKm: d,
      clickedState,
      message:
        d < tolerance / 3
          ? `Spot on — about ${Math.round(d)} km off.`
          : `Correct — about ${Math.round(d)} km off, well within range.`,
    };
  }

  if (clickedState && clickedState === question.state) {
    return {
      verdict: "close",
      distanceKm: d,
      clickedState,
      message: `Right state, but about ${Math.round(d)} km away. Look again within ${question.state}.`,
    };
  }

  return {
    verdict: "wrong",
    distanceKm: d,
    clickedState,
    message: clickedState
      ? `That's in ${clickedState} — this one is in ${question.state}.`
      : `That's outside India — this one is in ${question.state}.`,
  };
}

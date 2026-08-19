import type { ParkState } from "@/lib/types";

/**
 * PLACEHOLDER SILHOUETTES.
 *
 * The real asset is 30 traced outfield-wall outlines -- Fenway's Monster
 * corner, PNC's notch, Houston's angles -- normalised to a common bounding box
 * at a single stroke weight. That is the signature element of the whole product
 * and deserves real illustration work, not procedural generation.
 *
 * These eight are stand-ins with the right silhouette character so the state
 * system, the legend, and the layout can be built and tested now. Each is drawn
 * in a 0..24 box with the "home plate" corner at bottom-centre.
 */
const SHAPES = [
  // 0 - symmetrical, gentle arc
  "M3 20 L3 11 Q12 3 21 11 L21 20 L12 23 Z",
  // 1 - tall flat left wall, the Fenway-ish one
  "M3 20 L3 4 L10 4 L10 9 Q17 10 21 14 L21 20 L12 23 Z",
  // 2 - angled corner cut
  "M3 20 L3 12 L9 5 L18 5 L21 12 L21 20 L12 23 Z",
  // 3 - deep centre notch
  "M3 20 L3 11 L8 11 L8 6 L16 6 L16 11 L21 11 L21 20 L12 23 Z",
  // 4 - rounded bowl
  "M3 20 L3 13 Q12 4 21 13 L21 20 L12 23 Z",
  // 5 - offset right pocket
  "M3 20 L3 10 Q10 5 15 7 L21 9 L21 20 L12 23 Z",
  // 6 - stepped right field
  "M3 20 L3 10 L11 5 L17 8 L17 13 L21 13 L21 20 L12 23 Z",
  // 7 - wide shallow
  "M3 20 L3 14 Q7 7 12 7 Q17 7 21 14 L21 20 L12 23 Z",
];

export function fingerprintPath(index: number): string {
  return SHAPES[index % SHAPES.length];
}

/**
 * Which surface the mark sits on. The palette has a dark map surface and a
 * light browsing surface, and the hollow states are drawn in chalk -- which is
 * the same value as the paper background. Without this the asterisked and
 * not-done marks are literally invisible on a park page.
 */
export type Surface = "ink" | "paper";

/**
 * Shape carries the state; colour is secondary. Solid / hollow / dashed stay
 * distinguishable in greyscale, which is the accessibility requirement.
 */
export function fingerprintStyle(state: ParkState, surface: Surface = "ink") {
  const hollow = surface === "paper" ? "var(--color-paper-muted)" : "var(--color-not-done)";
  const strong = surface === "paper" ? "var(--color-paper-ink)" : "var(--color-chalk)";

  switch (state) {
    case "done":
      return { fill: "var(--color-accent)", stroke: strong, strokeWidth: 1, dash: undefined, dot: strong };
    case "done-asterisk":
      return { fill: "none", stroke: strong, strokeWidth: 2.5, dash: undefined, dot: strong };
    case "temporary":
      return { fill: "none", stroke: hollow, strokeWidth: 2.5, dash: "3 2.5", dot: strong };
    case "not-done":
    default:
      return { fill: "none", stroke: hollow, strokeWidth: 2.5, dash: undefined, dot: strong };
  }
}

interface Props {
  index: number;
  state: ParkState;
  size?: number;
  className?: string;
  surface?: Surface;
}

/** Standalone fingerprint, for legends and page headers. */
export function Fingerprint({ index, state, size = 24, className, surface = "ink" }: Props) {
  const s = fingerprintStyle(state, surface);
  return (
    <svg viewBox="0 0 24 26" width={size} height={(size * 26) / 24} className={className} aria-hidden="true">
      <path
        d={fingerprintPath(index)}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeDasharray={s.dash}
        strokeLinejoin="round"
      />
      {state === "done-asterisk" && <circle cx="21.5" cy="4.5" r="2.6" fill={s.dot} />}
    </svg>
  );
}

import type { ParkState } from "@/lib/types";

/**
 * ORIGINAL STYLIZED OUTLINES — not team logos, not traced from any one park.
 *
 * Team marks and wordmarks are trademarked regardless of personal or
 * non-commercial use, so they are never used anywhere in this product. These
 * are asymmetric wall-notch shapes that evoke the quirks of real outfield walls
 * without reproducing any specific one.
 *
 * If true per-park uniqueness is wanted later, the route is commissioned or
 * hand-traced architectural silhouettes of outfield-wall footprints -- still
 * not logos -- normalised to one bounding box and stroke weight.
 *
 * Each is drawn in a 0..24 box with the home-plate corner at bottom-centre.
 */
const SHAPES = [
  // 0 - symmetrical, gentle arc
  "M3 20 L3 11 Q12 3 21 11 L21 20 L12 23 Z",
  // 1 - tall flat left wall
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
 * Shape carries the state; colour is secondary. Solid / hollow / dashed stay
 * distinguishable in greyscale, which is the accessibility requirement.
 *
 * Everything sits on cream now, so there is one set of colours rather than a
 * light and a dark variant.
 */
export function fingerprintStyle(state: ParkState) {
  switch (state) {
    case "done":
      return {
        fill: "var(--color-accent)",
        stroke: "var(--color-ink)",
        strokeWidth: 1.5,
        dash: undefined,
      };
    case "done-asterisk":
      return {
        fill: "var(--color-accent)",
        stroke: "var(--color-ink)",
        strokeWidth: 1.5,
        dash: undefined,
      };
    case "temporary":
      return {
        fill: "none",
        stroke: "var(--color-not-done)",
        strokeWidth: 2,
        dash: "3 2.5",
      };
    case "not-done":
    default:
      return {
        fill: "none",
        stroke: "var(--color-not-done)",
        strokeWidth: 2,
        dash: undefined,
      };
  }
}

interface Props {
  index: number;
  state: ParkState;
  size?: number;
  className?: string;
}

/** Standalone mark, for legends and page headers. */
export function Fingerprint({ index, state, size = 24, className }: Props) {
  const s = fingerprintStyle(state);
  return (
    <svg
      viewBox="0 0 24 26"
      width={size}
      height={(size * 26) / 24}
      className={className}
      aria-hidden="true"
    >
      <path
        d={fingerprintPath(index)}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeDasharray={s.dash}
        strokeLinejoin="round"
      />
      {/* Gold is the second accent and marks exactly one thing: the team is
          checked off but this park has replaced the one they were seen at. */}
      {state === "done-asterisk" && (
        <circle cx="21" cy="4.5" r="3" fill="var(--color-gold)" stroke="var(--color-ink)" strokeWidth="1" />
      )}
    </svg>
  );
}

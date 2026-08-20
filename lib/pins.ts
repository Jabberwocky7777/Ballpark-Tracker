/**
 * Pin geometry. Deliberately free of any dependency on the projection or the
 * topology: this is pure maths, and keeping it separate means the unit tests
 * don't have to parse a megabyte of atlas JSON to check the arithmetic.
 */

export interface ProjectedVenue {
  id: string;
  x: number;
  y: number;
  /** True position, kept so the pin can be tethered back to its real spot. */
  anchorX: number;
  anchorY: number;
  nudged: boolean;
}


/**
 * Push overlapping pins apart.
 *
 * Several parks sit within a few pixels of each other at this scale -- Globe
 * Life Field is 0.1px from the park it replaced, and Yankee Stadium, Citi
 * Field, Wrigley and Rate Field are all inside a single pin's width of a
 * neighbour. Without this, whole parks are invisible underneath other parks
 * and simply cannot be clicked.
 *
 * Deterministic: sorted input, fixed iteration count, no randomness, so the
 * server and client agree and the map doesn't jitter between renders.
 */
export function separatePins(
  pins: ProjectedVenue[],
  minDistance = 18,
  maxDisplacement = 26,
): ProjectedVenue[] {
  const out = [...pins]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => ({ ...p }));

  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist >= minDistance) continue;

        // Exactly coincident points have no direction to separate along.
        // Derive a stable one from the ids so the result is reproducible.
        if (dist < 0.001) {
          const angle = ((a.id.charCodeAt(0) + b.id.charCodeAt(0)) % 360) * (Math.PI / 180);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }

        const push = (minDistance - dist) / 2;
        const ux = (dx / dist) * push;
        const uy = (dy / dist) * push;
        a.x -= ux;
        a.y -= uy;
        b.x += ux;
        b.y += uy;
        a.nudged = true;
        b.nudged = true;
        moved = true;
      }
    }

    // Cap how far a pin may drift from its real location. Without this the
    // dense northeast pushes pins halfway across neighbouring states, which
    // looks wrong to anyone who knows where these cities are -- the map stops
    // being a map. Clamping inside the loop lets the system settle against the
    // constraint rather than being yanked back at the end.
    for (const p of out) {
      const dx = p.x - p.anchorX;
      const dy = p.y - p.anchorY;
      const drift = Math.hypot(dx, dy);
      if (drift > maxDisplacement) {
        const k = maxDisplacement / drift;
        p.x = p.anchorX + dx * k;
        p.y = p.anchorY + dy * k;
      }
    }

    if (!moved) break;
  }

  // A pin that never actually moved should not draw a tether to itself.
  for (const p of out) {
    if (Math.hypot(p.x - p.anchorX, p.y - p.anchorY) < 0.5) {
      p.x = p.anchorX;
      p.y = p.anchorY;
      p.nudged = false;
    }
  }

  return out;
}

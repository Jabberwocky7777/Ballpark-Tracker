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
 * The pin nearest a point, within a grab radius. Null when the point is not
 * near anything.
 *
 * This is the whole of the map's hit testing, and it replaced a transparent
 * circle on each pin. Those circles were fifteen units across while the
 * crowded pairs sit ten units apart, so they covered each other and the click
 * went to whichever pin was painted last: aiming at Angel Stadium selected
 * Dodger Stadium, and Rate Field, Yankee Stadium and Nationals Park could not
 * be selected at all.
 *
 * Nearest-centre gives every point on the map to exactly one pin -- the one it
 * is closest to -- so two parks drawn almost on top of each other still own
 * their own halves of the space between them.
 *
 * Ties are broken by id so the result cannot depend on array order, which is
 * what paint order was doing wrong in the first place.
 */
export function nearestPin<T extends { id: string; x: number; y: number }>(
  pins: readonly T[],
  x: number,
  y: number,
  grabRadius: number,
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;

  for (const pin of pins) {
    const d = Math.hypot(pin.x - x, pin.y - y);
    if (d > grabRadius) continue;
    if (d < bestDistance || (d === bestDistance && best !== null && pin.id < best.id)) {
      bestDistance = d;
      best = pin;
    }
  }

  return best;
}

/**
 * Push overlapping pins apart.
 *
 * Kept deliberately gentle. San Francisco and Sacramento are about 120km apart,
 * which is only seven units at this scale, so a large separation distance
 * shoves them to opposite sides of where they belong -- and on a coastline that
 * puts a park in the Pacific. Pins are allowed to overlap slightly instead:
 * two shapes touching still reads as two parks, whereas a park in the ocean
 * reads as a bug.
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
  minDistance = 10,
  maxDisplacement = 10,
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

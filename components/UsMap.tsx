"use client";

import { useState } from "react";
import Link from "next/link";
import { fingerprintPath, fingerprintStyle } from "./Fingerprint";
import type { ParkState } from "@/lib/types";

export interface MapPin {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  /** Drawn position, possibly nudged away from a neighbour. */
  x: number;
  y: number;
  /** True projected position. */
  anchorX: number;
  anchorY: number;
  nudged: boolean;
  parkState: ParkState;
  fingerprint: number;
  blurb: string;
  /** Set on an asterisked park: the franchise that moved here. */
  newParkFor: string | null;
}

interface Props {
  width: number;
  height: number;
  statePaths: string[];
  neighbourPaths: string[];
  pins: MapPin[];
}

const PIN_W = 19;
const PIN_H = (PIN_W * 26) / 24;
/** The silhouette's home-plate tip sits at y=23 of the 26-unit box. */
const TIP_Y = (PIN_H * 23) / 26;

const STATE_LABEL: Record<ParkState, string> = {
  done: "visited",
  "done-asterisk": "not visited, new park",
  "not-done": "not visited",
  temporary: "not visited, temporary venue",
};

export function UsMap({ width, height, statePaths, neighbourPaths, pins }: Props) {
  const [selected, setSelected] = useState<MapPin | null>(null);

  // Done pins render last so they sit above the hollow ones where the
  // northeast gets crowded.
  const ordered = [...pins].sort((a, b) => {
    const rank = (p: MapPin) => (p.parkState === "done" ? 2 : p.parkState === "done-asterisk" ? 1 : 0);
    return rank(a) - rank(b);
  });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block"
        // Deliberately not role="img": that collapses the whole map into a
        // single image node and hides all 30-plus interactive pins from
        // assistive technology.
        role="group"
        aria-label="Map of MLB ballparks. Each pin links to a park."
      >
        <rect width={width} height={height} fill="var(--color-ink-deep)" />

        {neighbourPaths.map((d, i) => (
          <path key={`n${i}`} d={d} fill="var(--color-ink)" />
        ))}
        {statePaths.map((d, i) => (
          <path
            key={`s${i}`}
            d={d}
            fill="var(--color-ink-panel)"
            stroke="var(--color-ink-line)"
            strokeWidth={0.7}
          />
        ))}

        {/* Tethers first, so they sit under every pin. */}
        {ordered
          .filter((p) => p.nudged)
          .map((p) => (
            <g key={`t${p.id}`}>
              <line
                x1={p.anchorX}
                y1={p.anchorY}
                x2={p.x}
                y2={p.y}
                stroke="var(--color-chalk-dim)"
                strokeWidth={0.6}
              />
              <circle cx={p.anchorX} cy={p.anchorY} r={0.9} fill="var(--color-chalk-dim)" />
            </g>
          ))}

        {ordered.map((pin) => {
          const s = fingerprintStyle(pin.parkState, "ink");
          const tx = pin.x - PIN_W / 2;
          const ty = pin.y - TIP_Y;
          const label = `${pin.name}, ${pin.city} — ${STATE_LABEL[pin.parkState]}`;
          const shape = (
            <>
              <rect
                className="pin-focus"
                x={-3}
                y={-3}
                width={PIN_W + 6}
                height={PIN_H + 6}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                rx={2}
                opacity={0}
              />
              <path
                d={fingerprintPath(pin.fingerprint)}
                transform={`scale(${PIN_W / 24})`}
                fill={s.fill}
                stroke={s.stroke}
                strokeWidth={s.strokeWidth}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {pin.parkState === "done-asterisk" && (
                <circle cx={PIN_W - 1.5} cy={2.5} r={2.4} fill={s.dot} />
              )}
            </>
          );

          return pin.parkState === "done" ? (
            <Link key={pin.id} href={`/park/${pin.slug}`} aria-label={label}>
              <g transform={`translate(${tx} ${ty})`} className="cursor-pointer">
                {shape}
              </g>
            </Link>
          ) : (
            <g
              key={pin.id}
              transform={`translate(${tx} ${ty})`}
              role="button"
              tabIndex={0}
              aria-label={label}
              className="cursor-pointer"
              onClick={() => setSelected(pin)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(pin);
                }
              }}
            >
              {shape}
            </g>
          );
        })}
      </svg>

      {selected && (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 z-40 bg-ink-deep/70"
            onClick={() => setSelected(null)}
          />
          <div
            role="dialog"
            aria-label={selected.name}
            className="shell fixed inset-x-0 bottom-0 z-50 border-t border-ink-line bg-ink-panel px-5 pb-7 pt-4"
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-chalk-dim" />
            <p className="label text-chalk-dim">Not yet</p>
            <h2 className="display mt-1 text-[22px] leading-tight text-chalk">{selected.name}</h2>
            <p className="tabular mt-0.5 text-[12px] text-chalk-muted">
              {selected.city}, {selected.state}
            </p>
            <p className="mt-3 text-[14px] text-chalk-muted">{selected.blurb}</p>
            {selected.newParkFor && (
              <p className="mt-3 text-[13px] text-chalk-muted">
                New park since your visit — the {selected.newParkFor} moved here.
              </p>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-5 w-full border border-ink-line py-2.5 text-[13px] text-chalk-muted hover:text-chalk"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

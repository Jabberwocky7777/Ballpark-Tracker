"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fingerprintPath, fingerprintStyle } from "./Fingerprint";
import type { ParkState } from "@/lib/types";
import { nearestPin } from "@/lib/pins";

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
  /**
   * A published photo of this park, if one exists, for the hover preview.
   *
   * Deliberately sourced from the couple's own library. Aerial-photo
   * directories are copyrighted, so nothing is scraped or hot-linked: the slot
   * stays empty until a photo is uploaded and published.
   */
  heroPhotoId: string | null;
  /**
   * A freely-licensed stand-in from Wikimedia Commons, shown until they publish
   * a photo of their own. The credit is a condition of the licence, so it
   * travels with the image rather than being optional chrome.
   */
  reference: { file: string; author: string; licence: string } | null;
}

interface Props {
  width: number;
  height: number;
  statePaths: string[];
  neighbourPaths: string[];
  pins: MapPin[];
}

const PIN_W = 16;
const PIN_H = (PIN_W * 26) / 24;
/**
 * These shapes are blobs rather than teardrop pins, so they are centred on the
 * coordinate rather than balanced on their bottom tip. Tip-anchoring put the
 * whole visible mass north of the city, which read as every park sitting a
 * little too far up the map.
 */
const CENTRE_Y = PIN_H / 2;

const CARD_W = 170;

const STATE_LABEL: Record<ParkState, string> = {
  done: "visited",
  "done-asterisk": "not visited, new park",
  "not-done": "not visited",
  temporary: "not visited, temporary venue",
};

/**
 * How far from a pin's centre the pointer still counts as aiming at it.
 * Bounded so that clicking empty Nevada selects nothing, rather than the
 * nearest park two states away.
 */
const GRAB_RADIUS = 26;

export function UsMap({ width, height, statePaths, neighbourPaths, pins }: Props) {
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [hovered, setHovered] = useState<MapPin | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  /**
   * Pointer position to the pin it is aiming at. The choosing itself lives in
   * lib/pins.ts with its tests; this only converts client pixels into viewBox
   * units, since the map scales with the column width.
   */
  function pinNear(clientX: number, clientY: number): MapPin | null {
    const svg = svgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return nearestPin(
      pins,
      ((clientX - rect.left) / rect.width) * width,
      ((clientY - rect.top) / rect.height) * height,
      GRAB_RADIUS,
    );
  }

  function activate(pin: MapPin) {
    if (pin.parkState === "done") router.push(`/park/${pin.slug}`);
    else setSelected(pin);
  }

  // Done pins render last so they sit above the hollow ones where the
  // northeast gets crowded.
  const ordered = [...pins].sort((a, b) => {
    const rank = (p: MapPin) => (p.parkState === "done" ? 2 : p.parkState === "done-asterisk" ? 1 : 0);
    return rank(a) - rank(b);
  });

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full"
        style={{ cursor: hovered ? "pointer" : "default" }}
        onPointerMove={(e) => setHovered(pinNear(e.clientX, e.clientY))}
        onPointerLeave={() => setHovered(null)}
        onClick={(e) => {
          const pin = pinNear(e.clientX, e.clientY);
          if (pin) activate(pin);
        }}
        // Deliberately not role="img": that collapses the whole map into a
        // single image node and hides all 30-plus interactive pins from
        // assistive technology.
        role="group"
        aria-label="Map of MLB ballparks. Each pin links to a park."
      >
        {/* The inset well: one shade darker than the page, so it reads as a
            panel within the page rather than a change of mode. */}
        <rect width={width} height={height} fill="var(--color-paper-inset)" />

        {neighbourPaths.map((d, i) => (
          <path key={`n${i}`} d={d} fill="var(--color-paper-line)" />
        ))}
        {statePaths.map((d, i) => (
          <path
            key={`s${i}`}
            d={d}
            fill="var(--color-paper)"
            stroke="var(--color-paper-line)"
            strokeWidth={0.8}
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
                stroke="var(--color-not-done)"
                strokeWidth={0.7}
              />
              <circle cx={p.anchorX} cy={p.anchorY} r={1} fill="var(--color-not-done)" />
            </g>
          ))}

        {ordered.map((pin) => {
          const s = fingerprintStyle(pin.parkState);
          const tx = pin.x - PIN_W / 2;
          const ty = pin.y - CENTRE_Y;
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
              {/* Gold is the second accent and marks exactly one thing. */}
              {pin.parkState === "done-asterisk" && (
                <circle
                  cx={PIN_W - 2}
                  cy={3}
                  r={3}
                  fill="var(--color-gold)"
                  stroke="var(--color-ink)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </>
          );

          // Keyboard only. Pointer hit testing happens once, on the svg, by
          // nearest centre -- so every pin here is transparent to the pointer
          // and cannot take a click that belongs to its neighbour. Focus,
          // Enter, the focus ring and the accessible name all still work:
          // pointer-events has no bearing on any of them.
          const keyboard = {
            onFocus: () => setHovered(pin),
            onBlur: () => setHovered((h) => (h?.id === pin.id ? null : h)),
            pointerEvents: "none" as const,
          };

          return pin.parkState === "done" ? (
            <Link key={pin.id} href={`/park/${pin.slug}`} aria-label={label} {...keyboard}>
              <g transform={`translate(${tx} ${ty})`}>{shape}</g>
            </Link>
          ) : (
            <g
              key={pin.id}
              transform={`translate(${tx} ${ty})`}
              role="button"
              tabIndex={0}
              aria-label={label}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(pin);
                }
              }}
              {...keyboard}
            >
              {shape}
            </g>
          );
        })}

        {/* The true location of any pin that had to be nudged aside, drawn
            last so it is not buried under the pin that moved. The tether line
            underneath is hidden by the pin body at these distances, which made
            the displacement silent: the map quietly showed a park a few miles
            from where it is, with nothing to say so. This dot is the honest
            bit -- the pin is approximate, the dot is exact. */}
        {ordered
          .filter((p) => p.nudged)
          .map((p) => (
            <circle
              key={`a${p.id}`}
              cx={p.anchorX}
              cy={p.anchorY}
              r={1.1}
              fill="var(--color-ink)"
              opacity={0.55}
              pointerEvents="none"
            />
          ))}
      </svg>

      {/* Hover preview, positioned as a percentage of the map so it tracks the
          pin at any width. Pointer-events off so it never eats the click.
          Desktop only -- there is no hover on a phone, which is what the bottom
          sheet is for. */}
      {hovered && (() => {
        // The card opens away from the nearest edge rather than being centred
        // and clamped. Centring put the west-coast parks' cards off the left of
        // the map entirely; anchoring the near edge to the pin means the card
        // always grows into the space that exists.
        const xPct = (hovered.x / width) * 100;
        const yPct = (hovered.y / height) * 100;

        const side = xPct < 30 ? "right" : xPct > 70 ? "left" : "centre";
        const shiftX =
          side === "right" ? "-14px" : side === "left" ? "calc(-100% + 14px)" : "-50%";
        // A park near the top has no room above it, so the card drops below.
        const below = yPct < 34;

        return (
          <div
            className="pointer-events-none absolute z-30 hidden sm:block"
            style={{
              width: CARD_W,
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: `translateX(${shiftX}) translateY(${below ? "10px" : "calc(-100% - 14px)"})`,
            }}
          >
            <div className="overflow-hidden rounded-[3px] border border-paper-line bg-card shadow-md">
              <PreviewImage
                photoId={hovered.heroPhotoId}
                reference={hovered.reference}
                name={hovered.name}
              />
              <p className="display px-2 py-1.5 text-[11px] leading-tight">{hovered.name}</p>
              <p className="tabular px-2 text-[9px] text-muted">
                {hovered.city}, {hovered.state}
              </p>
              {!hovered.heroPhotoId && hovered.reference && (
                <p className="px-2 pb-1.5 pt-1 text-[8px] leading-tight text-muted">
                  {hovered.reference.author} · {hovered.reference.licence}
                </p>
              )}
              {(hovered.heroPhotoId || !hovered.reference) && <div className="pb-1.5" />}
            </div>
          </div>
        );
      })()}

      {selected && (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 z-40 bg-ink/40"
            onClick={() => setSelected(null)}
          />
          <div
            role="dialog"
            aria-label={selected.name}
            className="shell fixed inset-x-0 bottom-0 z-50 border-t border-paper-line bg-paper px-5 pb-7 pt-4"
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-paper-line" />
            <p className="label text-muted">Not yet</p>
            <h2 className="display mt-1 text-[20px]">{selected.name}</h2>
            <p className="tabular mt-0.5 text-[12px] text-muted">
              {selected.city}, {selected.state}
            </p>
            <p className="mt-3 text-[14px] text-ink-body">{selected.blurb}</p>
            {selected.newParkFor && (
              <p className="mt-3 flex items-start gap-2 text-[13px] text-muted">
                <span
                  className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-gold"
                  aria-hidden="true"
                />
                New park since your visit — the {selected.newParkFor} moved here.
              </p>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-5 w-full border border-paper-line py-2.5 text-[13px] text-muted hover:text-ink"
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The image slot. Empty until a photo of this park is uploaded and published --
 * a slot for their own photos, not a hole waiting on a scraper.
 */
function PreviewImage({
  photoId,
  reference,
  name,
}: {
  photoId: string | null;
  reference: { file: string; author: string; licence: string } | null;
  name: string;
}) {
  // Their own photo always wins over the borrowed one.
  const src = photoId ? `/api/photo/${photoId}/thumb` : reference?.file;

  if (!src) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center bg-paper-inset">
        <span className="label px-2 text-center text-[8px] leading-tight text-muted">
          No photo yet
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className="aspect-[16/10] w-full bg-paper-inset object-cover"
    />
  );
}

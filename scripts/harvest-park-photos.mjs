#!/usr/bin/env node
/**
 * Finds freely-licensed ballpark photos and builds a contact sheet to pick from.
 *
 *   npm run harvest:photos            # gather candidates + a contact sheet to look at
 *   npm run harvest:photos -- --venue wrigley
 *
 * Why: the map's hover preview wants a photo of each park, and ballpark
 * photo directories are copyrighted. Wikimedia Commons is the one large source
 * where the licence is machine-readable and redistribution is permitted so long
 * as the attribution travels with the image.
 *
 * The wanted angle is from behind home plate looking out to centre field --
 * what a batter sees. Commons has no camera-angle field and keyword scoring
 * alone returns concert panoramas and photos of press boxes, so this gathers
 * from two better sources and then makes a contact sheet, because the licence
 * is machine-readable and the angle is not.
 *
 *   1. the English Wikipedia article's lead image, which is curated and is
 *      very often the classic view in from the plate
 *   2. the park's Commons category, which is hand-filed rather than searched
 *
 * Nothing is downloaded into the app here. This produces a list to review.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { venues } from "../lib/data/venues.ts";

// The scripts and their working files live together. Everything in here except
// picks.json is scratch and gitignored: a candidate dump and a sheet to look at.
const WORK_DIR = join("scripts", "photo-harvest");

const COMMONS = "https://commons.wikimedia.org/w/api.php";
const WIKIPEDIA = "https://en.wikipedia.org/w/api.php";
const UA = "BallparkTracker/0.1 (personal project; contact via GitHub Jabberwocky7777)";

/** Licences that permit redistribution with attribution. Everything else is out. */
const ALLOWED = [/^cc0/i, /^public domain/i, /^pd/i, /^cc by(?!-nc)[ -]?\d/i, /^cc by-sa[ -]?\d/i];
const isFree = (l) => Boolean(l) && ALLOWED.some((re) => re.test(l.trim()));

const stripHtml = (s) =>
  (s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Every call goes through here, serialised and spaced.
 *
 * Wikimedia rate-limits anonymous clients hard, and it does not fail loudly:
 * the first handful of parks came back fine and every one after that returned
 * an empty list, which reads as "no free photos exist" rather than "you were
 * throttled". Hence one request at a time, a real gap between them, and an
 * explicit retry rather than swallowing the error.
 */
let chain = Promise.resolve();
const GAP_MS = 1100;

function api(base, params) {
  const run = async () => {
    const url = `${base}?${new URLSearchParams({ format: "json", origin: "*", ...params })}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      const body = await res.text();
      if (res.ok && !body.startsWith("You are making too many requests")) {
        await sleep(GAP_MS);
        return JSON.parse(body);
      }
      const wait = 4000 * (attempt + 1);
      process.stderr.write(`[throttled, waiting ${wait / 1000}s] `);
      await sleep(wait);
    }
    throw new Error("rate limited after 4 attempts");
  };
  chain = chain.then(run, run);
  return chain;
}

/** Licence and author for a Commons file, or null when it is not reusable. */
async function fileMeta(fileTitle) {
  const data = await api(COMMONS, {
    action: "query",
    titles: fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "700",
  });
  const page = Object.values(data?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info) return null;

  const meta = info.extmetadata ?? {};
  const licence = stripHtml(meta.LicenseShortName?.value);
  if (!isFree(licence)) return null;
  if ((info.width ?? 0) < 900) return null;
  if (!/\.(jpe?g|png)$/i.test(page.title)) return null;

  return {
    file: page.title.replace(/^File:/, ""),
    licence,
    licenceUrl: stripHtml(meta.LicenseUrl?.value) || null,
    author: stripHtml(meta.Artist?.value).slice(0, 140),
    descriptionUrl: info.descriptionurl,
    previewUrl: info.thumburl,
    fullUrl: info.url,
    width: info.width,
    height: info.height,
    description: stripHtml(meta.ImageDescription?.value).slice(0, 180),
  };
}

/** The Wikipedia article's lead image -- curated, and usually the classic shot. */
async function leadImage(venueName) {
  try {
    const data = await api(WIKIPEDIA, {
      action: "query",
      titles: venueName,
      prop: "pageimages",
      piprop: "original|name",
      redirects: "1",
    });
    const page = Object.values(data?.query?.pages ?? {})[0];
    const name = page?.pageimage;
    return name ? await fileMeta(name) : null;
  } catch {
    return null;
  }
}

/** Files filed by hand into the park's Commons category. */
async function categoryFiles(venueName, limit = 14) {
  try {
    const data = await api(COMMONS, {
      action: "query",
      generator: "categorymembers",
      gcmtitle: `Category:${venueName}`,
      gcmtype: "file",
      gcmlimit: String(limit),
      prop: "imageinfo",
      iiprop: "url|extmetadata|size",
      iiurlwidth: "700",
    });
    const pages = Object.values(data?.query?.pages ?? {});
    const out = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata ?? {};
      const licence = stripHtml(meta.LicenseShortName?.value);
      if (!isFree(licence)) continue;
      if ((info.width ?? 0) < 900) continue;
      if (!/\.(jpe?g|png)$/i.test(page.title)) continue;
      out.push({
        file: page.title.replace(/^File:/, ""),
        licence,
        licenceUrl: stripHtml(meta.LicenseUrl?.value) || null,
        author: stripHtml(meta.Artist?.value).slice(0, 140),
        descriptionUrl: info.descriptionurl,
        previewUrl: info.thumburl,
        fullUrl: info.url,
        width: info.width,
        height: info.height,
        description: stripHtml(meta.ImageDescription?.value).slice(0, 180),
      });
    }
    return out;
  } catch {
    return [];
  }
}

const only = process.argv.includes("--venue")
  ? process.argv[process.argv.indexOf("--venue") + 1]
  : null;
const targets = only ? venues.filter((v) => v.id === only) : venues;

const out = {};
for (const venue of targets) {
  process.stderr.write(`${venue.id.padEnd(16)} `);
  const lead = await leadImage(venue.name);
  const cat = await categoryFiles(venue.name);

  const seen = new Set();
  const list = [];
  for (const c of [lead, ...cat].filter(Boolean)) {
    if (seen.has(c.file)) continue;
    seen.add(c.file);
    list.push({ ...c, isLead: c === lead });
  }

  out[venue.id] = { venue: venue.name, candidates: list };
  process.stderr.write(`${list.length} free candidate(s)${lead ? " (lead found)" : ""}\n`);
}

mkdirSync(WORK_DIR, { recursive: true });
writeFileSync(join(WORK_DIR, "candidates.json"), JSON.stringify(out, null, 2));

// Contact sheet: the only way to judge a camera angle is to look at it.
const cards = Object.entries(out)
  .map(([id, { venue, candidates }]) => {
    const imgs = candidates
      .map(
        (c, i) => `
      <figure>
        <img src="${c.previewUrl}" loading="lazy" alt="">
        <figcaption>
          <b>${id} #${i}</b>${c.isLead ? " <em>lead</em>" : ""}<br>
          ${c.file.slice(0, 60)}<br>
          <span>${c.licence}</span>
        </figcaption>
      </figure>`,
      )
      .join("");
    return `<section><h2>${venue} <code>${id}</code></h2><div class="row">${imgs}</div></section>`;
  })
  .join("\n");

writeFileSync(
  join(WORK_DIR, "contact-sheet.html"),
  `<!doctype html><meta charset="utf-8"><title>Park photo candidates</title>
<style>
body{font:13px system-ui;margin:20px;background:#f3efe4;color:#0f1b2e}
h2{font-size:15px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.05em}
code{color:#8a7a52;font-weight:400}
.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}
figure{margin:0;flex:0 0 260px}
img{width:260px;height:165px;object-fit:cover;border:1px solid #d9d2b8;background:#ece4d0}
figcaption{font-size:10px;line-height:1.35;color:#33372a;margin-top:4px}
figcaption span{color:#8a7a52}
</style>
<h1>Pick the view from behind home plate, out to centre field</h1>
${cards}`,
);

console.error(`\nWrote candidates.json and contact-sheet.html into ${WORK_DIR}`);
console.error("Open the contact sheet and pick by eye -- the licence is machine-readable, the angle is not.");

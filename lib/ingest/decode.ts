import "server-only";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { needsHeicDecode, type ImageFormat } from "./magic.ts";

/**
 * Turning whatever came off the phone into bytes sharp can resize.
 *
 * This is the open question from Phase 0 (docs/plan.md 4.2) answered as a
 * runtime chain rather than as a bet. `sharp`'s prebuilt binaries frequently
 * ship without libheif, and whether this particular image has it is a property
 * of the image, not of the code -- so all three candidate decoders are tried in
 * the plan's order of preference and the first that works wins.
 *
 * The winner is cached after the first success. Discovering it costs one failed
 * decode per boot, not one per photo, and it is logged so the answer ends up
 * somewhere visible instead of being rediscovered by the next person.
 *
 * JPEG, PNG, TIFF and WebP never come through here -- sharp reads those itself.
 */

type DecoderName = "sharp" | "heic-convert" | "pillow-heif";

interface Decoder {
  name: DecoderName;
  decode(input: Buffer): Promise<Buffer>;
}

const DECODERS: Decoder[] = [
  {
    name: "sharp",
    async decode(input) {
      const sharp = (await import("sharp")).default;
      // Fails fast and loudly when libvips has no libheif compiled in.
      return sharp(input).jpeg({ quality: 90 }).toBuffer();
    },
  },
  {
    name: "heic-convert",
    async decode(input) {
      const convert = (await import("heic-convert")).default;
      const out = await convert({ buffer: input, format: "JPEG", quality: 0.9 });
      return Buffer.from(out);
    },
  },
  {
    name: "pillow-heif",
    decode(input) {
      return runPythonSidecar(input);
    },
  },
];

let winner: DecoderName | null = null;

/**
 * Decodes to a buffer sharp can read. Non-HEIC input is returned untouched --
 * sharp handles it directly and a needless re-encode would only lose detail.
 *
 * Never call this in an HTTP request. A 50-photo batch of 12MP HEICs is
 * minutes of CPU and will time out through the proxy; that is what the job
 * queue is for.
 */
export async function decodeToRaster(input: Buffer, format: ImageFormat): Promise<Buffer> {
  if (!needsHeicDecode(format)) return input;

  // The known-good decoder first, then the rest in the plan's order, so a
  // later failure still falls through the whole chain rather than giving up.
  const order = winner
    ? [
        ...DECODERS.filter((d) => d.name === winner),
        ...DECODERS.filter((d) => d.name !== winner),
      ]
    : DECODERS;
  const failures: string[] = [];

  for (const decoder of order) {
    try {
      const out = await decoder.decode(input);
      if (!out?.length) throw new Error("decoder returned no bytes");
      if (winner !== decoder.name) {
        winner = decoder.name;
        console.log(`[decode] HEIC decoding via ${decoder.name}`);
      }
      return out;
    } catch (err) {
      failures.push(`${decoder.name}: ${(err as Error).message}`);
    }
  }

  // All three failed. This is the Phase 0 gate failing in production, so say
  // exactly which paths were tried -- the answer changes the stack.
  throw new Error(`no HEIC decoder available. Tried -- ${failures.join("; ")}`);
}

function runPythonSidecar(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const script = join(process.cwd(), "scripts", "heic_decode.py");
    const py = spawn("python3", [script]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];

    py.stdout.on("data", (d: Buffer) => out.push(d));
    py.stderr.on("data", (d: Buffer) => err.push(d));
    py.on("error", reject);
    py.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(new Error(Buffer.concat(err).toString().trim() || `exit ${code}`)),
    );
    py.stdin.on("error", reject);
    py.stdin.end(input);
  });
}

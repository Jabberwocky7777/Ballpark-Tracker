/**
 * `heic-convert` ships no types, and the second decoder in the chain should
 * not be the reason a dependency gets added.
 *
 * Only the shape decode.ts actually calls is declared. If a future call needs
 * more of the library's surface, widen it here rather than reaching for `any`
 * at the call site.
 */
declare module "heic-convert" {
  interface ConvertOptions {
    buffer: Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    /** 0 to 1. Ignored for PNG. */
    quality?: number;
  }

  function convert(options: ConvertOptions): Promise<ArrayBuffer>;

  export default convert;
}

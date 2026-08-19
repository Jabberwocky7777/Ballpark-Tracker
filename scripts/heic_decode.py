#!/usr/bin/env python3
"""Third-choice HEIC decode path: pillow-heif via stdin/stdout.

Used by scripts/spike-exif.mjs only if sharp and heic-convert both fail in the
container. Reads HEIC bytes on stdin, writes JPEG bytes on stdout. Touches no
files -- originals are immutable and nothing is written to the pools.
"""
import io
import sys


def main() -> int:
    try:
        from PIL import Image
        import pillow_heif
    except ImportError as e:
        print(f"pillow-heif not installed: {e}", file=sys.stderr)
        return 3

    pillow_heif.register_heif_opener()

    data = sys.stdin.buffer.read()
    if not data:
        print("no input on stdin", file=sys.stderr)
        return 2

    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=82)
    sys.stdout.buffer.write(out.getvalue())
    return 0


if __name__ == "__main__":
    sys.exit(main())

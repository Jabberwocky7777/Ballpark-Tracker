# syntax=docker/dockerfile:1
#
# Two useful targets:
#   --target spike   the Phase 0 HEIC/EXIF harness, run against real photos
#   --target runner  the app (default)
#
# No secrets are ever baked in. Every value arrives as runtime env from the app
# wizard, which is what makes a public image package safe.

# ---------------------------------------------------------------- base -------
FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# ---------------------------------------------------------------- deps -------
FROM base AS deps
# better-sqlite3 falls through to `node-gyp rebuild` on install rather than
# using its bundled prebuilds, so the toolchain has to be here. It stays in
# this stage only -- the runner copies the built node_modules and never sees a
# compiler.
RUN apt-get update  && apt-get install -y --no-install-recommends python3 make g++  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

# ---------------------------------------------------------------- build ------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nothing here reads runtime config: every page that touches the database or
# env is force-dynamic, so the build never needs a database or a secret.
RUN npm run build

# ---------------------------------------------------------------- spike ------
# Carries all three decode candidates from plan section 4.2 so a single run
# evaluates every one of them, inside the real image.
FROM base AS spike
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pil python3-pip \
 && pip3 install --break-system-packages --no-cache-dir pillow-heif \
 && apt-get purge -y python3-pip \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY scripts/ ./scripts/
# Reads only. Mount the photo directory read-only:
#   docker run --rm -v /path/to/photos:/in:ro <image> /in
ENTRYPOINT ["node", "scripts/spike-exif.mjs"]
CMD ["/in"]

# ---------------------------------------------------------------- runner -----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/config \
    ORIGINALS_DIR=/photos/originals \
    DERIVED_DIR=/photos/derived

# Do not set PUID/PGID -- TrueNAS assigns them. This user exists only so the
# process is not root; the mounts are governed by ZFS ACLs set in the UI.
RUN groupadd --system --gid 1001 app \
 && useradd --system --uid 1001 --gid app app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
# Migrations are .sql files; Next's tracer does not follow them, and
# instrumentation.ts reads them from disk at boot.
COPY --from=builder --chown=app:app /app/drizzle ./drizzle

# The mount points must exist before the volumes land on them.
RUN mkdir -p /config /photos/originals /photos/derived && chown -R app:app /config /photos

USER app
EXPOSE 3000

# Migrations and reference-data seeding run in instrumentation.ts when the
# server boots, so there is no entrypoint script to keep in sync.
CMD ["node", "server.js"]

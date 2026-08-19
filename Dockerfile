# syntax=docker/dockerfile:1
#
# Multi-stage. Phase 0 builds the `spike` target, which is the gate that decides
# whether this stack survives contact with real iPhone HEICs. The `runner` stage
# is scaffolded now and gets the Next.js build wired into it in Phase 1.
#
# No secrets are ever baked in. Every value arrives as runtime env from the app
# wizard, which is what makes a public image package safe.

# ---------------------------------------------------------------- base -------
FROM node:22-bookworm-slim AS base
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

# ---------------------------------------------------------------- deps -------
FROM base AS deps
COPY package.json package-lock.json* ./
# --include=dev is deliberate here: the spike needs the decode candidates, and
# the runner stage copies only what it needs from `prod-deps` instead.
RUN npm ci --include=dev

# ---------------------------------------------------------------- spike ------
# Adds the third-choice decoder (pillow-heif) so all three candidates from
# plan section 4.2 can be evaluated in one run, in the real target image.
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
# Placeholder until Phase 1. Kept in the file so the deploy shape is visible
# and so `--target spike` reads as the deliberate choice it is.
FROM base AS runner
RUN groupadd -r app && useradd -r -g app app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY scripts/ ./scripts/
# The app writes only to the mounted volumes; nothing is written to the image.
VOLUME ["/config", "/photos/originals", "/photos/derived"]
USER app
EXPOSE 3000
CMD ["node", "-e", "console.error('No app yet. Phase 1 wires the Next.js build into this stage. For the Phase 0 spike, build with --target spike.'); process.exit(1)"]

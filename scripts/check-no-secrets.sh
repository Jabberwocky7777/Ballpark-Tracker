#!/usr/bin/env bash
# Fails if anything that shouldn't be in a public repo is tracked by git.
# Runs in CI on every push, and is worth running by hand before the first push.
#
# This script is excluded from its own content scan, since it necessarily
# contains the patterns it looks for.
set -uo pipefail

SELF="scripts/check-no-secrets.sh"
FAIL=0

fail() {
  echo "FAIL: $1"
  FAIL=1
}

# --- 1. Forbidden file types ------------------------------------------------
# Photos, databases, env files, exports, and anything under docs/private.
FORBIDDEN_FILES=$(git ls-files \
  | grep -Ei '(^|/)\.env($|\.)|(^|/)docs/private/|\.(db|db-wal|db-shm|sqlite3?|heic|heif|cr2|dng)$|(^|/)exports?/' \
  | grep -Ev '(^|/)\.env\.example$' \
  || true)

# Images are forbidden by default; add an intentional UI asset to this allowlist.
ALLOWED_IMAGES='^public/img/'
FORBIDDEN_IMAGES=$(git ls-files | grep -Ei '\.(jpe?g)$' | grep -Ev "$ALLOWED_IMAGES" || true)

if [ -n "$FORBIDDEN_FILES" ]; then
  fail "these files must not be tracked:"
  echo "$FORBIDDEN_FILES" | sed 's/^/  /'
fi
if [ -n "$FORBIDDEN_IMAGES" ]; then
  fail "unexpected image files tracked (allowlist is $ALLOWED_IMAGES):"
  echo "$FORBIDDEN_IMAGES" | sed 's/^/  /'
fi

# --- 2. Forbidden content ---------------------------------------------------
# Infrastructure identifiers, real coordinates, and key material.
PATTERNS=(
  'REDACTED-DOMAIN'                                  # the real domain
  'REDACTED-POOLS'                      # pool names
  '/mnt/[A-Za-z]'                              # host dataset paths
  '\bREDACTED-PORT\b|\bREDACTED-PORT\b'            # host port range for the apps
  'ts\.net'                                   # tailnet hostnames (the bare word is fine)
  'BEGIN [A-Z ]*PRIVATE KEY'                   # key material
  'HOME_(LAT|LNG)[[:space:]]*[=:][[:space:]]*-?[0-9]+\.[0-9]+'  # real home coords
  '\b(19[0-9]|2[0-2][0-9])\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b' # LAN/NAS IPs
)

FILES=$(git ls-files | grep -v "^$SELF$")

for p in "${PATTERNS[@]}"; do
  # -I skips binary files. Empty FILES would make grep read stdin, so guard it.
  [ -z "$FILES" ] && break
  HITS=$(echo "$FILES" | xargs grep -InIE "$p" 2>/dev/null || true)
  if [ -n "$HITS" ]; then
    fail "pattern /$p/ found in tracked files:"
    echo "$HITS" | sed 's/^/  /'
  fi
done

# --- 3. Personal names as identifiers ---------------------------------------
# The database stores user_a / user_b; display names come from env.
if [ -n "$FILES" ]; then
  NAMES=$(echo "$FILES" | xargs grep -InIE '\b(brendan|emma)\b' 2>/dev/null || true)
  if [ -n "$NAMES" ]; then
    fail "personal names found — use user_a / user_b and USER_A_NAME / USER_B_NAME:"
    echo "$NAMES" | sed 's/^/  /'
  fi
fi

if [ "$FAIL" -eq 0 ]; then
  echo "OK: nothing of value is tracked."
fi
exit "$FAIL"

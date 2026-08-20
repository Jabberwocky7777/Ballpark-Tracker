#!/usr/bin/env bash
# Fails if anything that shouldn't be in a public repo is tracked by git.
# Runs in CI on every push, and is worth running by hand before any push.
#
# Two rules make this trustworthy, and both were learned the hard way:
#
#   1. It scans EVERY tracked file, including itself. An earlier version
#      excluded itself, so the one file that spelled out the real domain and
#      the pool names -- as its own search patterns -- was the one file never
#      checked. It passed while being the leak.
#
#   2. No site-specific identifier appears in this file, not even as a
#      pattern. They live in scripts/private-patterns.txt (gitignored) or in
#      the EXTRA_SECRET_PATTERNS environment variable, set from a repository
#      secret in CI. Rule 1 now enforces rule 2.
#
# If neither source of extra patterns is present the generic checks below still
# run, and the script says so rather than quietly becoming a weaker check.
set -uo pipefail
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
# Generic only. Anything that would identify this particular install belongs in
# the private pattern list, never here.
PATTERNS=(
  '/mnt/[A-Za-z]'                              # host dataset paths
  'BEGIN [A-Z ]*PRIVATE KEY'                   # key material
  'HOME_(LAT|LNG)[[:space:]]*[=:][[:space:]]*-?[0-9]+\.[0-9]+'  # real home coords
  '\b(19[0-9]|2[0-2][0-9])\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\b' # LAN/NAS IPs
)

PRIVATE_LIST="scripts/private-patterns.txt"
EXTRA_COUNT=0

add_pattern() {
  case "$1" in
    "" | \#*) return ;;
  esac
  PATTERNS+=("$1")
  EXTRA_COUNT=$((EXTRA_COUNT + 1))
}

if [ -f "$PRIVATE_LIST" ]; then
  while IFS= read -r line || [ -n "$line" ]; do add_pattern "$line"; done < "$PRIVATE_LIST"
fi
if [ -n "${EXTRA_SECRET_PATTERNS:-}" ]; then
  while IFS= read -r line || [ -n "$line" ]; do add_pattern "$line"; done <<< "$EXTRA_SECRET_PATTERNS"
fi

if [ "$EXTRA_COUNT" -eq 0 ]; then
  echo "note: no private patterns loaded (no $PRIVATE_LIST, no EXTRA_SECRET_PATTERNS)."
  echo "      generic checks only. See ${PRIVATE_LIST%.txt}.example.txt."
fi

FILES=$(git ls-files)

for p in "${PATTERNS[@]}"; do
  # -I skips binary files. Empty FILES would make grep read stdin, so guard it.
  [ -z "$FILES" ] && break
  HITS=$(echo "$FILES" | xargs grep -InIE "$p" 2>/dev/null || true)
  if [ -n "$HITS" ]; then
    fail "pattern /$p/ found in tracked files:"
    echo "$HITS" | sed 's/^/  /'
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "OK: nothing of value is tracked ($EXTRA_COUNT private pattern(s) applied)."
fi
exit "$FAIL"

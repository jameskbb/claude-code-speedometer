#!/usr/bin/env bash
# Repository checks: manifest, tests, a public-safety scan, and README sync.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0

# Public-safety: no private network identifiers, machine paths, or em dashes in tracked files.
files=$(git ls-files | grep -vE '\.(png|webp|jpg|gif|woff2?|ttf)$')
if [ -n "$files" ]; then
  # shellcheck disable=SC2086 # file list is intentionally word-split
  hits=$(grep -nE '\b(192\.168|10\.[0-9]{1,3}\.[0-9]{1,3}|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\b|([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}|/home/[a-z]{2,}|/Users/[A-Za-z]|C:\\\\Users' $files 2>/dev/null)
  [ -n "$hits" ] && { echo "FAIL: private identifier in tracked files:"; echo "$hits"; fail=1; }
  # shellcheck disable=SC2086
  dash=$(grep -nP '\x{2014}' $files 2>/dev/null)
  [ -n "$dash" ] && { echo "FAIL: em dash found:"; echo "$dash"; fail=1; }
fi

for s in scripts/*.sh; do
  bash -n "$s" || { echo "FAIL: syntax error in $s"; fail=1; }
done

if command -v claude >/dev/null 2>&1; then
  claude plugin validate . >/dev/null || { echo "FAIL: plugin manifest"; fail=1; }
  claude plugin test . || { echo "FAIL: tests"; fail=1; }
else
  echo "SKIP: claude not on PATH; manifest and tests not run"
fi

# README gallery: every /config theme has its image and entry under its category; counts match.
if command -v node >/dev/null 2>&1; then
  node scripts/check-readme.mjs || fail=1
else
  echo "SKIP: node not on PATH; README sync check not run"
fi

[ $fail -eq 0 ] && echo "OK: all checks passed"
exit $fail

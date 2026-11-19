#!/usr/bin/env bash
# Mirror this repository into the Windows directory the DSH profile installs the
# bundle from.
#
# DSH runs on Windows and a \\wsl.localhost UNC link does not resolve as a
# profile bundle, so the repository stays authoritative here and the installed
# copy is a disposable mirror.
#
# Usage:
#   DSH_PLUGIN_FINDER_DEPLOY='C:/path/to/dsh-plugin-finder' ./scripts/sync.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="${DSH_PLUGIN_FINDER_DEPLOY:-}"

if [ -z "$DST" ]; then
  cat >&2 <<'EOF'
error: set DSH_PLUGIN_FINDER_DEPLOY to the Windows-side mirror directory.

  DSH_PLUGIN_FINDER_DEPLOY='C:/path/to/dsh-plugin-finder' ./scripts/sync.sh

Then install that directory as a bundle (Plugins › Add plugin › local directory,
or plugin_manager install_bundle with the same path).
EOF
  exit 2
fi

mkdir -p "$DST"
tar --exclude=.git --exclude=node_modules --exclude=test --exclude=scripts -cf - -C "$REPO" . | tar -xf - -C "$DST"

echo "synced $REPO -> $DST"

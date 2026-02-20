#!/usr/bin/env bash
# Superset setup script — runs in the worktree directory on workspace creation.
# Symlinks gitignored dev secret files from the root repo so all worktrees
# share a single source of truth.

set -euo pipefail

ROOT="${SUPERSET_ROOT_PATH:?SUPERSET_ROOT_PATH not set}"

# Files to symlink from root repo into the worktree.
# Add paths (relative to repo root) as needed.
SYMLINK_FILES=(
  "apps/worker/.dev.vars"
)

for rel in "${SYMLINK_FILES[@]}"; do
  src="$ROOT/$rel"
  dest="./$rel"

  # Skip if source doesn't exist in the root repo
  if [[ ! -f "$src" ]]; then
    echo "[setup] skip: $rel (not found in root repo)"
    continue
  fi

  # Already a symlink pointing to the right place — nothing to do
  if [[ -L "$dest" && "$(readlink "$dest")" == "$src" ]]; then
    echo "[setup] ok:   $rel (already symlinked)"
    continue
  fi

  # Back up any existing non-symlink file
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    echo "[setup] backup: $rel -> ${dest}.bak"
    mv "$dest" "${dest}.bak"
  fi

  mkdir -p "$(dirname "$dest")"
  ln -sf "$src" "$dest"
  echo "[setup] link: $rel -> $src"
done

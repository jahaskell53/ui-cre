#!/usr/bin/env bash
# Used by Vercel "Ignored Build Step" via vercel.json ignoreCommand.
# Exit 0 → skip build. Exit 1 → run build.
# https://vercel.com/docs/project-configuration/vercel-json#ignorecommand

set -euo pipefail

if [[ -z "${VERCEL_GIT_PREVIOUS_SHA:-}" || "${VERCEL_GIT_PREVIOUS_SHA}" == "${VERCEL_GIT_COMMIT_SHA:-}" ]]; then
    exit 1
fi

paths=(
    src
    public
    package.json
    bun.lockb
    next.config.mjs
    postcss.config.mjs
    vercel.json
    tsconfig.json
    components.json
    middleware.ts
    instrumentation.ts
)

if git diff --quiet "${VERCEL_GIT_PREVIOUS_SHA}" "${VERCEL_GIT_COMMIT_SHA}" -- "${paths[@]}"; then
    exit 0
else
    exit 1
fi

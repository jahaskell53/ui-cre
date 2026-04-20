/** @typedef {'full' | 'related' | 'skip'} UnitRunKind */

export const UNIT_GLOBAL_PREFIXES = [
    "package.json",
    "bun.lockb",
    "tsconfig.json",
    "vitest.config.ts",
    "vitest.integration.config.ts",
    "next.config.",
    "postcss.config.",
    "tailwind.config.",
    "components.json",
];

export const UNIT_GLOBAL_PATHS = new Set(["src/__tests__/setup.ts"]);

export const INTEGRATION_GLOBAL_PREFIXES = [
    "package.json",
    "bun.lockb",
    "vitest.integration.config.ts",
    "src/db/schema.ts",
];

export const INTEGRATION_GLOBAL_PREFIXES_EXTRA = ["supabase/migrations/"];

function pathStartsWithAny(p, prefixes) {
    return prefixes.some((pre) => p === pre || p.startsWith(`${pre}/`) || p.startsWith(pre));
}

export function touchesUnitGlobal(changed) {
    for (const p of changed) {
        if (UNIT_GLOBAL_PATHS.has(p)) return true;
        if (UNIT_GLOBAL_PREFIXES.some((pre) => p === pre || p.startsWith(pre))) return true;
    }
    return false;
}

export function touchesIntegrationGlobal(changed) {
    for (const p of changed) {
        if (INTEGRATION_GLOBAL_PREFIXES.some((pre) => p === pre || p.startsWith(pre))) return true;
        if (INTEGRATION_GLOBAL_PREFIXES_EXTRA.some((pre) => p === pre || p.startsWith(pre))) return true;
        if (pathStartsWithAny(p, ["src/__tests__/integration"])) return true;
    }
    return false;
}

/**
 * @param {string[]} changed
 * @returns {{ kind: UnitRunKind, relatedPaths: string[] }}
 */
function isUnitRelatedSrcPath(p) {
    return p.startsWith("src/") && !p.startsWith("src/__tests__/integration/");
}

export function classifyUnitVitest(changed) {
    if (changed.length === 0) {
        return { kind: "skip", relatedPaths: [] };
    }
    if (touchesUnitGlobal(changed)) {
        return { kind: "full", relatedPaths: [] };
    }
    const hasUnitRelevantSrcTouch = changed.some((p) => isUnitRelatedSrcPath(p));
    if (!hasUnitRelevantSrcTouch) {
        return { kind: "skip", relatedPaths: [] };
    }
    const relatedPaths = changed.filter((p) => isUnitRelatedSrcPath(p));
    if (relatedPaths.length === 0) {
        return { kind: "full", relatedPaths: [] };
    }
    return { kind: "related", relatedPaths };
}

/**
 * @param {string[]} changed
 * @returns {{ run: boolean }}
 */
export function classifyIntegrationVitest(changed) {
    if (changed.length === 0) {
        return { run: false };
    }
    return { run: touchesIntegrationGlobal(changed) };
}

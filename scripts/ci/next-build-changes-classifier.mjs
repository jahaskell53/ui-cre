/**
 * Decide whether CI should run `next build` from a list of changed paths.
 *
 * Skip when every change is confined to areas that do not ship with the Next app
 * (Dagster pipeline, GitHub workflow metadata).
 */
function isSkippableForNextBuild(p) {
    return p.startsWith("pipeline/") || p.startsWith(".github/");
}

/**
 * @param {string[]} changed
 * @returns {{ run: boolean }}
 */
export function classifyNextBuild(changed) {
    if (changed.length === 0) {
        return { run: true };
    }
    const allSkippable = changed.every(isSkippableForNextBuild);
    return { run: !allSkippable };
}

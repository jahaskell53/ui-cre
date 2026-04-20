/**
 * Resolve changed file paths for GitHub Actions push / pull_request events.
 *
 * Env:
 *   GITHUB_EVENT_NAME     push | pull_request | ...
 *   GITHUB_SHA            current commit
 *   GITHUB_PR_BASE_SHA    pull_request.base.sha (PR only)
 *   GITHUB_PR_HEAD_SHA    pull_request.head.sha (PR only)
 *   GITHUB_PUSH_BEFORE    github.event.before (push only; 40x0 = new branch)
 */
import { execSync } from "node:child_process";

const REPO_ROOT = process.cwd();

function git(args) {
    return execSync(`git ${args}`, { encoding: "utf8", cwd: REPO_ROOT }).trimEnd();
}

function diffNameOnly(threeDotRange) {
    try {
        return git(`diff --name-only --diff-filter=ACMRTUXB ${threeDotRange}`)
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
    } catch {
        return null;
    }
}

/**
 * @returns {string[] | null} changed paths, or null when the event has no usable git range
 */
export function getGithubChangedPaths() {
    const event = process.env.GITHUB_EVENT_NAME;
    if (event === "pull_request") {
        const base = process.env.GITHUB_PR_BASE_SHA;
        const head = process.env.GITHUB_PR_HEAD_SHA;
        if (!base || !head) return null;
        return diffNameOnly(`${base}...${head}`);
    }
    if (event === "push") {
        const before = process.env.GITHUB_PUSH_BEFORE;
        const after = process.env.GITHUB_SHA;
        if (!after) return null;
        if (!before || /^0+$/.test(before)) return null;
        return diffNameOnly(`${before}...${after}`);
    }
    return null;
}

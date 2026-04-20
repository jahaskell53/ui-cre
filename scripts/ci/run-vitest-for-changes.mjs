#!/usr/bin/env node
/**
 * CI helper: run Vitest in full or "related" mode from git changed paths.
 *
 * Env (GitHub Actions):
 *   GITHUB_EVENT_NAME     push | pull_request | ...
 *   GITHUB_SHA            current commit
 *   GITHUB_PR_BASE_SHA    pull_request.base.sha (PR only)
 *   GITHUB_PR_HEAD_SHA    pull_request.head.sha (PR only)
 *   GITHUB_PUSH_BEFORE      github.event.before (push only; 40x0 = new branch)
 *
 * Args: unit | integration
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
    classifyIntegrationVitest,
    classifyUnitVitest,
} from "./vitest-changes-classifier.mjs";

const mode = process.argv[2];
if (mode !== "unit" && mode !== "integration") {
    console.error('Usage: run-vitest-for-changes.mjs <unit|integration>');
    process.exit(2);
}

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

function getChangedPaths() {
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

function existingSrcPaths(paths) {
    return paths.filter((p) => p.startsWith("src/") && fs.existsSync(path.join(REPO_ROOT, p)));
}

function run(cmd) {
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: REPO_ROOT });
}

const changed = getChangedPaths();

if (changed === null) {
    console.log("No git range (local or unknown event): running full Vitest suite.");
    if (mode === "unit") {
        run("bunx vitest run");
    } else {
        run("bunx vitest run --config vitest.integration.config.ts");
    }
    process.exit(0);
}

if (mode === "unit") {
    const decision = classifyUnitVitest(changed);
    if (decision.kind === "skip") {
        console.log("No unit-test-relevant changes in range; skipping unit tests.");
        process.exit(0);
    }
    if (decision.kind === "full") {
        console.log("Running full unit suite (global config or ambiguous src changes).");
        run("bunx vitest run");
        process.exit(0);
    }
    const srcPaths = existingSrcPaths(decision.relatedPaths);
    if (srcPaths.length === 0) {
        console.log("Only deleted/missing src paths; running full unit suite.");
        run("bunx vitest run");
        process.exit(0);
    }
    console.log(`Running vitest related for ${srcPaths.length} path(s).`);
    const quoted = srcPaths.map((p) => `"${p.replace(/"/g, '\\"')}"`).join(" ");
    run(`bunx vitest related ${quoted} --run`);
    process.exit(0);
}

const integ = classifyIntegrationVitest(changed);
if (!integ.run) {
    console.log("No schema, migration, or integration test changes; skipping DB integration tests.");
    process.exit(0);
}

console.log("Integration-relevant change detected; running DB integration tests.");
run("bunx vitest run --config vitest.integration.config.ts");

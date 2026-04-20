#!/usr/bin/env node
/**
 * CI: run `bun run build` unless the git diff only touches pipeline/ and .github/.
 */
import { execSync } from "node:child_process";
import { getGithubChangedPaths } from "./git-changed-paths.mjs";
import { classifyNextBuild } from "./next-build-changes-classifier.mjs";

function run(cmd) {
    console.log(`> ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
}

const changed = getGithubChangedPaths();

if (changed === null) {
    console.log("No git range (local or unknown event): running Next.js build.");
    run("bun run build");
    process.exit(0);
}

const { run: shouldRun } = classifyNextBuild(changed);
if (!shouldRun) {
    console.log("Only pipeline/ and .github/ changes in range; skipping Next.js build.");
    process.exit(0);
}

console.log("App-relevant changes detected; running Next.js build.");
run("bun run build");

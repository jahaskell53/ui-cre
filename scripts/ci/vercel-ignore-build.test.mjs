import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptDir, "..", "vercel-ignore-build.sh");
const repoRoot = join(scriptDir, "..", "..");

function run(env) {
    return spawnSync("bash", [scriptPath], {
        env: { ...process.env, ...env },
        encoding: "utf8",
        cwd: repoRoot,
    });
}

describe("vercel-ignore-build.sh", () => {
    it("runs build when VERCEL_GIT_PREVIOUS_SHA is empty", () => {
        const r = run({
            VERCEL_GIT_PREVIOUS_SHA: "",
            VERCEL_GIT_COMMIT_SHA: "abc123",
        });
        assert.equal(r.status, 1);
    });

    it("runs build when previous and current SHA are equal", () => {
        const r = run({
            VERCEL_GIT_PREVIOUS_SHA: "deadbeef",
            VERCEL_GIT_COMMIT_SHA: "deadbeef",
        });
        assert.equal(r.status, 1);
    });
});

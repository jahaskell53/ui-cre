import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyNextBuild } from "./next-build-changes-classifier.mjs";

describe("classifyNextBuild", () => {
    it("runs when nothing changed (empty diff)", () => {
        assert.equal(classifyNextBuild([]).run, true);
    });

    it("skips when only pipeline paths changed", () => {
        assert.equal(classifyNextBuild(["pipeline/dagster/foo.py"]).run, false);
    });

    it("skips when only .github paths changed", () => {
        assert.equal(classifyNextBuild([".github/workflows/test.yml"]).run, false);
    });

    it("skips when only pipeline and .github paths changed", () => {
        assert.equal(classifyNextBuild(["pipeline/dagster/foo.py", ".github/workflows/test.yml"]).run, false);
    });

    it("runs when src changes alongside pipeline", () => {
        assert.equal(classifyNextBuild(["pipeline/x", "src/lib/foo.ts"]).run, true);
    });

    it("runs when package.json changes", () => {
        assert.equal(classifyNextBuild(["package.json"]).run, true);
    });
});

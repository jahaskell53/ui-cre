import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    classifyIntegrationVitest,
    classifyUnitVitest,
    touchesIntegrationGlobal,
} from "./vitest-changes-classifier.mjs";

describe("classifyUnitVitest", () => {
    it("skips when no files changed", () => {
        assert.deepEqual(classifyUnitVitest([]), { kind: "skip", relatedPaths: [] });
    });

    it("skips when only non-src paths changed", () => {
        assert.deepEqual(classifyUnitVitest(["README.md", "pipeline/foo.py"]), {
            kind: "skip",
            relatedPaths: [],
        });
    });

    it("skips when only DB integration tests under src changed", () => {
        assert.deepEqual(
            classifyUnitVitest(["src/__tests__/integration/db/get-comps.test.ts"]),
            { kind: "skip", relatedPaths: [] },
        );
    });

    it("runs full suite when lockfile changes", () => {
        assert.equal(classifyUnitVitest(["bun.lockb"]).kind, "full");
    });

    it("runs related when only src app file changes", () => {
        const r = classifyUnitVitest(["src/lib/foo.ts"]);
        assert.equal(r.kind, "related");
        assert.deepEqual(r.relatedPaths, ["src/lib/foo.ts"]);
    });

    it("runs full when vitest config changes", () => {
        assert.equal(classifyUnitVitest(["vitest.config.ts"]).kind, "full");
    });

    it("runs full when test setup changes", () => {
        assert.equal(classifyUnitVitest(["src/__tests__/setup.ts"]).kind, "full");
    });
});

describe("classifyIntegrationVitest", () => {
    it("does not run when only unrelated src changes", () => {
        assert.equal(classifyIntegrationVitest(["src/lib/foo.ts"]).run, false);
    });

    it("runs when migration changes", () => {
        assert.equal(classifyIntegrationVitest(["supabase/migrations/001.sql"]).run, true);
    });

    it("runs when schema changes", () => {
        assert.equal(classifyIntegrationVitest(["src/db/schema.ts"]).run, true);
    });

    it("runs when integration test file changes", () => {
        assert.equal(
            touchesIntegrationGlobal(["src/__tests__/integration/db/foo.test.ts"]),
            true,
        );
    });
});

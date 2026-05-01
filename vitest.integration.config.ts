import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "node",
        globals: true,
        include: ["src/__tests__/integration/db/**/*.test.ts"],
        // Heavy Crexi spatial RPCs use function-level statement_timeout = 120s.
        // Vitest must allow strictly more wall time than that so cold-cache runs
        // (network + PostgREST + DB) are not killed by the harness before Postgres
        // can cancel or finish the statement.
        testTimeout: 180000,
        hookTimeout: 180000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});

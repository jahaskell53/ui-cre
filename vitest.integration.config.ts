import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "node",
        globals: true,
        include: ["src/__tests__/integration/db/**/*.test.ts"],
        // Match the function-level statement_timeout budget on heavy spatial RPCs
        // (e.g. get_crexi_sales_trends_by_msa for the SF Bay Area MSA can take
        // ~25-40s end-to-end on a cold buffer cache). Integration tests must exceed
        // the RPC's 120s statement_timeout so concurrent DB load does not exhaust
        // the Vitest harness before Postgres returns.
        testTimeout: 180000,
        hookTimeout: 180000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});

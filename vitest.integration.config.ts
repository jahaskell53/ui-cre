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
        // ~25-40s end-to-end on a cold buffer cache). GitHub Actions runners also
        // see occasional cold-cache runs >120s for MSA/county market-activity and
        // trends RPCs. Vitest harness timeouts must stay above observed RPC wall
        // time (still below typical DB statement timeouts).
        testTimeout: 300000,
        hookTimeout: 300000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});

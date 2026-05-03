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
        // (e.g. get_crexi_sales_trends_by_msa, get_rent_trends*, get_comps at 120s).
        // get_crexi_sales_trends_by_msa for the SF Bay Area MSA can take ~25-40s
        // end-to-end on a cold buffer cache. Holding the test cap below
        // the DB cap caused intermittent harness timeouts even though the RPC
        // completed inside its own statement_timeout.
        testTimeout: 120000,
        hookTimeout: 120000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});

/**
 * Typed wrappers over Postgres RPC functions.
 *
 * Convention
 * ----------
 * Each file in this directory corresponds to a logical group of Postgres
 * functions (e.g. rent-trends, market-activity, geo lookups). Every exported
 * function is a thin async wrapper that:
 *
 *   1. Accepts a strongly-typed params object matching the Postgres function
 *      signature.
 *   2. Calls `supabase.rpc(fnName, params)` under the hood.
 *   3. Throws the Supabase error (instead of returning it) so callers can use
 *      plain `await` without checking `{ data, error }`.
 *   4. Returns a typed array (or value) instead of `any`.
 *
 * Usage
 * -----
 * Import from this barrel or directly from the individual module:
 *
 *   import { getRentTrends } from "@/db/rpc";
 *   import { getComps }      from "@/db/rpc/comps";
 *
 * Always prefer these wrappers over calling `supabase.rpc()` directly in
 * server or client code. Direct `supabase.rpc()` calls return `any` and
 * provide no compile-time safety.
 */

export * from "./rent-trends";
export * from "./market-activity";
export * from "./map-rent-trends";
export * from "./comps";
export * from "./geo";
export * from "./map-listings";
export * from "./sales-trends";

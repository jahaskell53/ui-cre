import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

// Heavy RPCs (e.g. sales-trends spatial queries) carry a 120s DB statement_timeout.
// Give Vercel enough runway to wait for the DB rather than cutting the function short.
export const maxDuration = 150;

export async function POST(request: NextRequest) {
    try {
        const { fn, params } = await request.json();

        if (!fn || typeof fn !== "string") {
            return NextResponse.json({ error: "Missing or invalid 'fn' field" }, { status: 400 });
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase.rpc(fn, params ?? {});

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data ?? []);
    } catch (error: any) {
        console.error("Error in POST /api/rpc:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

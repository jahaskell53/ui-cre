import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { integrations } from "@/db/schema";
import { revokeGrant } from "@/lib/nylas/client";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get the integration to revoke
        const [integration] = await db
            .select()
            .from(integrations)
            .where(and(eq(integrations.id, id), eq(integrations.userId, user.id)));

        if (!integration) {
            return NextResponse.json({ error: "Integration not found" }, { status: 404 });
        }

        // Revoke the grant with Nylas
        await revokeGrant(integration.nylasGrantId);

        // Delete the integration from our database
        await db.delete(integrations).where(and(eq(integrations.id, id), eq(integrations.userId, user.id)));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error disconnecting integration:", error);
        return NextResponse.json({ error: "Failed to disconnect integration" }, { status: 500 });
    }
}

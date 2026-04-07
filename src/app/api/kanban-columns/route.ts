import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { kanbanColumns } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

const DEFAULT_COLUMNS = ["Active Prospecting", "Offering Memorandum", "Underwriting", "Due Diligence", "Closed/Archive"];

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rows = await db.select({ columns: kanbanColumns.columns }).from(kanbanColumns).where(eq(kanbanColumns.userId, user.id));

        if (rows.length === 0) {
            return NextResponse.json({ columns: DEFAULT_COLUMNS });
        }

        return NextResponse.json({ columns: rows[0].columns || [] });
    } catch (error: any) {
        console.error("Error in GET /api/kanban-columns:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { columns } = body;

        if (!Array.isArray(columns) || columns.length === 0) {
            return NextResponse.json({ error: "Invalid request: columns array required" }, { status: 400 });
        }

        if (!columns.every((col: any) => typeof col === "string" && col.trim().length > 0)) {
            return NextResponse.json({ error: "All columns must be non-empty strings" }, { status: 400 });
        }

        const trimmedColumns = columns.map((col: string) => col.trim());

        const existing = await db.select({ id: kanbanColumns.id }).from(kanbanColumns).where(eq(kanbanColumns.userId, user.id));

        let resultColumns: string[];

        if (existing.length > 0) {
            const updated = await db
                .update(kanbanColumns)
                .set({ columns: trimmedColumns })
                .where(eq(kanbanColumns.userId, user.id))
                .returning({ columns: kanbanColumns.columns });

            if (updated.length === 0) {
                return NextResponse.json({ error: "Failed to update kanban columns" }, { status: 500 });
            }
            resultColumns = updated[0].columns!;
        } else {
            const inserted = await db.insert(kanbanColumns).values({ userId: user.id, columns: trimmedColumns }).returning({ columns: kanbanColumns.columns });

            if (inserted.length === 0) {
                return NextResponse.json({ error: "Failed to save kanban columns" }, { status: 500 });
            }
            resultColumns = inserted[0].columns!;
        }

        return NextResponse.json({ columns: resultColumns });
    } catch (error: any) {
        console.error("Error in PUT /api/kanban-columns:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

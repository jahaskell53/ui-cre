import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { people, peopleBoardAssignments } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

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

        const rows = await db
            .select({ personId: peopleBoardAssignments.personId, columnId: peopleBoardAssignments.columnId })
            .from(peopleBoardAssignments)
            .where(eq(peopleBoardAssignments.userId, user.id));

        const assignmentsByColumn: Record<string, string[]> = {};
        rows.forEach((row) => {
            if (!assignmentsByColumn[row.columnId]) {
                assignmentsByColumn[row.columnId] = [];
            }
            assignmentsByColumn[row.columnId].push(row.personId);
        });

        return NextResponse.json(assignmentsByColumn);
    } catch (error: any) {
        console.error("Error in GET /api/people/board:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
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
        const { personId, columnId } = body;

        if (!personId || !columnId) {
            return NextResponse.json({ error: "personId and columnId are required" }, { status: 400 });
        }

        const personRows = await db
            .select({ id: people.id })
            .from(people)
            .where(and(eq(people.id, personId), eq(people.userId, user.id)));

        if (personRows.length === 0) {
            return NextResponse.json({ error: "Person not found" }, { status: 404 });
        }

        const inserted = await db
            .insert(peopleBoardAssignments)
            .values({
                userId: user.id,
                personId,
                columnId,
            })
            .onConflictDoNothing()
            .returning();

        const assignment = inserted[0] ?? { userId: user.id, personId, columnId };

        return NextResponse.json({
            id: (assignment as any).id,
            user_id: assignment.userId,
            person_id: assignment.personId,
            column_id: assignment.columnId,
        });
    } catch (error: any) {
        console.error("Error in POST /api/people/board:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const personId = searchParams.get("personId");
        const columnId = searchParams.get("columnId");

        if (!personId || !columnId) {
            return NextResponse.json({ error: "personId and columnId are required" }, { status: 400 });
        }

        await db
            .delete(peopleBoardAssignments)
            .where(
                and(eq(peopleBoardAssignments.userId, user.id), eq(peopleBoardAssignments.personId, personId), eq(peopleBoardAssignments.columnId, columnId)),
            );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/people/board:", error);
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
        const { personId, oldColumnId, newColumnId } = body;

        if (!personId || !oldColumnId || !newColumnId) {
            return NextResponse.json({ error: "personId, oldColumnId, and newColumnId are required" }, { status: 400 });
        }

        await db
            .delete(peopleBoardAssignments)
            .where(
                and(
                    eq(peopleBoardAssignments.userId, user.id),
                    eq(peopleBoardAssignments.personId, personId),
                    eq(peopleBoardAssignments.columnId, oldColumnId),
                ),
            );

        const inserted = await db
            .insert(peopleBoardAssignments)
            .values({
                userId: user.id,
                personId,
                columnId: newColumnId,
            })
            .returning();

        if (inserted.length === 0) {
            return NextResponse.json({ error: "Failed to update board assignment" }, { status: 500 });
        }

        const assignment = inserted[0];
        return NextResponse.json({
            id: assignment.id,
            user_id: assignment.userId,
            person_id: assignment.personId,
            column_id: assignment.columnId,
        });
    } catch (error: any) {
        console.error("Error in PUT /api/people/board:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

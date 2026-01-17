import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch board assignments for the current user
        const { data, error } = await supabase
            .from("people_board_assignments")
            .select("person_id, column_id")
            .eq("user_id", user.id);

        if (error) {
            console.error("Error fetching board assignments:", error);
            return NextResponse.json({ error: "Failed to fetch board assignments" }, { status: 500 });
        }

        // Group by column_id
        const assignmentsByColumn: Record<string, string[]> = {};
        data?.forEach((assignment) => {
            if (!assignmentsByColumn[assignment.column_id]) {
                assignmentsByColumn[assignment.column_id] = [];
            }
            assignmentsByColumn[assignment.column_id].push(assignment.person_id);
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
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { personId, columnId } = body;

        if (!personId || !columnId) {
            return NextResponse.json({ error: "personId and columnId are required" }, { status: 400 });
        }

        // Verify person belongs to user
        const { data: person, error: personError } = await supabase
            .from("people")
            .select("id")
            .eq("id", personId)
            .eq("user_id", user.id)
            .single();

        if (personError || !person) {
            return NextResponse.json({ error: "Person not found" }, { status: 404 });
        }

        // Insert or update assignment (upsert)
        const { data, error } = await supabase
            .from("people_board_assignments")
            .upsert({
                user_id: user.id,
                person_id: personId,
                column_id: columnId,
            }, {
                onConflict: "user_id,person_id,column_id"
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating board assignment:", error);
            return NextResponse.json({ error: "Failed to create board assignment" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in POST /api/people/board:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const personId = searchParams.get("personId");
        const columnId = searchParams.get("columnId");

        if (!personId || !columnId) {
            return NextResponse.json({ error: "personId and columnId are required" }, { status: 400 });
        }

        // Delete the assignment
        const { error } = await supabase
            .from("people_board_assignments")
            .delete()
            .eq("user_id", user.id)
            .eq("person_id", personId)
            .eq("column_id", columnId);

        if (error) {
            console.error("Error deleting board assignment:", error);
            return NextResponse.json({ error: "Failed to delete board assignment" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/people/board:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { personId, oldColumnId, newColumnId } = body;

        if (!personId || !oldColumnId || !newColumnId) {
            return NextResponse.json({ error: "personId, oldColumnId, and newColumnId are required" }, { status: 400 });
        }

        // Delete old assignment
        const { error: deleteError } = await supabase
            .from("people_board_assignments")
            .delete()
            .eq("user_id", user.id)
            .eq("person_id", personId)
            .eq("column_id", oldColumnId);

        if (deleteError) {
            console.error("Error deleting old board assignment:", deleteError);
            return NextResponse.json({ error: "Failed to update board assignment" }, { status: 500 });
        }

        // Create new assignment
        const { data, error: insertError } = await supabase
            .from("people_board_assignments")
            .insert({
                user_id: user.id,
                person_id: personId,
                column_id: newColumnId,
            })
            .select()
            .single();

        if (insertError) {
            console.error("Error creating new board assignment:", insertError);
            return NextResponse.json({ error: "Failed to update board assignment" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in PUT /api/people/board:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}


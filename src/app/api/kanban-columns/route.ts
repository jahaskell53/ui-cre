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

        // Fetch kanban columns for the current user
        const { data, error } = await supabase
            .from("kanban_columns")
            .select("columns")
            .eq("user_id", user.id)
            .single();

        if (error) {
            // If no record exists, return default columns
            if (error.code === "PGRST116") {
                return NextResponse.json({
                    columns: [
                        "Active Prospecting",
                        "Offering Memorandum",
                        "Underwriting",
                        "Due Diligence",
                        "Closed/Archive",
                    ],
                });
            }
            console.error("Error fetching kanban columns:", error);
            return NextResponse.json({ error: "Failed to fetch kanban columns" }, { status: 500 });
        }

        return NextResponse.json({ columns: data.columns || [] });
    } catch (error: any) {
        console.error("Error in GET /api/kanban-columns:", error);
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
        const { columns } = body;

        if (!Array.isArray(columns) || columns.length === 0) {
            return NextResponse.json({ error: "Invalid request: columns array required" }, { status: 400 });
        }

        // Validate all columns are strings
        if (!columns.every((col: any) => typeof col === "string" && col.trim().length > 0)) {
            return NextResponse.json({ error: "All columns must be non-empty strings" }, { status: 400 });
        }

        // Check if record exists
        const { data: existing } = await supabase
            .from("kanban_columns")
            .select("id")
            .eq("user_id", user.id)
            .single();

        let result;
        if (existing) {
            // Update existing record
            const { data, error } = await supabase
                .from("kanban_columns")
                .update({ columns: columns.map((col: string) => col.trim()) })
                .eq("user_id", user.id)
                .select()
                .single();

            if (error) {
                console.error("Error updating kanban columns:", error);
                return NextResponse.json({ error: "Failed to update kanban columns" }, { status: 500 });
            }
            result = data;
        } else {
            // Insert new record
            const { data, error } = await supabase
                .from("kanban_columns")
                .insert({
                    user_id: user.id,
                    columns: columns.map((col: string) => col.trim()),
                })
                .select()
                .single();

            if (error) {
                console.error("Error inserting kanban columns:", error);
                return NextResponse.json({ error: "Failed to save kanban columns" }, { status: 500 });
            }
            result = data;
        }

        return NextResponse.json({ columns: result.columns });
    } catch (error: any) {
        console.error("Error in PUT /api/kanban-columns:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}


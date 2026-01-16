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

        // Fetch people for the current user
        const { data, error } = await supabase
            .from("people")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching people:", error);
            return NextResponse.json({ error: "Failed to fetch people" }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error("Error in GET /api/people:", error);
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
        const { name, starred, has_email, has_signal } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Insert person
        const { data, error } = await supabase
            .from("people")
            .insert({
                user_id: user.id,
                name: name.trim(),
                starred: starred ?? false,
                has_email: has_email ?? false,
                has_signal: has_signal ?? false,
            })
            .select()
            .single();

        if (error) {
            console.error("Error inserting person:", error);
            return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in POST /api/people:", error);
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

        const searchParams = request.nextUrl.searchParams;
        const personId = searchParams.get("id");

        if (!personId) {
            return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
        }

        const body = await request.json();
        const { name, starred, has_email, has_signal } = body;

        // Build update object - only include fields that are provided
        const updateData: any = {};
        
        if (name !== undefined) updateData.name = name.trim();
        if (starred !== undefined) updateData.starred = starred;
        if (has_email !== undefined) updateData.has_email = has_email;
        if (has_signal !== undefined) updateData.has_signal = has_signal;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }

        // Update the person (RLS will ensure user can only update their own people)
        const { data, error } = await supabase
            .from("people")
            .update(updateData)
            .eq("id", personId)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            console.error("Error updating person:", error);
            return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in PUT /api/people:", error);
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
        const personId = searchParams.get("id");

        if (!personId) {
            return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
        }

        // Delete the person (RLS will ensure user can only delete their own people)
        const { error } = await supabase
            .from("people")
            .delete()
            .eq("id", personId)
            .eq("user_id", user.id);

        if (error) {
            console.error("Error deleting person:", error);
            return NextResponse.json({ error: "Failed to delete person" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/people:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}


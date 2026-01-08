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

        // Fetch contacts for the current user
        const { data, error } = await supabase
            .from("contacts")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching contacts:", error);
            return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
        }

        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error("Error in GET /api/contacts:", error);
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
        const { contacts } = body;

        if (!Array.isArray(contacts) || contacts.length === 0) {
            return NextResponse.json({ error: "Invalid request: contacts array required" }, { status: 400 });
        }

        // Validate and format contacts
        const contactsToInsert = contacts.map((contact: any) => ({
            user_id: user.id,
            first_name: contact.firstName?.trim() || "",
            last_name: contact.lastName?.trim() || "",
            email_address: contact.emailAddress?.trim() || "",
            company: contact.company?.trim() || null,
            position: contact.position?.trim() || null,
            phone_number: contact.phoneNumber?.trim() || null,
            status: "Active Prospecting",
        })).filter((contact: any) => 
            contact.first_name && contact.last_name && contact.email_address
        );

        if (contactsToInsert.length === 0) {
            return NextResponse.json({ error: "No valid contacts to import" }, { status: 400 });
        }

        // Insert contacts
        const { data, error } = await supabase
            .from("contacts")
            .insert(contactsToInsert)
            .select();

        if (error) {
            console.error("Error inserting contacts:", error);
            return NextResponse.json({ error: "Failed to import contacts" }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: data?.length || 0 });
    } catch (error: any) {
        console.error("Error in POST /api/contacts:", error);
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
        const contactId = searchParams.get("id");

        if (!contactId) {
            return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
        }

        const body = await request.json();
        const { first_name, last_name, email_address, company, position, phone_number, status } = body;

        // Build update object - only include fields that are provided
        const updateData: any = {};
        
        if (first_name !== undefined) updateData.first_name = first_name.trim();
        if (last_name !== undefined) updateData.last_name = last_name.trim();
        if (email_address !== undefined) updateData.email_address = email_address.trim();
        if (company !== undefined) updateData.company = company?.trim() || null;
        if (position !== undefined) updateData.position = position?.trim() || null;
        if (phone_number !== undefined) updateData.phone_number = phone_number?.trim() || null;
        if (status !== undefined) updateData.status = status || null;

        // If updating required fields, validate them
        if (updateData.first_name !== undefined || updateData.last_name !== undefined || updateData.email_address !== undefined) {
            // Get current contact to validate
            const { data: currentContact } = await supabase
                .from("contacts")
                .select("first_name, last_name, email_address")
                .eq("id", contactId)
                .eq("user_id", user.id)
                .single();

            const finalFirstName = updateData.first_name ?? currentContact?.first_name;
            const finalLastName = updateData.last_name ?? currentContact?.last_name;
            const finalEmail = updateData.email_address ?? currentContact?.email_address;

            if (!finalFirstName || !finalLastName || !finalEmail) {
                return NextResponse.json({ error: "First name, last name, and email address are required" }, { status: 400 });
            }
        }

        // Update the contact (RLS will ensure user can only update their own contacts)
        const { data, error } = await supabase
            .from("contacts")
            .update(updateData)
            .eq("id", contactId)
            .eq("user_id", user.id)
            .select()
            .single();

        if (error) {
            console.error("Error updating contact:", error);
            return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Error in PUT /api/contacts:", error);
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
        const contactId = searchParams.get("id");

        if (!contactId) {
            return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
        }

        // Delete the contact (RLS will ensure user can only delete their own contacts)
        const { error } = await supabase
            .from("contacts")
            .delete()
            .eq("id", contactId)
            .eq("user_id", user.id);

        if (error) {
            console.error("Error deleting contact:", error);
            return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error in DELETE /api/contacts:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}


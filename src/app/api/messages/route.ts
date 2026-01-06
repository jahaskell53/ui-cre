import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { recipient_id, content } = body;

        if (!recipient_id) {
            return NextResponse.json({ error: "recipient_id is required" }, { status: 400 });
        }

        if (!content || typeof content !== "string" || content.trim().length === 0) {
            return NextResponse.json({ error: "content is required and cannot be empty" }, { status: 400 });
        }

        if (recipient_id === user.id) {
            return NextResponse.json({ error: "Cannot send message to yourself" }, { status: 400 });
        }

        // Verify recipient exists
        const { data: recipient, error: recipientError } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", recipient_id)
            .single();

        if (recipientError || !recipient) {
            return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
        }

        // Insert message
        const { data: message, error: insertError } = await supabase
            .from("messages")
            .insert({
                sender_id: user.id,
                recipient_id,
                content: content.trim(),
            })
            .select()
            .single();

        if (insertError) {
            console.error("Error inserting message:", insertError);
            return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
        }

        return NextResponse.json(message, { status: 201 });
    } catch (error: any) {
        console.error("Error in POST /api/messages:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        
        // Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const otherUserId = searchParams.get("user_id");

        if (!otherUserId) {
            return NextResponse.json({ error: "user_id query parameter is required" }, { status: 400 });
        }

        // Get messages between current user and other user
        const { data: messages, error } = await supabase
            .from("messages")
            .select(`
                id,
                sender_id,
                recipient_id,
                content,
                created_at,
                read_at
            `)
            .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("Error fetching messages:", error);
            return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
        }

        // Mark messages as read if they were sent to current user
        const unreadMessages = messages?.filter(
            m => m.recipient_id === user.id && !m.read_at
        ) || [];

        if (unreadMessages.length > 0) {
            const messageIds = unreadMessages.map(m => m.id);
            await supabase
                .from("messages")
                .update({ read_at: new Date().toISOString() })
                .in("id", messageIds);
        }

        return NextResponse.json(messages || []);
    } catch (error: any) {
        console.error("Error in GET /api/messages:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}


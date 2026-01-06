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

        // Get all messages where user is sender or recipient
        const { data: messages, error: messagesError } = await supabase
            .from("messages")
            .select(`
                id,
                sender_id,
                recipient_id,
                content,
                created_at,
                read_at
            `)
            .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
            .order("created_at", { ascending: false });

        if (messagesError) {
            console.error("Error fetching messages:", messagesError);
            return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
        }

        // Group messages by conversation partner
        const conversationsMap = new Map<string, {
            other_user_id: string;
            last_message: any;
            unread_count: number;
        }>();

        messages?.forEach((message) => {
            const otherUserId = message.sender_id === user.id 
                ? message.recipient_id 
                : message.sender_id;

            const existing = conversationsMap.get(otherUserId);
            
            if (!existing || new Date(message.created_at) > new Date(existing.last_message.created_at)) {
                const unreadCount = message.recipient_id === user.id && !message.read_at ? 1 : 0;
                
                conversationsMap.set(otherUserId, {
                    other_user_id: otherUserId,
                    last_message: message,
                    unread_count: existing ? existing.unread_count + unreadCount : unreadCount,
                });
            } else if (message.recipient_id === user.id && !message.read_at) {
                existing.unread_count += 1;
            }
        });

        // Get profile information for all conversation partners
        const otherUserIds = Array.from(conversationsMap.keys());
        
        if (otherUserIds.length === 0) {
            return NextResponse.json([]);
        }

        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", otherUserIds);

        if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
            return NextResponse.json({ error: "Failed to fetch user profiles" }, { status: 500 });
        }

        // Combine conversation data with profile data
        const conversations = Array.from(conversationsMap.values())
            .map((conv) => {
                const profile = profiles?.find(p => p.id === conv.other_user_id);
                return {
                    other_user_id: conv.other_user_id,
                    other_user: profile ? {
                        id: profile.id,
                        username: profile.username,
                        full_name: profile.full_name,
                        avatar_url: profile.avatar_url,
                    } : null,
                    last_message: {
                        id: conv.last_message.id,
                        content: conv.last_message.content,
                        created_at: conv.last_message.created_at,
                        sender_id: conv.last_message.sender_id,
                    },
                    unread_count: conv.unread_count,
                };
            })
            .sort((a, b) => 
                new Date(b.last_message.created_at).getTime() - 
                new Date(a.last_message.created_at).getTime()
            );

        return NextResponse.json(conversations);
    } catch (error: any) {
        console.error("Error in GET /api/conversations:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}


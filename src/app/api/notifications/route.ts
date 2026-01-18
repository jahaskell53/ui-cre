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

        // Get unread notifications
        const { data: notifications, error: notificationsError } = await supabase
            .from("notifications")
            .select(`
                id,
                type,
                title,
                content,
                related_id,
                created_at,
                read_at
            `)
            .eq("user_id", user.id)
            .is("read_at", null)
            .order("created_at", { ascending: false })
            .limit(50);

        if (notificationsError) {
            console.error("Error fetching notifications:", notificationsError);
            return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
        }

        // For message notifications, get sender info from the related message
        const formattedNotifications = await Promise.all(
            (notifications || []).map(async (notification) => {
                if (notification.type === "message" && notification.related_id) {
                    // Get sender_id from the message
                    const { data: message } = await supabase
                        .from("messages")
                        .select("sender_id")
                        .eq("id", notification.related_id)
                        .single();

                    // Get sender profile (sender_id references auth.users.id, and profiles.id = auth.users.id)
                    let senderProfile = null;
                    if (message?.sender_id) {
                        const { data: profile } = await supabase
                            .from("profiles")
                            .select("id, full_name, avatar_url")
                            .eq("id", message.sender_id)
                            .single();
                        senderProfile = profile;
                    }
                    
                    return {
                        id: notification.id,
                        type: notification.type,
                        title: notification.title,
                        content: notification.content,
                        related_id: notification.related_id,
                        created_at: notification.created_at,
                        read_at: notification.read_at,
                        sender: senderProfile ? {
                            id: senderProfile.id,
                            full_name: senderProfile.full_name,
                            avatar_url: senderProfile.avatar_url,
                        } : null,
                    };
                }

                return {
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    content: notification.content,
                    related_id: notification.related_id,
                    created_at: notification.created_at,
                    read_at: notification.read_at,
                    sender: null,
                };
            })
        );

        return NextResponse.json(formattedNotifications);
    } catch (error: any) {
        console.error("Error in GET /api/notifications:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}


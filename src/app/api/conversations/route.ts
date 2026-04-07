import { desc, eq, inArray, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, profiles } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get authenticated user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get all messages where user is sender or recipient
        const rows = await db
            .select({
                id: messages.id,
                sender_id: messages.senderId,
                recipient_id: messages.recipientId,
                content: messages.content,
                created_at: messages.createdAt,
                read_at: messages.readAt,
            })
            .from(messages)
            .where(or(eq(messages.senderId, user.id), eq(messages.recipientId, user.id)))
            .orderBy(desc(messages.createdAt));

        // Group messages by conversation partner
        const conversationsMap = new Map<
            string,
            {
                other_user_id: string;
                last_message: (typeof rows)[number];
                unread_count: number;
            }
        >();

        rows.forEach((message) => {
            const otherUserId = message.sender_id === user.id ? message.recipient_id : message.sender_id;

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

        const profileRows = await db
            .select({ id: profiles.id, full_name: profiles.fullName, avatar_url: profiles.avatarUrl })
            .from(profiles)
            .where(inArray(profiles.id, otherUserIds));

        // Combine conversation data with profile data
        const conversations = Array.from(conversationsMap.values())
            .map((conv) => {
                const profile = profileRows.find((p) => p.id === conv.other_user_id);
                return {
                    other_user_id: conv.other_user_id,
                    other_user: profile
                        ? {
                              id: profile.id,
                              full_name: profile.full_name,
                              avatar_url: profile.avatar_url,
                          }
                        : null,
                    last_message: {
                        id: conv.last_message.id,
                        content: conv.last_message.content,
                        created_at: conv.last_message.created_at,
                        sender_id: conv.last_message.sender_id,
                    },
                    unread_count: conv.unread_count,
                };
            })
            .sort((a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime());

        return NextResponse.json(conversations);
    } catch (error: any) {
        console.error("Error in GET /api/conversations:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

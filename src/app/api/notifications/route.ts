import { and, desc, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { messages, notifications, profiles } from "@/db/schema";
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

        // Get unread notifications
        const rows = await db
            .select({
                id: notifications.id,
                type: notifications.type,
                title: notifications.title,
                content: notifications.content,
                related_id: notifications.relatedId,
                created_at: notifications.createdAt,
                read_at: notifications.readAt,
            })
            .from(notifications)
            .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)))
            .orderBy(desc(notifications.createdAt))
            .limit(50);

        // For message notifications, get sender info from the related message
        const formattedNotifications = await Promise.all(
            rows.map(async (notification) => {
                if (notification.type === "message" && notification.related_id) {
                    const [message] = await db.select({ senderId: messages.senderId }).from(messages).where(eq(messages.id, notification.related_id));

                    let sender = null;
                    if (message?.senderId) {
                        const [profile] = await db
                            .select({
                                id: profiles.id,
                                full_name: profiles.fullName,
                                avatar_url: profiles.avatarUrl,
                            })
                            .from(profiles)
                            .where(eq(profiles.id, message.senderId));

                        if (profile) {
                            sender = {
                                id: profile.id,
                                full_name: profile.full_name,
                                avatar_url: profile.avatar_url,
                            };
                        }
                    }

                    return { ...notification, sender };
                }

                return { ...notification, sender: null };
            }),
        );

        return NextResponse.json(formattedNotifications);
    } catch (error: any) {
        console.error("Error in GET /api/notifications:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}

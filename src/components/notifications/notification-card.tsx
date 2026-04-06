import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NotificationCardProps {
    notification: {
        id: string;
        type: "message" | "system" | "mention" | "like" | "comment";
        title?: string | null;
        content: string;
        created_at: string;
        read_at: string | null;
        sender?: {
            id: string;
            full_name: string | null;
            avatar_url: string | null;
        } | null;
    };
    onClick?: () => void;
    clickable?: boolean;
}

const getDisplayName = (sender: NotificationCardProps["notification"]["sender"]) => {
    if (!sender) return "Unknown User";
    return sender.full_name || "Unknown User";
};

const getInitials = (sender: NotificationCardProps["notification"]["sender"]) => {
    const name = getDisplayName(sender);
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
};

export function NotificationCard({ notification, onClick, clickable = false }: NotificationCardProps) {
    if (notification.type === "message" && notification.sender) {
        const displayName = getDisplayName(notification.sender);
        const initials = getInitials(notification.sender);

        return (
            <div
                onClick={onClick}
                className={`flex gap-3 border-b border-gray-100 p-4 last:border-b-0 dark:border-gray-800 ${
                    clickable ? "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
                }`}
            >
                <Avatar className="h-8 w-8 flex-shrink-0 border border-gray-200 dark:border-gray-800">
                    <AvatarImage src={notification.sender.avatar_url || undefined} />
                    <AvatarFallback className="bg-gray-100 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">{initials}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                    </div>
                    <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{notification.content}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`flex gap-3 border-b border-gray-100 p-4 last:border-b-0 dark:border-gray-800 ${
                clickable ? "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
            }`}
        >
            <div className="min-w-0 flex-1">
                {notification.title && <div className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">{notification.title}</div>}
                <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{notification.content}</p>
            </div>
        </div>
    );
}

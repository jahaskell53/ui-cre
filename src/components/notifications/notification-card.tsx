import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

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
        .map(n => n[0])
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
                className={`p-4 flex gap-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                    clickable ? "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
                }`}
            >
                <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <AvatarImage src={notification.sender.avatar_url || undefined} />
                    <AvatarFallback className="text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {displayName}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDistanceToNow(
                                new Date(notification.created_at),
                                { addSuffix: true }
                            )}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {notification.content}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`p-4 flex gap-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                clickable ? "cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
            }`}
        >
            <div className="flex-1 min-w-0">
                {notification.title && (
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                        {notification.title}
                    </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {notification.content}
                </p>
            </div>
        </div>
    );
}

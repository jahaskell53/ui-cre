import { forwardRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAuroraGradient } from "@/app/(app)/people/utils";

export interface UserSuggestion {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
}

interface MentionDropdownProps {
    suggestions: UserSuggestion[];
    selectedIndex: number;
    onSelect: (username: string) => void;
}

export const MentionDropdown = forwardRef<HTMLDivElement, MentionDropdownProps>(
    ({ suggestions, selectedIndex, onSelect }, ref) => {
        if (suggestions.length === 0) return null;

        return (
            <div
                ref={ref}
                className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-popover border border-secondary rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
            >
                {suggestions.map((user, index) => {
                    const displayName = user.full_name || "Unknown";
                    const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "U";

                    return (
                        <div
                            key={user.id}
                            className={`px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-secondary/50 ${
                                index === selectedIndex ? "bg-secondary/50" : ""
                            }`}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (user.full_name) {
                                    onSelect(user.full_name);
                                }
                            }}
                            onMouseDown={(e) => {
                                e.preventDefault();
                            }}
                        >
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={user.avatar_url || undefined} />
                                <AvatarFallback style={{ background: generateAuroraGradient(displayName) }} className="text-[10px] text-white">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-primary truncate">
                                    {displayName}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }
);

MentionDropdown.displayName = "MentionDropdown";

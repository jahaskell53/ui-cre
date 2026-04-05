"use client";

import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/utils/supabase";
import { generateAuroraGradient } from "./utils";

interface AccountCardProps {
    isCollapsed?: boolean;
    onNavigate?: () => void;
}

export default function AccountCard({ isCollapsed = false, onNavigate }: AccountCardProps) {
    const router = useRouter();
    const { user, profile, loading } = useUser();

    if (loading) {
        return (
            <div className="flex items-center gap-3 rounded-lg p-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2.5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const displayName = profile?.full_name || user.email?.split("@")[0] || "User";
    const email = user.email || "";
    const avatarUrl = profile?.avatar_url || undefined;

    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };
    const initials = getInitials(displayName);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    if (isCollapsed) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className="h-auto w-full justify-center p-2 hover:bg-gray-100 focus-visible:ring-0 focus-visible:outline-none dark:hover:bg-gray-800"
                        title={displayName}
                    >
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={avatarUrl} alt={displayName} />
                            <AvatarFallback className="text-xs font-medium text-white" style={{ background: generateAuroraGradient(displayName) }}>
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => {
                            onNavigate?.();
                            router.push("/profile");
                        }}
                    >
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => {
                            onNavigate?.();
                            router.push("/settings");
                        }}
                    >
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="h-auto w-full justify-start p-2 hover:bg-gray-100 focus-visible:ring-0 focus-visible:outline-none dark:hover:bg-gray-800"
                >
                    <div className="flex w-full items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={avatarUrl} alt={displayName} />
                            <AvatarFallback className="text-xs font-medium text-white" style={{ background: generateAuroraGradient(displayName) }}>
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 text-left">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    </div>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => {
                        onNavigate?.();
                        router.push("/profile");
                    }}
                >
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        onNavigate?.();
                        router.push("/settings");
                    }}
                >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

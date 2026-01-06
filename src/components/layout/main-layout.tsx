import { useState, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarNavigationSimple } from "@/components/application/app-navigation/sidebar-navigation/sidebar-simple";
import { CommandPalette } from "@/components/application/app-navigation/command-palette";
import { APP_NAV_ITEMS, FOOTER_NAV_ITEMS } from "@/config/nav";
import { useUnreadMessages } from "@/hooks/use-unread-messages";

interface MainLayoutProps {
    children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    const pathname = usePathname();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const unreadCount = useUnreadMessages();

    const navItemsWithBadge = useMemo(() => {
        return APP_NAV_ITEMS.map(item => {
            if (item.href === "/messages" && unreadCount > 0) {
                return {
                    ...item,
                    badge: (
                        <span className="ml-3 size-2 rounded-full bg-orange-500" aria-label={`${unreadCount} unread messages`} />
                    ),
                };
            }
            if (item.href === "/notifications" && unreadCount > 0) {
                return {
                    ...item,
                    badge: (
                        <span className="ml-3 size-2 rounded-full bg-orange-500" aria-label={`${unreadCount} unread notifications`} />
                    ),
                };
            }
            return item;
        });
    }, [unreadCount]);

    return (
        <div className="flex min-h-screen flex-col lg:flex-row bg-secondary">
            <SidebarNavigationSimple
                items={navItemsWithBadge}
                footerItems={FOOTER_NAV_ITEMS}
                activeUrl={pathname}
                onSearchClick={() => setIsSearchOpen(true)}
            />
            <main className="flex-1">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
            <CommandPalette isOpen={isSearchOpen} setOpen={setIsSearchOpen} />
        </div>
    );
};

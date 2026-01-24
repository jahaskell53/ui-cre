"use client";

import { useState, type ReactNode } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UntitledLogo } from "@/components/foundations/logo/untitledui-logo";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cx } from "@/utils/cx";
import { MobileNavigationHeader } from "../base-components/mobile-header";
import { NavAccountCard } from "../base-components/nav-account-card";
import { NavItemBase } from "../base-components/nav-item";
import { NavList } from "../base-components/nav-list";
import type { NavItemType } from "../config";

interface SidebarNavigationProps {
    /** URL of the currently active item. */
    activeUrl?: string;
    /** List of items to display. */
    items: NavItemType[];
    /** List of footer items to display. */
    footerItems?: NavItemType[];
    /** Feature card to display. */
    featureCard?: ReactNode;
    /** Whether to show the account card. */
    showAccountCard?: boolean;
    /** Whether to hide the right side border. */
    hideBorder?: boolean;
    /** Additional CSS classes to apply to the sidebar. */
    className?: string;
    /** Callback when the search input is clicked. */
    onSearchClick?: () => void;
    /** Callback when collapsed state changes. */
    onCollapsedChange?: (isCollapsed: boolean) => void;
}

export const SidebarNavigationSimple = ({
    activeUrl,
    items,
    footerItems = [],
    featureCard,
    showAccountCard = true,
    hideBorder = false,
    className,
    onSearchClick,
    onCollapsedChange,
}: SidebarNavigationProps) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const MAIN_SIDEBAR_WIDTH = 296;
    const COLLAPSED_SIDEBAR_WIDTH = 80;

    const handleToggleCollapse = () => {
        const newCollapsed = !isCollapsed;
        setIsCollapsed(newCollapsed);
        onCollapsedChange?.(newCollapsed);
    };

    const content = (
        <aside
            style={
                {
                    "--width": `${isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : MAIN_SIDEBAR_WIDTH}px`,
                } as React.CSSProperties
            }
            className={cx(
                "flex h-full w-full max-w-full flex-col justify-between overflow-auto bg-primary pt-4 transition-all duration-300 lg:w-(--width) lg:pt-6",
                !hideBorder && "border-secondary md:border-r",
                className,
            )}
        >
            <div className="flex flex-col gap-5 px-4 lg:px-5 relative">
                <div className="flex items-center justify-between">
                    {isCollapsed ? (
                        <div className="flex justify-center w-full">
                            <UntitledLogoMinimal className="size-8" />
                        </div>
                    ) : (
                        <UntitledLogo className="h-12" />
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                onClick={handleToggleCollapse}
                                className="absolute top-0 right-2 lg:right-3"
                            >
                                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isCollapsed ? "Expand sidebar" : "Collapse sidebar"}</TooltipContent>
                    </Tooltip>
                </div>
                {!isCollapsed && (
                    <div onClick={onSearchClick} className="cursor-pointer">
                        <Input
                            aria-label="Search"
                            placeholder="Search"
                            readOnly
                            className="pointer-events-none"
                        />
                    </div>
                )}
            </div>

            <NavList activeUrl={activeUrl} items={items} iconOnly={isCollapsed} />

            <div className={cx("mt-auto flex flex-col gap-4 py-4 lg:py-6", isCollapsed ? "px-2" : "px-2 lg:px-4")}>
                {footerItems.length > 0 && (
                    <ul className="flex flex-col">
                        {footerItems.map((item) => (
                            <li key={item.label} className="py-0.5">
                                <NavItemBase 
                                    badge={item.badge} 
                                    icon={item.icon} 
                                    href={item.href} 
                                    type="link" 
                                    current={item.href === activeUrl}
                                    iconOnly={isCollapsed}
                                >
                                    {item.label}
                                </NavItemBase>
                            </li>
                        ))}
                    </ul>
                )}

                {featureCard}

                {showAccountCard && <NavAccountCard iconOnly={isCollapsed} />}
            </div>
        </aside>
    );

    return (
        <>
            {/* Mobile header navigation */}
            <MobileNavigationHeader>{content}</MobileNavigationHeader>

            {/* Desktop sidebar navigation */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex">{content}</div>

            {/* Placeholder to take up physical space because the real sidebar has `fixed` position. */}
            <div
                style={{
                    paddingLeft: isCollapsed ? COLLAPSED_SIDEBAR_WIDTH : MAIN_SIDEBAR_WIDTH,
                }}
                className="invisible hidden lg:sticky lg:top-0 lg:bottom-0 lg:left-0 lg:block transition-all duration-300"
            />
        </>
    );
};

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { File as File01, Home as Home02, Map as Map01, Search as SearchLg, Settings as Settings01, Users as Users01, X as XClose } from "lucide-react";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Input } from "@/components/ui/input";
import { APP_NAV_ITEMS, FOOTER_NAV_ITEMS } from "@/config/nav";
import { cn as cx } from "@/lib/utils";

interface CommandPaletteProps {
    isOpen: boolean;
    setOpen: (open: boolean) => void;
}

export const CommandPalette = ({ isOpen, setOpen }: CommandPaletteProps) => {
    const [query, setQuery] = useState("");
    const router = useRouter();

    useHotkeys(
        "meta+k, ctrl+k",
        (e) => {
            e.preventDefault();
            setOpen(true);
        },
        {
            enableOnFormTags: true,
        },
    );

    const close = useCallback(() => {
        setOpen(false);
        setQuery("");
    }, [setOpen]);

    // Combine all navigation items for search
    const items = useMemo(() => {
        const mainItems = APP_NAV_ITEMS.map((item) => ({
            id: item.href,
            label: item.label,
            icon: item.icon,
            href: item.href,
            category: "Navigation",
        }));

        const footerItems = FOOTER_NAV_ITEMS.map((item) => ({
            id: item.href,
            label: item.label,
            icon: item.icon,
            href: item.href,
            category: "Account",
        }));

        return [...mainItems, ...footerItems];
    }, []);

    const filteredItems = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

    const categories = Array.from(new Set(filteredItems.map((item) => item.category)));

    const handleSelect = (item: any) => {
        if (item.href) {
            router.push(item.href);
        } else if (item.onClick) {
            item.onClick();
        }
        close();
    };

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={setOpen} isDismissable>
            <Modal className="max-w-lg overflow-hidden rounded-xl border border-secondary bg-primary shadow-2xl transition-all">
                <Dialog className="flex h-full max-h-[80vh] flex-col outline-none">
                    <div className="relative flex items-center border-b border-secondary bg-primary">
                        <SearchLg className="absolute left-4 size-5 text-fg-quaternary" />
                        <input
                            autoFocus
                            className="h-15 w-full bg-transparent pr-12 pl-12 text-lg text-primary outline-none placeholder:text-placeholder"
                            placeholder="Search for pages, properties or actions..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") close();
                                if (e.key === "Enter" && filteredItems.length > 0) {
                                    handleSelect(filteredItems[0]);
                                }
                            }}
                        />
                        <div className="absolute right-4 flex items-center gap-2">
                            <kbd className="hidden h-6 items-center justify-center rounded border border-secondary bg-secondary px-1.5 text-[10px] font-semibold text-fg-quaternary shadow-xs sm:flex">
                                ESC
                            </kbd>
                            <button onClick={close} className="rounded-md p-1 text-fg-quaternary transition-colors hover:bg-secondary">
                                <XClose className="size-5" />
                            </button>
                        </div>
                    </div>

                    <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                        {filteredItems.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl border border-secondary bg-secondary/50">
                                    <SearchLg className="size-7 text-fg-quaternary opacity-50" />
                                </div>
                                <h3 className="mb-1 text-lg font-semibold text-primary">No results found</h3>
                                <p className="text-tertiary">We couldn't find anything matching "{query}".</p>
                            </div>
                        ) : (
                            categories.map((category) => (
                                <div key={category} className="mb-6 last:mb-2">
                                    <h3 className="px-3 py-2 text-[11px] font-bold tracking-widest text-fg-brand-primary uppercase opacity-80">{category}</h3>
                                    <div className="mt-1 space-y-1">
                                        {filteredItems
                                            .filter((item) => item.category === category)
                                            .map((item) => {
                                                const Icon = item.icon;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleSelect(item)}
                                                        className="group flex w-full items-center gap-3.5 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-secondary"
                                                    >
                                                        <div className="flex size-10 items-center justify-center rounded-lg border border-secondary bg-primary shadow-xs transition-all group-hover:scale-105 group-hover:border-tertiary">
                                                            {Icon && <Icon className="size-5 text-fg-tertiary group-hover:text-fg-brand-primary" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-md font-semibold text-primary">{item.label}</div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                                                            <span className="text-xs font-medium text-fg-quaternary">Select</span>
                                                            <kbd className="flex size-5 items-center justify-center rounded border border-tertiary bg-primary text-[10px] font-bold text-fg-quaternary shadow-xs">
                                                                ↵
                                                            </kbd>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex items-center justify-between border-t border-secondary bg-secondary/50 px-6 py-4">
                        <div className="flex items-center gap-5">
                            <span className="flex items-center gap-2 text-xs font-medium text-fg-quaternary">
                                <kbd className="flex h-5 min-w-[20px] items-center justify-center rounded border border-secondary bg-primary px-1 shadow-xs">
                                    ↑↓
                                </kbd>
                                Navigate
                            </span>
                            <span className="flex items-center gap-2 text-xs font-medium text-fg-quaternary">
                                <kbd className="flex h-5 min-w-[20px] items-center justify-center rounded border border-secondary bg-primary px-1 shadow-xs">
                                    ↵
                                </kbd>
                                Select
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-fg-quaternary">
                            <kbd className="flex h-5 items-center justify-center rounded border border-secondary bg-primary px-1 shadow-xs">ESC</kbd>
                            to close
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};

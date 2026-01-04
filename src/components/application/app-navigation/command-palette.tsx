"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { SearchLg, XClose, Home02, Map01, File01, Users01, Settings01 } from "@untitledui/icons";
import { useHotkeys } from "react-hotkeys-hook";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { Input } from "@/components/base/input/input";
import { cx } from "@/utils/cx";
import { useRouter } from "next/navigation";
import { APP_NAV_ITEMS, FOOTER_NAV_ITEMS } from "@/config/nav";

interface CommandPaletteProps {
    isOpen: boolean;
    setOpen: (open: boolean) => void;
}

export const CommandPalette = ({ isOpen, setOpen }: CommandPaletteProps) => {
    const [query, setQuery] = useState("");
    const router = useRouter();

    useHotkeys("meta+k, ctrl+k", (e) => {
        e.preventDefault();
        setOpen(true);
    }, {
        enableOnFormTags: true,
    });

    const close = useCallback(() => {
        setOpen(false);
        setQuery("");
    }, [setOpen]);

    // Combine all navigation items for search
    const items = useMemo(() => {
        const mainItems = APP_NAV_ITEMS.map(item => ({
            id: item.href,
            label: item.label,
            icon: item.icon,
            href: item.href,
            category: "Navigation"
        }));

        const footerItems = FOOTER_NAV_ITEMS.map(item => ({
            id: item.href,
            label: item.label,
            icon: item.icon,
            href: item.href,
            category: "Account"
        }));

        return [...mainItems, ...footerItems];
    }, []);

    const filteredItems = items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
    );

    const categories = Array.from(new Set(filteredItems.map(item => item.category)));

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
            <Modal className="max-w-2xl bg-primary rounded-xl shadow-2xl overflow-hidden border border-secondary transition-all">
                <Dialog className="flex flex-col h-full max-h-[80vh] outline-none">
                    <div className="relative flex items-center border-b border-secondary bg-primary">
                        <SearchLg className="absolute left-4 size-5 text-fg-quaternary" />
                        <input
                            autoFocus
                            className="w-full h-15 pl-12 pr-12 bg-transparent text-lg text-primary outline-none placeholder:text-placeholder"
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
                            <kbd className="hidden sm:flex items-center justify-center h-6 px-1.5 rounded border border-secondary bg-secondary text-[10px] font-semibold text-fg-quaternary shadow-xs">
                                ESC
                            </kbd>
                            <button
                                onClick={close}
                                className="p-1 rounded-md hover:bg-secondary text-fg-quaternary transition-colors"
                            >
                                <XClose className="size-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {filteredItems.length === 0 ? (
                            <div className="py-16 text-center">
                                <div className="mx-auto size-14 rounded-xl border border-secondary bg-secondary/50 flex items-center justify-center mb-4">
                                    <SearchLg className="size-7 text-fg-quaternary opacity-50" />
                                </div>
                                <h3 className="text-lg font-semibold text-primary mb-1">No results found</h3>
                                <p className="text-tertiary">We couldn't find anything matching "{query}".</p>
                            </div>
                        ) : (
                            categories.map(category => (
                                <div key={category} className="mb-6 last:mb-2">
                                    <h3 className="px-3 py-2 text-[11px] font-bold text-fg-brand-primary uppercase tracking-widest opacity-80">
                                        {category}
                                    </h3>
                                    <div className="space-y-1 mt-1">
                                        {filteredItems
                                            .filter(item => item.category === category)
                                            .map(item => {
                                                const Icon = item.icon;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleSelect(item)}
                                                        className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-secondary text-left group transition-all duration-200"
                                                    >
                                                        <div className="flex items-center justify-center size-10 rounded-lg border border-secondary bg-primary shadow-xs group-hover:border-tertiary group-hover:scale-105 transition-all">
                                                            {Icon && <Icon className="size-5 text-fg-tertiary group-hover:text-fg-brand-primary" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-md font-semibold text-primary">{item.label}</div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-xs font-medium text-fg-quaternary">Select</span>
                                                            <kbd className="flex items-center justify-center size-5 rounded border border-tertiary bg-primary text-[10px] font-bold text-fg-quaternary shadow-xs">
                                                                ↵
                                                            </kbd>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        }
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="px-6 py-4 bg-secondary/50 border-t border-secondary flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <span className="flex items-center gap-2 text-xs text-fg-quaternary font-medium">
                                <kbd className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded bg-primary border border-secondary shadow-xs">↑↓</kbd>
                                Navigate
                            </span>
                            <span className="flex items-center gap-2 text-xs text-fg-quaternary font-medium">
                                <kbd className="flex items-center justify-center min-w-[20px] h-5 px-1 rounded bg-primary border border-secondary shadow-xs">↵</kbd>
                                Select
                            </span>
                        </div>
                        <div className="text-xs text-fg-quaternary font-medium flex items-center gap-2">
                            <kbd className="flex items-center justify-center h-5 px-1 rounded bg-primary border border-secondary shadow-xs">ESC</kbd>
                            to close
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};

"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/utils/cx";

export const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="h-9 w-full rounded-lg bg-secondary/50 animate-pulse" />;
    }

    const currentTheme = theme === "system" ? "light" : theme;

    return (
        <div className="flex bg-secondary p-1 rounded-xl">
            <button
                onClick={() => setTheme("light")}
                className={cx(
                    "flex flex-1 items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                    currentTheme === "light"
                        ? "bg-primary text-primary shadow-sm ring-1 ring-secondary"
                        : "text-tertiary hover:bg-primary_hover"
                )}
            >
                <Sun className="size-4" />
                Light
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={cx(
                    "flex flex-1 items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer",
                    currentTheme === "dark"
                        ? "bg-primary text-primary shadow-sm ring-1 ring-secondary"
                        : "text-tertiary hover:bg-primary_hover"
                )}
            >
                <Moon className="size-4" />
                Dark
            </button>
        </div>
    );
};

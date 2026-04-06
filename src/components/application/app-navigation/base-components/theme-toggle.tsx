"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn as cx } from "@/lib/utils";

export const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="h-9 w-full animate-pulse rounded-lg bg-secondary/50" />;
    }

    const currentTheme = theme === "system" ? "light" : theme;

    return (
        <div className="flex rounded-xl bg-secondary p-1">
            <button
                onClick={() => setTheme("light")}
                className={cx(
                    "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all",
                    currentTheme === "light" ? "bg-primary text-primary shadow-sm ring-1 ring-secondary" : "text-tertiary hover:bg-primary_hover",
                )}
            >
                <Sun className="size-4" />
                Light
            </button>
            <button
                onClick={() => setTheme("dark")}
                className={cx(
                    "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all",
                    currentTheme === "dark" ? "bg-primary text-primary shadow-sm ring-1 ring-secondary" : "text-tertiary hover:bg-primary_hover",
                )}
            >
                <Moon className="size-4" />
                Dark
            </button>
        </div>
    );
};

"use client";

import type { HTMLAttributes } from "react";
import { cn as cx } from "@/lib/utils";

export const SectionDivider = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div {...props} className={cx("mx-auto max-w-container px-4 md:px-8", props.className)}>
            <hr className="h-px w-full border-none bg-border-secondary" />
        </div>
    );
};

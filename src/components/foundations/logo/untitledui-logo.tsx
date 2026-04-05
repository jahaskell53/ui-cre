"use client";

import type { HTMLAttributes } from "react";
import Image from "next/image";
import { cn as cx } from "@/lib/utils";

export const UntitledLogo = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div {...props} className={cx("flex h-8 w-auto items-center overflow-visible", props.className)}>
            <Image src="/horizontal-logo.png" alt="Logo" width={225} height={48} className="hidden h-full w-auto brightness-0 lg:block dark:invert" priority />
            <Image src="/favicon.ico" alt="Logo" width={32} height={32} className="block h-full w-auto brightness-0 lg:hidden dark:invert" priority />
        </div>
    );
};

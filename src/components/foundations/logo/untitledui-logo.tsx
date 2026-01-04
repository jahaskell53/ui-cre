"use client";

import type { HTMLAttributes } from "react";
import Image from "next/image";
import { cx } from "@/utils/cx";

export const UntitledLogo = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div {...props} className={cx("flex h-8 w-auto items-center overflow-visible", props.className)}>
            <Image
                src="/horizontal-logo.png"
                alt="Logo"
                width={225}
                height={48}
                className="hidden lg:block h-full w-auto brightness-0 dark:invert"
                priority
            />
            <Image
                src="/favicon.ico"
                alt="Logo"
                width={32}
                height={32}
                className="block lg:hidden h-full w-auto brightness-0 dark:invert"
                priority
            />
        </div>
    );
};

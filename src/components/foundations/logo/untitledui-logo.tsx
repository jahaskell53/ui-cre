"use client";

import type { HTMLAttributes } from "react";
import Image from "next/image";
import { cx } from "@/utils/cx";

export const UntitledLogo = (props: HTMLAttributes<HTMLDivElement>) => {
    return (
        <div {...props} className={cx("flex h-12 w-full items-center justify-center overflow-visible", props.className)}>
            <Image
                src="/horizontal-logo.png"
                alt="Logo"
                width={225}
                height={48}
                className="h-full w-auto brightness-0 invert"
                priority
            />
        </div>
    );
};

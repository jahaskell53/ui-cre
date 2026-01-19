"use client";

import { BookOpen, Check, Copy, Box, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import { useClipboard } from "@/hooks/use-clipboard";

export const HomeScreen = () => {
    const clipboard = useClipboard();

    return (
        <div className="flex h-dvh flex-col">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 md:px-8">
                <div className="relative flex size-28 items-center justify-center">
                    <UntitledLogoMinimal className="size-10" />
                </div>

                <h1 className="max-w-3xl text-center text-display-sm font-semibold text-primary">Untitled UI Next.js starter kit</h1>

                <p className="mt-2 max-w-xl text-center text-lg text-tertiary">
                    Get started by using existing components that came with this starter kit or add new ones:
                </p>

                <div className="relative mt-6 flex h-10 items-center rounded-lg border border-secondary bg-secondary">
                    <code className="px-3 font-mono text-secondary">npx untitledui@latest add</code>

                    <hr className="h-10 w-px bg-border-secondary" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="mx-1 h-8 w-8"
                        onClick={() => clipboard.copy("npx untitledui@latest add")}
                    >
                        {clipboard.copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                </div>

                <div className="mt-6 flex items-center gap-3">
                    <Button
                        variant="link"
                        asChild
                    >
                        <a
                            href="https://www.untitledui.com/react/docs/introduction"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <BookOpen className="size-4" />
                            Docs
                        </a>
                    </Button>
                    <div className="h-px w-4 bg-brand-solid" />
                    <Button
                        variant="link"
                        asChild
                    >
                        <a
                            href="https://www.untitledui.com/react/resources/icons"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Box className="size-4" />
                            Icons
                        </a>
                    </Button>
                    <div className="h-px w-4 bg-brand-solid" />
                    <Button
                        variant="link"
                        asChild
                    >
                        <a
                            href="https://github.com/untitleduico/react/issues"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <HelpCircle className="size-4" />
                            Help
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
};

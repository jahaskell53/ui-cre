import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RouteProvider } from "@/providers/router-provider";
import { Theme } from "@/providers/theme";
import "@/styles/globals.css";
import { cx } from "@/utils/cx";
const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "App | OpenMidmarket",
    description: "OpenMidmarket is a platform for managing relationships, properties, and market intelligence in the commercial real estate midmarket space.",
    icons: {
        icon: "/favicon.ico",
    },
    openGraph: {
        title: "App | OpenMidmarket",
        description: "OpenMidmarket is a platform for managing relationships, properties, and market intelligence in the commercial real estate midmarket space.",
        images: "/og-preview.jpeg",
    },
};

export const viewport: Viewport = {
    themeColor: "#7f56d9",
    colorScheme: "light dark",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={cx(inter.variable, "bg-primary antialiased")}>
                <RouteProvider>
                    <Theme>{children}</Theme>
                </RouteProvider>
            </body>
        </html>
    );
}

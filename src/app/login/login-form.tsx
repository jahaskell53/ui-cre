"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/utils/supabase";

type LoginFormProps = {
    initialEmail: string;
    initialPassword: string;
};

function LoginFormInner({ initialEmail, initialPassword }: LoginFormProps) {
    const searchParams = useSearchParams();
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState(initialPassword);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                window.location.href = "/network";
            }
        });
    }, []);

    useEffect(() => {
        const queryError = searchParams.get("error");
        if (queryError) {
            setError(queryError);
            return;
        }

        if (typeof window !== "undefined" && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const errorCode = hashParams.get("error_code");
            const errorDescription = hashParams.get("error_description");

            if (errorCode === "otp_expired") {
                setError("Email link is invalid or has expired. Please request a new confirmation email.");
            } else if (errorDescription) {
                setError(decodeURIComponent(errorDescription));
            } else if (hashParams.get("error")) {
                setError("Authentication failed. Please try again.");
            }
        }
    }, [searchParams]);

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else {
            window.location.href = "/network";
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-gray-900">
            <div className="w-full max-w-md space-y-6">
                <div className="mb-8 flex flex-col items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-900 dark:bg-gray-100">
                        <span className="text-sm font-bold text-white dark:text-gray-900">OM</span>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Welcome Back</h1>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sign in to your account</p>
                    </div>
                </div>

                {error && (
                    <div className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Email
                        </label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isLoading) {
                                    handleLogin();
                                }
                            }}
                            disabled={isLoading}
                            className="h-10 border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Password
                        </label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isLoading) {
                                    handleLogin();
                                }
                            }}
                            disabled={isLoading}
                            className="h-10 border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                    </div>
                    <Button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className="h-10 w-full bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        {isLoading ? "Signing in..." : "Log In"}
                    </Button>
                </div>

                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Don&apos;t have an account?{" "}
                    <Link href="/signup" className="font-medium text-gray-900 hover:text-gray-700 dark:text-gray-100 dark:hover:text-gray-300">
                        Sign up
                    </Link>
                </div>
            </div>
        </div>
    );
}

export function LoginForm(props: LoginFormProps) {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-gray-900">
                    <div className="w-full max-w-md space-y-6">
                        <div className="mb-8 flex flex-col items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-900 dark:bg-gray-100">
                                <span className="text-sm font-bold text-white dark:text-gray-900">OM</span>
                            </div>
                            <div className="text-center">
                                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Welcome Back</h1>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sign in to your account</p>
                            </div>
                        </div>
                    </div>
                </div>
            }
        >
            <LoginFormInner {...props} />
        </Suspense>
    );
}

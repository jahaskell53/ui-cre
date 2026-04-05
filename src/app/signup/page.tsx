"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/utils/supabase";

function SignUpPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get("redirect");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const roles = ["Property Owner", "Broker", "Lender"];

    const toggleRole = (role: string) => {
        setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
    };

    const handleSignUp = async () => {
        setIsLoading(true);
        setError(null);

        const redirectUrl = redirect || "/network/connect";
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName || undefined,
                    roles: selectedRoles,
                },
                emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectUrl)}`,
            },
        });

        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else if (data.user && data.session) {
            // User is immediately logged in (email confirmation disabled)
            router.push(redirect || "/network/connect");
        } else {
            // Redirect to check email page
            const checkEmailUrl = `/signup/check-email?email=${encodeURIComponent(email)}`;
            if (redirect) {
                router.push(`${checkEmailUrl}&redirect=${encodeURIComponent(redirect)}`);
            } else {
                router.push(checkEmailUrl);
            }
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-gray-900">
            <div className="w-full max-w-md space-y-6">
                {/* Logo */}
                <div className="mb-8 flex flex-col items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-900 dark:bg-gray-100">
                        <span className="text-sm font-bold text-white dark:text-gray-900">OM</span>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create an account</h1>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sign up to get started</p>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Form */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="fullName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Full Name
                        </label>
                        <Input
                            id="fullName"
                            type="text"
                            placeholder="Enter your full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isLoading) {
                                    handleSignUp();
                                }
                            }}
                            disabled={isLoading}
                            className="h-10 border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                    </div>
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
                                    handleSignUp();
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
                            placeholder="Create a password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isLoading) {
                                    handleSignUp();
                                }
                            }}
                            disabled={isLoading}
                            className="h-10 border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">I am a (select all that apply):</label>
                        <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                            {roles.map((role) => (
                                <div key={role} className="flex items-center gap-2">
                                    <Checkbox id={role} checked={selectedRoles.includes(role)} onCheckedChange={() => toggleRole(role)} disabled={isLoading} />
                                    <label htmlFor={role} className="cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                                        {role}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Button
                        onClick={handleSignUp}
                        disabled={isLoading}
                        className="h-10 w-full bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                        {isLoading ? "Signing up..." : "Sign Up"}
                    </Button>
                </div>

                {/* Log In Link */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Already have an account?{" "}
                    <Link href="/login" className="font-medium text-gray-900 hover:text-gray-700 dark:text-gray-100 dark:hover:text-gray-300">
                        Log in
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function SignUpPage() {
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
                                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create an account</h1>
                            </div>
                        </div>
                    </div>
                </div>
            }
        >
            <SignUpPageContent />
        </Suspense>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function SignUpPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const roles = ["Property Owner", "Broker", "Lender"];

    const toggleRole = (role: string) => {
        setSelectedRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    const handleSignUp = async () => {
        setIsLoading(true);
        setError(null);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName || undefined,
                    roles: selectedRoles
                },
                emailRedirectTo: `${window.location.origin}/auth/callback?next=/network/connect`,
            }
        });

        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else if (data.user && data.session) {
            // User is immediately logged in (email confirmation disabled)
            router.push("/network/connect");
        } else {
            // Redirect to check email page
            router.push(`/signup/check-email?email=${encodeURIComponent(email)}`);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-gray-900 px-4">
            <div className="w-full max-w-md space-y-6">
                {/* Logo */}
                <div className="flex flex-col items-center gap-4 mb-8">
                    <div className="w-10 h-10 bg-gray-900 dark:bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-white dark:text-gray-900 text-sm font-bold">OM</span>
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Create an account</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Sign up to get started</p>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="w-full p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm">
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
                            className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                            className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
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
                            className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            I am a (select all that apply):
                        </label>
                        <div className="flex flex-col gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                            {roles.map((role) => (
                                <div key={role} className="flex items-center gap-2">
                                    <Checkbox
                                        id={role}
                                        checked={selectedRoles.includes(role)}
                                        onCheckedChange={() => toggleRole(role)}
                                        disabled={isLoading}
                                    />
                                    <label
                                        htmlFor={role}
                                        className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                                    >
                                        {role}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Button
                        onClick={handleSignUp}
                        disabled={isLoading}
                        className="w-full h-10 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                    >
                        {isLoading ? "Signing up..." : "Sign Up"}
                    </Button>
                </div>

                {/* Log In Link */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Already have an account?{" "}
                    <Link href="/login" className="text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 font-medium">
                        Log in
                    </Link>
                </div>
            </div>
        </div>
    );
}


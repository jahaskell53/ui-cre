"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);
        
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        setIsLoading(false);
        
        if (error) {
            setError(error.message);
        } else {
            window.location.href = "/people";
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
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Welcome Back</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Sign in to your account</p>
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
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !isLoading) {
                                    handleLogin();
                                }
                            }}
                            disabled={isLoading}
                            className="h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                    </div>
                    <Button
                        onClick={handleLogin}
                        disabled={isLoading}
                        className="w-full h-10 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                    >
                        {isLoading ? "Signing in..." : "Log In"}
                    </Button>
                </div>

                {/* Sign Up Link */}
                <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    Don't have an account?{" "}
                    <Link href="/signup" className="text-gray-900 dark:text-gray-100 hover:text-gray-700 dark:hover:text-gray-300 font-medium">
                        Sign up
                    </Link>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Checkbox } from "@/components/base/checkbox/checkbox";

export default function SignUpPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

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
        setMessage(null);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName || undefined,
                    roles: selectedRoles
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            }
        });

        setIsLoading(false);

        if (error) {
            setError(error.message);
        } else {
            setMessage("Check your email for a confirmation link!");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold">Create an account</h1>
                    <p className="text-tertiary mt-2">Sign up to get started</p>
                </div>

                {error && (
                    <div className="w-full p-3 rounded-lg bg-error-primary/10 text-error-primary text-sm">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="w-full p-3 rounded-lg bg-brand-primary/10 text-brand-primary text-sm">
                        {message}
                    </div>
                )}

                <div className="space-y-4">
                    <Input
                        label="Full Name"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={setFullName}
                        isDisabled={isLoading}
                    />
                    <Input
                        label="Email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={setEmail}
                        type="email"
                        isDisabled={isLoading}
                    />
                    <Input
                        type="password"
                        label="Password"
                        placeholder="Create a password"
                        value={password}
                        onChange={setPassword}
                        isDisabled={isLoading}
                    />

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-secondary">I am a (select all that apply):</label>
                        <div className="flex flex-col gap-3 p-4 border border-secondary rounded-xl bg-secondary/5">
                            {roles.map((role) => (
                                <Checkbox
                                    key={role}
                                    label={role}
                                    isSelected={selectedRoles.includes(role)}
                                    onChange={() => toggleRole(role)}
                                    isDisabled={isLoading}
                                />
                            ))}
                        </div>
                    </div>
                    <Button
                        onClick={handleSignUp}
                        isLoading={isLoading}
                        className="w-full"
                    >
                        Sign Up
                    </Button>
                </div>

                <div className="text-center text-sm text-tertiary">
                    Already have an account?{" "}
                    <Link href="/login" className="text-brand-solid hover:text-brand-solid_hover font-semibold">
                        Log in
                    </Link>
                </div>
            </div>
        </div>
    );
}


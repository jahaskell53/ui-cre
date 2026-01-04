"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleSignUp = async () => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        
        const { error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: { data: { full_name: "New User" } }
        });
        
        setIsLoading(false);
        
        if (error) {
            setError(error.message);
        } else {
            setMessage("Check your email for confirmation!");
        }
    };

    const handleLogin = async () => {
        setIsLoading(true);
        setError(null);
        setMessage(null);
        
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        setIsLoading(false);
        
        if (error) {
            setError(error.message);
        } else {
            window.location.href = "/";
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
            <h1 className="text-2xl font-bold">Welcome Back</h1>
            
            {error && (
                <div className="w-full max-w-md p-3 rounded-lg bg-error-primary/10 text-error-primary text-sm">
                    {error}
                </div>
            )}
            
            {message && (
                <div className="w-full max-w-md p-3 rounded-lg bg-brand-primary/10 text-brand-primary text-sm">
                    {message}
                </div>
            )}
            
            <div className="w-full max-w-md space-y-4">
                <Input 
                    placeholder="Email" 
                    value={email} 
                    onChange={setEmail}
                    type="email"
                    isDisabled={isLoading}
                />
                <Input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={setPassword}
                    isDisabled={isLoading}
                />
                <div className="flex gap-2">
                    <Button 
                        onClick={handleLogin}
                        isLoading={isLoading}
                        className="flex-1"
                    >
                        Log In
                    </Button>
                    <Button 
                        color="secondary" 
                        onClick={handleSignUp}
                        isLoading={isLoading}
                        className="flex-1"
                    >
                        Sign Up
                    </Button>
                </div>
            </div>
        </div>
    );
}

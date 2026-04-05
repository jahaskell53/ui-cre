"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddressInput } from "@/components/ui/address-input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePeople } from "../people-context";
import { generateAuroraGradient, getInitials } from "../utils";

function BackIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function TrashIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M2 4H14M6 4V2.5C6 1.67 6.67 1 7.5 1H8.5C9.33 1 10 1.67 10 2.5V4M12.5 4V13.5C12.5 14.33 11.83 15 11 15H5C4.17 15 3.5 14.33 3.5 13.5V4H12.5ZM7 7.5V12.5M9 7.5V12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function CreatePersonPage() {
    const router = useRouter();
    const { refetchPeople } = usePeople();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("details");

    // Form state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [category, setCategory] = useState<"Property Owner" | "Lender" | "Realtor" | "">("");
    const [address, setAddress] = useState("");
    const [ownedAddresses, setOwnedAddresses] = useState<string[]>([]);
    const [newOwnedAddress, setNewOwnedAddress] = useState("");
    const [linkedinUrl, setLinkedinUrl] = useState("");
    const [twitterUrl, setTwitterUrl] = useState("");
    const [instagramUrl, setInstagramUrl] = useState("");
    const [facebookUrl, setFacebookUrl] = useState("");

    const handleBack = () => {
        router.push("/network");
    };

    const handleAddOwnedAddress = () => {
        if (newOwnedAddress.trim()) {
            setOwnedAddresses([...ownedAddresses, newOwnedAddress.trim()]);
            setNewOwnedAddress("");
        }
    };

    const handleRemoveOwnedAddress = (index: number) => {
        setOwnedAddresses(ownedAddresses.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError("Name is required");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch("/api/people", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                    category: category || null,
                    address: address.trim() || null,
                    owned_addresses: ownedAddresses,
                    starred: false,
                    signal: false,
                    linkedin_url: linkedinUrl.trim() || null,
                    twitter_url: twitterUrl.trim() || null,
                    instagram_url: instagramUrl.trim() ? (instagramUrl.trim().startsWith("@") ? instagramUrl.trim().substring(1) : instagramUrl.trim()) : null,
                    facebook_url: facebookUrl.trim() || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to create person");
            }

            const data = await response.json();
            // Refetch people data after successful creation
            await refetchPeople();
            router.push(`/network/${data.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create person");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex h-screen bg-white dark:bg-gray-900">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {/* Top Header Bar */}
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                    <button onClick={handleBack} className="-ml-1.5 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                        <BackIcon className="h-5 w-5" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Contact</h1>
                    <div className="w-9" /> {/* Spacer for centering */}
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-2xl px-6 py-8">
                        {/* Profile Header */}
                        <div className="mb-8 flex items-center gap-4">
                            <Avatar className="h-20 w-20">
                                <AvatarFallback
                                    className="text-2xl font-medium text-white"
                                    style={{ background: generateAuroraGradient(name || "New Contact") }}
                                >
                                    {getInitials(name || "New Contact")}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{name || "New Contact"}</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a new contact to your network</p>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            </div>
                        )}

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
                                <TabsList className="h-auto space-x-6 bg-transparent p-0">
                                    <TabsTrigger
                                        value="details"
                                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 text-sm font-medium data-[state=active]:border-blue-600 data-[state=active]:text-gray-900 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-gray-100 dark:data-[state=inactive]:text-gray-400"
                                    >
                                        Details
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="social"
                                        className="rounded-none border-b-2 border-transparent bg-transparent px-0 py-2 text-sm font-medium data-[state=active]:border-blue-600 data-[state=active]:text-gray-900 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 dark:data-[state=active]:border-blue-400 dark:data-[state=active]:text-gray-100 dark:data-[state=inactive]:text-gray-400"
                                    >
                                        Social
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Details Tab */}
                            <TabsContent value="details" className="mt-0 space-y-6">
                                {/* Name */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name" className="w-full" />
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email" className="w-full" />
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                                    <Input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Enter phone number"
                                        className="w-full"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as "Property Owner" | "Lender" | "Realtor" | "")}
                                        className="h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-gray-600 dark:bg-input/30"
                                    >
                                        <option value="">Select category</option>
                                        <option value="Property Owner">Property Owner</option>
                                        <option value="Lender">Lender</option>
                                        <option value="Realtor">Realtor</option>
                                    </select>
                                </div>

                                {/* Address */}
                                <div>
                                    <AddressInput label="Home Address" value={address} onChange={setAddress} placeholder="Search for an address..." />
                                </div>

                                {/* Owned Addresses */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Owned Addresses</label>
                                    <div className="space-y-3">
                                        {ownedAddresses.map((addr, index) => (
                                            <div key={index} className="flex items-start gap-2">
                                                <div className="flex-1">
                                                    <AddressInput
                                                        value={addr}
                                                        onChange={(value) => {
                                                            const updated = [...ownedAddresses];
                                                            updated[index] = value;
                                                            setOwnedAddresses(updated);
                                                        }}
                                                        placeholder="Search for an address..."
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveOwnedAddress(index)}
                                                    className="mt-1 p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                                    type="button"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1">
                                                <AddressInput value={newOwnedAddress} onChange={setNewOwnedAddress} placeholder="Search for an address..." />
                                            </div>
                                            <Button
                                                onClick={handleAddOwnedAddress}
                                                disabled={!newOwnedAddress.trim()}
                                                type="button"
                                                variant="outline"
                                                className="mt-1"
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Social Tab */}
                            <TabsContent value="social" className="mt-0 space-y-4">
                                {/* LinkedIn */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">LinkedIn</label>
                                    <Input
                                        type="url"
                                        value={linkedinUrl}
                                        onChange={(e) => setLinkedinUrl(e.target.value)}
                                        placeholder="https://linkedin.com/in/username"
                                        className="w-full"
                                    />
                                </div>

                                {/* Twitter/X */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Twitter/X</label>
                                    <Input
                                        type="url"
                                        value={twitterUrl}
                                        onChange={(e) => setTwitterUrl(e.target.value)}
                                        placeholder="https://twitter.com/username"
                                        className="w-full"
                                    />
                                </div>

                                {/* Instagram */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Instagram</label>
                                    <Input
                                        type="text"
                                        value={instagramUrl}
                                        onChange={(e) => setInstagramUrl(e.target.value)}
                                        placeholder="@username"
                                        className="w-full"
                                    />
                                </div>

                                {/* Facebook */}
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Facebook</label>
                                    <Input
                                        type="url"
                                        value={facebookUrl}
                                        onChange={(e) => setFacebookUrl(e.target.value)}
                                        placeholder="https://facebook.com/username"
                                        className="w-full"
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>

                        {/* Action Buttons */}
                        <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-800">
                            <Button onClick={handleBack} variant="outline" disabled={saving}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={saving || !name.trim()}
                                className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                            >
                                {saving ? "Creating..." : "Create Contact"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

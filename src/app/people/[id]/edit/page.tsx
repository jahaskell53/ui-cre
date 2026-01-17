"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/ui/address-input";
import { generateAuroraGradient, getInitials } from "../../utils";

// Person interface
interface Person {
  id: string;
  name: string;
  starred: boolean;
  email: string | null;
  phone: string | null;
  category: 'Property Owner' | 'Lender' | 'Realtor' | null;
  signal: boolean;
  address: string | null;
  owned_addresses?: string[];
  timeline?: any[];
  created_at?: string;
  updated_at?: string;
}

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
      <path d="M2 4H14M6 4V2.5C6 1.67 6.67 1 7.5 1H8.5C9.33 1 10 1.67 10 2.5V4M12.5 4V13.5C12.5 14.33 11.83 15 11 15H5C4.17 15 3.5 14.33 3.5 13.5V4H12.5ZM7 7.5V12.5M9 7.5V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EditPersonPage() {
  const params = useParams();
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<'Property Owner' | 'Lender' | 'Realtor' | ''>("");
  const [address, setAddress] = useState("");
  const [ownedAddresses, setOwnedAddresses] = useState<string[]>([]);
  const [newOwnedAddress, setNewOwnedAddress] = useState("");

  const personId = params.id as string;

  useEffect(() => {
    const fetchPerson = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/people?id=${personId}`);
        if (!response.ok) {
          throw new Error("Person not found");
        }
        const data = await response.json();
        setPerson(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setCategory(data.category || "");
        setAddress(data.address || "");
        setOwnedAddresses(data.owned_addresses || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load person");
      } finally {
        setLoading(false);
      }
    };

    if (personId) {
      fetchPerson();
    }
  }, [personId]);

  const handleBack = () => {
    router.push(`/people/${personId}`);
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
      const response = await fetch(`/api/people?id=${personId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          category: category || null,
          address: address.trim() || null,
          owned_addresses: ownedAddresses,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update person");
      }

      router.push(`/people/${personId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error && !person) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</div>
          <button
            onClick={handleBack}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to Person
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={handleBack}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit Person</h1>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8">
            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-8">
              <Avatar className="h-20 w-20">
                <AvatarFallback
                  className="text-white text-2xl font-medium"
                  style={{ background: generateAuroraGradient(name || person?.name || "") }}
                >
                  {getInitials(name || person?.name || "")}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {name || person?.name || "Edit Person"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Update person details
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  className="w-full"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone
                </label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'Property Owner' | 'Lender' | 'Realtor' | '')}
                  className="w-full h-9 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none dark:bg-input/30"
                >
                  <option value="">Select category</option>
                  <option value="Property Owner">Property Owner</option>
                  <option value="Lender">Lender</option>
                  <option value="Realtor">Realtor</option>
                </select>
              </div>

              {/* Address */}
              <div>
                <AddressInput
                  label="Home Address"
                  value={address}
                  onChange={setAddress}
                  placeholder="Search for an address..."
                />
              </div>

              {/* Owned Addresses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Owned Addresses
                </label>
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
                        className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 mt-1"
                        type="button"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <AddressInput
                        value={newOwnedAddress}
                        onChange={setNewOwnedAddress}
                        placeholder="Search for an address..."
                      />
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
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <Button
                onClick={handleBack}
                variant="outline"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useState, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/base/buttons/button";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Avatar } from "@/components/base/avatar/avatar";
import { useUser } from "@/hooks/use-user";
import { UploadCloud02, Check, X, CheckCircle } from "@untitledui/icons";

interface ParsedContact {
    firstName: string;
    lastName: string;
    emailAddress: string;
    company: string;
    position: string;
}

interface Contact {
    id: string;
    user_id: string;
    first_name: string;
    last_name: string;
    email_address: string;
    company: string | null;
    position: string | null;
    created_at: string;
    updated_at: string;
}

export default function ContactsPage() {
    const { user, loading: userLoading } = useUser();
    const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<Set<number>>(new Set());
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadContacts = useCallback(async () => {
        if (!user) return;
        
        setLoading(true);
        try {
            const response = await fetch("/api/contacts");
            if (!response.ok) {
                throw new Error("Failed to load contacts");
            }
            const data = await response.json();
            setContacts(data);
        } catch (error) {
            console.error("Error loading contacts:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    const parseCSV = (text: string): ParsedContact[] => {
        const lines = text.split("\n").filter(line => line.trim());
        if (lines.length < 2) return [];

        // Parse CSV line handling quoted fields
        const parseCSVLine = (line: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        // Escaped quote
                        current += '"';
                        i++; // Skip next quote
                    } else {
                        // Toggle quote state
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // End of field
                    result.push(current.trim());
                    current = "";
                } else {
                    current += char;
                }
            }
            result.push(current.trim()); // Add last field
            return result;
        };

        const headers = parseCSVLine(lines[0]).map(h => h.trim());
        
        // Find column indices
        const firstNameIdx = headers.findIndex(h => h.toLowerCase() === "first name");
        const lastNameIdx = headers.findIndex(h => h.toLowerCase() === "last name");
        const emailIdx = headers.findIndex(h => h.toLowerCase() === "email address");
        const companyIdx = headers.findIndex(h => h.toLowerCase() === "company");
        const positionIdx = headers.findIndex(h => h.toLowerCase() === "position");

        if (firstNameIdx === -1 || lastNameIdx === -1 || emailIdx === -1) {
            throw new Error("CSV must contain 'First Name', 'Last Name', and 'Email Address' columns");
        }

        const parsed: ParsedContact[] = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            
            if (values[firstNameIdx] && values[lastNameIdx] && values[emailIdx]) {
                parsed.push({
                    firstName: values[firstNameIdx] || "",
                    lastName: values[lastNameIdx] || "",
                    emailAddress: values[emailIdx] || "",
                    company: companyIdx !== -1 ? (values[companyIdx] || "") : "",
                    position: positionIdx !== -1 ? (values[positionIdx] || "") : "",
                });
            }
        }

        return parsed;
    };

    const handleFileUpload = async (files: FileList) => {
        if (files.length === 0) return;

        const file = files[0];
        if (!file.name.endsWith(".csv")) {
            setError("Please upload a CSV file");
            return;
        }

        setError(null);
        setSuccess(null);
        setUploading(true);
        try {
            const text = await file.text();
            const parsed = parseCSV(text);
            
            if (parsed.length === 0) {
                setError("No valid contacts found in CSV file");
                return;
            }

            setParsedContacts(parsed);
            setSelectedContacts(new Set(parsed.map((_, idx) => idx)));
            setSuccess(`Found ${parsed.length} contact(s) in CSV file`);
        } catch (error) {
            console.error("Error parsing CSV:", error);
            setError(error instanceof Error ? error.message : "Failed to parse CSV file");
        } finally {
            setUploading(false);
        }
    };

    const toggleContactSelection = (index: number) => {
        const newSelected = new Set(selectedContacts);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedContacts(newSelected);
    };

    const toggleAllContacts = () => {
        if (selectedContacts.size === parsedContacts.length) {
            setSelectedContacts(new Set());
        } else {
            setSelectedContacts(new Set(parsedContacts.map((_, idx) => idx)));
        }
    };

    const handleImport = async () => {
        if (selectedContacts.size === 0) {
            setError("Please select at least one contact to import");
            return;
        }

        setError(null);
        setSuccess(null);
        setImporting(true);
        try {
            const contactsToImport = Array.from(selectedContacts).map(idx => parsedContacts[idx]);
            
            const response = await fetch("/api/contacts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ contacts: contactsToImport }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to import contacts");
            }

            // Clear parsed contacts and reload
            setParsedContacts([]);
            setSelectedContacts(new Set());
            loadContacts();
            setSuccess(`Successfully imported ${contactsToImport.length} contact(s)`);
        } catch (error) {
            console.error("Error importing contacts:", error);
            setError(error instanceof Error ? error.message : "Failed to import contacts");
        } finally {
            setImporting(false);
        }
    };

    useEffect(() => {
        if (!userLoading && user) {
            loadContacts();
        }
    }, [user, userLoading, loadContacts]);

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
    };

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                <h1 className="text-display-sm font-semibold text-primary mb-2">Contacts</h1>
                <p className="text-lg text-tertiary mb-8">Manage your contact list and import contacts from CSV files.</p>

                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-error-primary/10 border border-error-primary/20 text-error-primary text-sm">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-6 p-4 rounded-lg bg-success-primary/10 border border-success-primary/20 flex items-center gap-2 text-success-primary text-sm">
                        <CheckCircle className="size-5 stroke-[2.5px] text-fg-success-primary flex-shrink-0" />
                        <span>{success}</span>
                    </div>
                )}

                {parsedContacts.length === 0 ? (
                    <div className="bg-primary border border-secondary rounded-2xl p-8">
                        <FileUpload.Root>
                            <FileUpload.DropZone
                                accept=".csv"
                                allowsMultiple={false}
                                hint="CSV file with First Name, Last Name, Email Address, Company, and Position columns"
                                onDropFiles={handleFileUpload}
                            />
                        </FileUpload.Root>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-primary border border-secondary rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-primary mb-1">
                                        Select Contacts to Import
                                    </h2>
                                    <p className="text-sm text-tertiary">
                                        {selectedContacts.size} of {parsedContacts.length} selected
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        color="secondary"
                                        onClick={() => {
                                            setParsedContacts([]);
                                            setSelectedContacts(new Set());
                                            setError(null);
                                            setSuccess(null);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        color="primary"
                                        onClick={handleImport}
                                        isDisabled={selectedContacts.size === 0 || importing}
                                        iconLeading={importing ? undefined : Check}
                                    >
                                        {importing ? "Importing..." : `Import ${selectedContacts.size} Contact(s)`}
                                    </Button>
                                </div>
                            </div>

                            <div className="mb-4">
                                <Checkbox
                                    isSelected={selectedContacts.size === parsedContacts.length && parsedContacts.length > 0}
                                    isIndeterminate={selectedContacts.size > 0 && selectedContacts.size < parsedContacts.length}
                                    onChange={toggleAllContacts}
                                    label="Select All"
                                />
                            </div>

                            <div className="max-h-[600px] overflow-y-auto divide-y divide-secondary">
                                {parsedContacts.map((contact, index) => (
                                    <div
                                        key={index}
                                        className="p-4 hover:bg-secondary/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Checkbox
                                                isSelected={selectedContacts.has(index)}
                                                onChange={() => toggleContactSelection(index)}
                                            />
                                            <Avatar
                                                size="md"
                                                initials={getInitials(contact.firstName, contact.lastName)}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm text-primary">
                                                    {contact.firstName} {contact.lastName}
                                                </div>
                                                <div className="text-sm text-secondary mt-1">
                                                    {contact.emailAddress}
                                                </div>
                                                {(contact.company || contact.position) && (
                                                    <div className="text-xs text-tertiary mt-1">
                                                        {contact.position && contact.company
                                                            ? `${contact.position} at ${contact.company}`
                                                            : contact.position || contact.company}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {contacts.length > 0 && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-primary">Your Contacts</h2>
                            <Button
                                color="secondary"
                                size="sm"
                                onClick={() => {
                                    setParsedContacts([]);
                                    setSelectedContacts(new Set());
                                    setError(null);
                                    setSuccess(null);
                                }}
                                iconLeading={UploadCloud02}
                            >
                                Upload More
                            </Button>
                        </div>
                        <div className="bg-primary border border-secondary rounded-2xl overflow-hidden">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-tertiary">Loading contacts...</div>
                                </div>
                            ) : (
                                <div className="divide-y divide-secondary">
                                    {contacts.map((contact) => (
                                        <div key={contact.id} className="p-4">
                                            <div className="flex items-center gap-4">
                                                <Avatar
                                                    size="md"
                                                    initials={getInitials(contact.first_name, contact.last_name)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm text-primary">
                                                        {contact.first_name} {contact.last_name}
                                                    </div>
                                                    <div className="text-sm text-secondary mt-1">
                                                        {contact.email_address}
                                                    </div>
                                                    {(contact.company || contact.position) && (
                                                        <div className="text-xs text-tertiary mt-1">
                                                            {contact.position && contact.company
                                                                ? `${contact.position} at ${contact.company}`
                                                                : contact.position || contact.company}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}


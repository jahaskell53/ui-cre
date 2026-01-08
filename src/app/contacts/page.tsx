"use client";

import { useState, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Avatar } from "@/components/base/avatar/avatar";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { useUser } from "@/hooks/use-user";
import { UploadCloud02, Check, X, CheckCircle, Trash01, Edit01, LayoutGrid01, List, SearchLg } from "@untitledui/icons";
import { Kanban } from "react-kanban-kit";

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
    phone_number: string | null;
    status: string | null;
    notes: string | null;
    home_address: string | null;
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
    const [selectedSavedContacts, setSelectedSavedContacts] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editFormData, setEditFormData] = useState({
        first_name: "",
        last_name: "",
        email_address: "",
        company: "",
        position: "",
        phone_number: "",
        notes: "",
        home_address: "",
    });
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
    const [kanbanColumns, setKanbanColumns] = useState<string[]>([
        "Active Prospecting",
        "Offering Memorandum",
        "Underwriting",
        "Due Diligence",
        "Closed/Archive",
    ]);
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

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

    const toggleSavedContactSelection = (contactId: string) => {
        const newSelected = new Set(selectedSavedContacts);
        if (newSelected.has(contactId)) {
            newSelected.delete(contactId);
        } else {
            newSelected.add(contactId);
        }
        setSelectedSavedContacts(newSelected);
    };

    const toggleAllSavedContacts = () => {
        const filtered = filterContacts(contacts, searchQuery);
        if (selectedSavedContacts.size === filtered.length) {
            setSelectedSavedContacts(new Set());
        } else {
            setSelectedSavedContacts(new Set(filtered.map(c => c.id)));
        }
    };

    const handleDeleteSelectedContacts = async () => {
        if (selectedSavedContacts.size === 0) {
            setError("Please select at least one contact to delete");
            return;
        }

        setError(null);
        setSuccess(null);
        setDeleting(true);
        
        try {
            const contactIds = Array.from(selectedSavedContacts);
            
            // Delete all selected contacts
            const deletePromises = contactIds.map(contactId =>
                fetch(`/api/contacts?id=${contactId}`, {
                    method: "DELETE",
                })
            );

            const results = await Promise.all(deletePromises);
            const failed = results.some(r => !r.ok);

            if (failed) {
                throw new Error("Failed to delete some contacts");
            }

            // Remove from local state
            setContacts(contacts.filter(c => !selectedSavedContacts.has(c.id)));
            setSelectedSavedContacts(new Set());
            setSuccess(`Successfully deleted ${contactIds.length} contact(s)`);
        } catch (error) {
            console.error("Error deleting contacts:", error);
            setError(error instanceof Error ? error.message : "Failed to delete contacts");
        } finally {
            setDeleting(false);
        }
    };

    const handleEditContact = (contact: Contact) => {
        setEditingContact(contact);
        setEditFormData({
            first_name: contact.first_name,
            last_name: contact.last_name,
            email_address: contact.email_address,
            company: contact.company || "",
            position: contact.position || "",
            phone_number: contact.phone_number || "",
            notes: contact.notes || "",
            home_address: contact.home_address || "",
        });
        setError(null);
        setSuccess(null);
    };

    const handleSaveEdit = async () => {
        if (!editingContact) return;

        if (!editFormData.first_name.trim() || !editFormData.last_name.trim() || !editFormData.email_address.trim()) {
            setError("First name, last name, and email address are required");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/api/contacts?id=${editingContact.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    first_name: editFormData.first_name.trim(),
                    last_name: editFormData.last_name.trim(),
                    email_address: editFormData.email_address.trim(),
                    company: editFormData.company.trim() || null,
                    position: editFormData.position.trim() || null,
                    phone_number: editFormData.phone_number.trim() || null,
                    notes: editFormData.notes.trim() || null,
                    home_address: editFormData.home_address.trim() || null,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update contact");
            }

            // Update local state
            setContacts(contacts.map(c =>
                c.id === editingContact.id
                    ? {
                          ...c,
                          first_name: editFormData.first_name.trim(),
                          last_name: editFormData.last_name.trim(),
                          email_address: editFormData.email_address.trim(),
                          company: editFormData.company.trim() || null,
                          position: editFormData.position.trim() || null,
                          phone_number: editFormData.phone_number.trim() || null,
                          notes: editFormData.notes.trim() || null,
                          home_address: editFormData.home_address.trim() || null,
                      }
                    : c
            ));

            setEditingContact(null);
            setSuccess("Contact updated successfully");
        } catch (error) {
            console.error("Error updating contact:", error);
            setError(error instanceof Error ? error.message : "Failed to update contact");
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
    };

    const formatPhoneNumber = (phone: string): string => {
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, "");
        
        // Remove leading 1 if present (US country code)
        const cleaned = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
        
        // Format as (XXX) XXX-XXXX
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        
        // If not 10 digits, return original
        return phone;
    };

    const filterContacts = (contacts: Contact[], query: string): Contact[] => {
        if (!query.trim()) {
            return contacts;
        }

        const searchTerm = query.toLowerCase().trim();
        
        return contacts.filter(contact => {
            const searchableFields = [
                contact.first_name,
                contact.last_name,
                contact.email_address,
                contact.company,
                contact.position,
                contact.phone_number,
                contact.status,
                contact.notes,
                contact.home_address,
            ].filter(field => field !== null && field !== undefined);

            return searchableFields.some(field => 
                field.toLowerCase().includes(searchTerm)
            );
        });
    };

    const buildKanbanData = (): any => {
        const rootChildren = kanbanColumns.map((col, idx) => `col-${idx}`);
        const filteredContacts = filterContacts(contacts, searchQuery);
        
        const dataSource: any = {
            root: {
                id: "root",
                title: "Root",
                children: rootChildren,
                totalChildrenCount: kanbanColumns.length,
                parentId: null,
            },
        };

        kanbanColumns.forEach((columnTitle, idx) => {
            const columnId = `col-${idx}`;
            const columnContacts = filteredContacts.filter(
                c => (c.status || "Active Prospecting") === columnTitle
            );
            const cardIds = columnContacts.map(c => `card-${c.id}`);

            dataSource[columnId] = {
                id: columnId,
                title: columnTitle,
                children: cardIds,
                totalChildrenCount: columnContacts.length,
                parentId: "root",
            };

            columnContacts.forEach(contact => {
                dataSource[`card-${contact.id}`] = {
                    id: `card-${contact.id}`,
                    title: `${contact.first_name} ${contact.last_name}`,
                    parentId: columnId,
                    children: [],
                    totalChildrenCount: 0,
                    type: "card",
                    content: contact,
                };
            });
        });

        return dataSource;
    };

    const configMap: any = {
        card: {
            render: ({ data }: { data: any }) => {
                const contact = data.content as Contact;
                return (
                    <div 
                        className="p-3 bg-primary border border-secondary rounded-lg hover:bg-secondary/5 transition-colors cursor-pointer"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditContact(contact);
                        }}
                    >
                        <div className="flex items-start gap-3">
                            <Avatar
                                size="sm"
                                initials={getInitials(contact.first_name, contact.last_name)}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-primary">
                                    {contact.first_name} {contact.last_name}
                                </div>
                                <div className="text-xs text-secondary mt-1">
                                    {contact.email_address}
                                </div>
                                {contact.phone_number && (
                                    <div className="text-xs text-secondary mt-1">
                                        {formatPhoneNumber(contact.phone_number)}
                                    </div>
                                )}
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
                );
            },
            isDraggable: true,
        },
    };

    const handleCardMove = async (move: any) => {
        const contactId = move.cardId.replace("card-", "");
        const columnIndex = parseInt(move.toColumnId.replace("col-", ""));
        const newStatus = kanbanColumns[columnIndex];

        if (!newStatus) {
            console.error("Invalid column index:", columnIndex);
            return;
        }

        try {
            const response = await fetch(`/api/contacts?id=${contactId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    status: newStatus,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to update contact status");
            }

            // Update local state
            setContacts(contacts.map(c =>
                c.id === contactId ? { ...c, status: newStatus } : c
            ));
        } catch (error) {
            console.error("Error updating contact status:", error);
            setError("Failed to update contact status");
        }
    };

    const handleAddColumn = () => {
        setIsAddColumnModalOpen(true);
        setNewColumnName("");
    };

    const handleSaveNewColumn = () => {
        if (newColumnName && newColumnName.trim()) {
            setKanbanColumns([...kanbanColumns, newColumnName.trim()]);
            setIsAddColumnModalOpen(false);
            setNewColumnName("");
        }
    };

    return (
        <MainLayout>
            <div className={viewMode === "kanban" ? "max-w-full mx-auto px-4" : "max-w-6xl mx-auto"}>
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
                            <div className="flex gap-3">
                                <Input
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    icon={SearchLg}
                                    size="sm"
                                    className="w-64"
                                />
                                <div className="flex gap-1 bg-secondary/10 rounded-lg p-1">
                                    <Button
                                        color={viewMode === "list" ? "primary" : "secondary"}
                                        size="sm"
                                        iconLeading={List}
                                        onClick={() => setViewMode("list")}
                                        className="!px-3"
                                    />
                                    <Button
                                        color={viewMode === "kanban" ? "primary" : "secondary"}
                                        size="sm"
                                        iconLeading={LayoutGrid01}
                                        onClick={() => setViewMode("kanban")}
                                        className="!px-3"
                                    />
                                </div>
                                {selectedSavedContacts.size > 0 && (
                                    <Button
                                        color="secondary"
                                        size="sm"
                                        onClick={handleDeleteSelectedContacts}
                                        isDisabled={deleting}
                                        iconLeading={Trash01}
                                    >
                                        {deleting ? "Deleting..." : `Delete ${selectedSavedContacts.size} Contact(s)`}
                                    </Button>
                                )}
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
                        </div>
                        {viewMode === "list" ? (
                            <div className="bg-primary border border-secondary rounded-2xl overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-tertiary">Loading contacts...</div>
                                    </div>
                                ) : (
                                    <>
                                        {(() => {
                                            const filteredContacts = filterContacts(contacts, searchQuery);
                                            return (
                                                <>
                                                    {filteredContacts.length > 0 && (
                                                        <div className="p-4 border-b border-secondary">
                                                            <Checkbox
                                                                isSelected={selectedSavedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                                                                isIndeterminate={selectedSavedContacts.size > 0 && selectedSavedContacts.size < filteredContacts.length}
                                                                onChange={() => {
                                                                    const filtered = filterContacts(contacts, searchQuery);
                                                                    if (selectedSavedContacts.size === filtered.length) {
                                                                        setSelectedSavedContacts(new Set());
                                                                    } else {
                                                                        setSelectedSavedContacts(new Set(filtered.map(c => c.id)));
                                                                    }
                                                                }}
                                                                label="Select All"
                                                            />
                                                        </div>
                                                    )}
                                                    {filteredContacts.length === 0 ? (
                                                        <div className="flex items-center justify-center py-12">
                                                            <div className="text-tertiary">No contacts found matching your search.</div>
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-secondary">
                                                            {filteredContacts.map((contact) => (
                                                <div key={contact.id} className="p-4 hover:bg-secondary/5 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <Checkbox
                                                            isSelected={selectedSavedContacts.has(contact.id)}
                                                            onChange={() => toggleSavedContactSelection(contact.id)}
                                                        />
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
                                                            {contact.phone_number && (
                                                                <div className="text-sm text-secondary mt-1">
                                                                    {formatPhoneNumber(contact.phone_number)}
                                                                </div>
                                                            )}
                                                            {(contact.company || contact.position) && (
                                                                <div className="text-xs text-tertiary mt-1">
                                                                    {contact.position && contact.company
                                                                        ? `${contact.position} at ${contact.company}`
                                                                        : contact.position || contact.company}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <ButtonUtility
                                                            color="tertiary"
                                                            tooltip="Edit contact"
                                                            icon={Edit01}
                                                            size="sm"
                                                            onClick={() => handleEditContact(contact)}
                                                        />
                                                    </div>
                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="bg-primary border border-secondary rounded-2xl overflow-hidden p-4">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-tertiary">Loading contacts...</div>
                                    </div>
                                ) : (
                                    <div className="w-full overflow-x-auto">
                                        <Kanban
                                            dataSource={buildKanbanData()}
                                            configMap={configMap}
                                            onCardMove={handleCardMove}
                                            allowColumnAdder={true}
                                            renderColumnAdder={() => (
                                                <Button
                                                    color="secondary"
                                                    size="sm"
                                                    onClick={handleAddColumn}
                                                    className="w-full"
                                                >
                                                    + Add Column
                                                </Button>
                                            )}
                                            renderColumnHeader={(column) => (
                                                <div className="flex items-center justify-between p-3 border-b border-secondary">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-primary">{column.title}</h3>
                                                        <span className="text-sm text-tertiary">({column.totalChildrenCount})</span>
                                                    </div>
                                                </div>
                                            )}
                                            columnWrapperStyle={() => ({
                                                backgroundColor: "transparent",
                                                border: "1px solid rgb(var(--color-secondary))",
                                                borderRadius: "0.75rem",
                                                minWidth: "280px",
                                            })}
                                            columnStyle={() => ({
                                                minHeight: "400px",
                                                overflowY: "auto",
                                            })}
                                            cardsGap={8}
                                            rootStyle={{ width: "100%" }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {editingContact && (
                    <ModalOverlay isOpen={!!editingContact} onOpenChange={(isOpen) => !isOpen && setEditingContact(null)}>
                        <Modal>
                            <Dialog className="w-full max-w-2xl mx-auto bg-primary rounded-xl shadow-lg p-6">
                                {({ close }) => (
                                    <div className="w-full space-y-4">
                                        <div className="flex items-center justify-between border-b border-secondary pb-4 -mx-6 px-6 mb-2">
                                            <h2 className="text-lg font-semibold text-primary">Edit Contact</h2>
                                            <Button
                                                color="tertiary"
                                                size="sm"
                                                iconLeading={X}
                                                onClick={close}
                                                className="p-1"
                                            />
                                        </div>

                                        {error && (
                                            <div className="p-4 rounded-lg bg-error-primary/10 border border-error-primary/20 text-error-primary text-sm">
                                                {error}
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <Input
                                                    label="First Name"
                                                    value={editFormData.first_name}
                                                    onChange={(value) => setEditFormData({ ...editFormData, first_name: value })}
                                                    placeholder="First Name"
                                                    isRequired
                                                />
                                                <Input
                                                    label="Last Name"
                                                    value={editFormData.last_name}
                                                    onChange={(value) => setEditFormData({ ...editFormData, last_name: value })}
                                                    placeholder="Last Name"
                                                    isRequired
                                                />
                                            </div>
                                            <Input
                                                label="Email Address"
                                                type="email"
                                                value={editFormData.email_address}
                                                onChange={(value) => setEditFormData({ ...editFormData, email_address: value })}
                                                placeholder="email@example.com"
                                                isRequired
                                            />
                                            <Input
                                                label="Phone Number"
                                                type="tel"
                                                value={formatPhoneNumber(editFormData.phone_number)}
                                                onChange={(value) => {
                                                    // Remove all non-digit characters for storage
                                                    const digits = value.replace(/\D/g, "");
                                                    // Remove leading 1 if present
                                                    const cleaned = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
                                                    setEditFormData({ ...editFormData, phone_number: cleaned });
                                                }}
                                                placeholder="(555) 123-4567"
                                            />
                                            <Input
                                                label="Company"
                                                value={editFormData.company}
                                                onChange={(value) => setEditFormData({ ...editFormData, company: value })}
                                                placeholder="Company"
                                            />
                                            <Input
                                                label="Position"
                                                value={editFormData.position}
                                                onChange={(value) => setEditFormData({ ...editFormData, position: value })}
                                                placeholder="Position"
                                            />
                                            <Input
                                                label="Home Address"
                                                value={editFormData.home_address}
                                                onChange={(value) => setEditFormData({ ...editFormData, home_address: value })}
                                                placeholder="123 Main St, Springfield"
                                            />
                                            <TextArea
                                                label="Notes"
                                                value={editFormData.notes}
                                                onChange={(value: string) => setEditFormData({ ...editFormData, notes: value })}
                                                placeholder="Add notes about this contact..."
                                                rows={6}
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t border-secondary">
                                            <Button
                                                color="secondary"
                                                onClick={close}
                                                isDisabled={saving}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                color="primary"
                                                onClick={handleSaveEdit}
                                                isDisabled={saving}
                                                iconLeading={saving ? undefined : Check}
                                            >
                                                {saving ? "Saving..." : "Save Changes"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Dialog>
                        </Modal>
                    </ModalOverlay>
                )}

                {isAddColumnModalOpen && (
                    <ModalOverlay isOpen={isAddColumnModalOpen} onOpenChange={(isOpen) => !isOpen && setIsAddColumnModalOpen(false)}>
                        <Modal>
                            <Dialog className="w-full max-w-md mx-auto bg-primary rounded-xl shadow-lg p-6">
                                {({ close }) => (
                                    <div className="w-full space-y-4">
                                        <div className="flex items-center justify-between border-b border-secondary pb-4 -mx-6 px-6 mb-2">
                                            <h2 className="text-lg font-semibold text-primary">Add Column</h2>
                                            <Button
                                                color="tertiary"
                                                size="sm"
                                                iconLeading={X}
                                                onClick={close}
                                                className="p-1"
                                            />
                                        </div>

                                        <div className="space-y-4">
                                            <Input
                                                label="Column Name"
                                                value={newColumnName}
                                                onChange={(value) => setNewColumnName(value)}
                                                placeholder="Enter column name"
                                                isRequired
                                                autoFocus
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t border-secondary">
                                            <Button
                                                color="secondary"
                                                onClick={close}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                color="primary"
                                                onClick={() => {
                                                    handleSaveNewColumn();
                                                    close();
                                                }}
                                                isDisabled={!newColumnName.trim()}
                                                iconLeading={Check}
                                            >
                                                Add Column
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </Dialog>
                        </Modal>
                    </ModalOverlay>
                )}
            </div>
        </MainLayout>
    );
}


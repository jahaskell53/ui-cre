"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/base/buttons/button";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Avatar } from "@/components/base/avatar/avatar";
import { Input } from "@/components/base/input/input";
import { AddressInput } from "@/components/base/input/address-input";
import { TextArea } from "@/components/base/textarea/textarea";
import { Select } from "@/components/base/select/select";
import type { SelectItemType } from "@/components/base/select/select";
import { Modal, ModalOverlay, Dialog } from "@/components/application/modals/modal";
import { useUser } from "@/hooks/use-user";
import { UploadCloud02, Download01, Check, X, CheckCircle, Trash01, Edit01, LayoutGrid01, List, SearchLg, Plus, Minus, Map01, Loading03 } from "@untitledui/icons";
import { Kanban } from "react-kanban-kit";
import { ContactMap, type ContactLocation } from "@/components/application/map/contact-map";

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
    owned_properties: string[] | null;
    category: string | null;
    created_at: string;
    updated_at: string;
}

const createEmptyContactForm = () => ({
    first_name: "",
    last_name: "",
    email_address: "",
    company: "",
    position: "",
    phone_number: "",
    notes: "",
    home_address: "",
    owned_properties: [] as string[],
    category: "",
});

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
    const [editFormData, setEditFormData] = useState(createEmptyContactForm());
    const [saving, setSaving] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"list" | "kanban" | "map">("list");
    const [kanbanColumns, setKanbanColumns] = useState<string[]>([
        "Active Prospecting",
        "Offering Memorandum",
        "Underwriting",
        "Due Diligence",
        "Closed/Archive",
    ]);
    const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState("");
    const [isEditColumnModalOpen, setIsEditColumnModalOpen] = useState(false);
    const [editColumnIndex, setEditColumnIndex] = useState<number | null>(null);
    const [editColumnName, setEditColumnName] = useState("");
    const [columnSaving, setColumnSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [geocoding, setGeocoding] = useState(false);
    const addressCoordinatesRef = useRef<Record<string, [number, number] | null>>({});
    const [addressCoordinatesVersion, setAddressCoordinatesVersion] = useState(0);

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

    const closeContactModal = () => {
        setIsContactModalOpen(false);
        setEditingContact(null);
        setEditFormData(createEmptyContactForm());
        setError(null);
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
            owned_properties: contact.owned_properties || [],
            category: contact.category || "",
        });
        setError(null);
        setSuccess(null);
        setIsContactModalOpen(true);
    };

    const handleCreateContact = () => {
        setEditingContact(null);
        setEditFormData(createEmptyContactForm());
        setError(null);
        setSuccess(null);
        setIsContactModalOpen(true);
    };

    const handleSaveContact = async () => {
        if (!editFormData.first_name.trim() || !editFormData.last_name.trim() || !editFormData.email_address.trim()) {
            setError("First name, last name, and email address are required");
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            if (editingContact) {
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
                        owned_properties: editFormData.owned_properties.filter(p => p.trim()).length > 0 
                            ? editFormData.owned_properties.filter(p => p.trim())
                            : null,
                        category: editFormData.category.trim() || null,
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
                              owned_properties: editFormData.owned_properties.filter(p => p.trim()).length > 0 
                                  ? editFormData.owned_properties.filter(p => p.trim())
                                  : null,
                              category: editFormData.category.trim() || null,
                          }
                        : c
                ));

                setSuccess("Contact updated successfully");
            } else {
                const response = await fetch("/api/contacts", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        contacts: [
                            {
                                firstName: editFormData.first_name.trim(),
                                lastName: editFormData.last_name.trim(),
                                emailAddress: editFormData.email_address.trim(),
                                company: editFormData.company.trim(),
                                position: editFormData.position.trim(),
                                phoneNumber: editFormData.phone_number.trim(),
                                notes: editFormData.notes.trim(),
                                homeAddress: editFormData.home_address.trim(),
                                ownedProperties: editFormData.owned_properties.filter(p => p.trim()).length > 0 
                                    ? editFormData.owned_properties.filter(p => p.trim())
                                    : [],
                                category: editFormData.category.trim() || null,
                            },
                        ],
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "Failed to create contact");
                }

                await loadContacts();
                setSuccess("Contact created successfully");
            }

            closeContactModal();
        } catch (error) {
            console.error("Error saving contact:", error);
            setError(error instanceof Error ? error.message : "Failed to save contact");
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
                contact.category,
                ...(contact.owned_properties || []),
            ].filter(field => field !== null && field !== undefined);

            return searchableFields.some(field => 
                field.toLowerCase().includes(searchTerm)
            );
        });
    };

    useEffect(() => {
        if (viewMode !== "map") return;

        let cancelled = false;

        const run = async () => {
            const filteredContacts = filterContacts(contacts, searchQuery);

            const addresses = filteredContacts
                .flatMap((c) => {
                    const owned = (c.owned_properties || []).filter((p) => p && p.trim());
                    return [c.home_address || "", ...owned];
                })
                .map((a) => a.trim())
                .filter(Boolean);

            const uniqueAddresses = Array.from(new Set(addresses));

            // Nothing to geocode
            if (uniqueAddresses.length === 0) return;

            setGeocoding(true);
            try {
                for (const address of uniqueAddresses) {
                    if (cancelled) return;
                    if (addressCoordinatesRef.current[address] !== undefined) continue;

                    try {
                        const response = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
                        if (!response.ok) {
                            addressCoordinatesRef.current[address] = null;
                            setAddressCoordinatesVersion((v) => v + 1);
                            continue;
                        }

                        const data = await response.json();
                        const coordsUnknown: unknown = data?.suggestions?.[0]?.coordinates;
                        if (
                            Array.isArray(coordsUnknown) &&
                            coordsUnknown.length === 2 &&
                            typeof coordsUnknown[0] === "number" &&
                            typeof coordsUnknown[1] === "number"
                        ) {
                            addressCoordinatesRef.current[address] = [coordsUnknown[0], coordsUnknown[1]];
                        } else {
                            addressCoordinatesRef.current[address] = null;
                        }
                        setAddressCoordinatesVersion((v) => v + 1);
                    } catch (e) {
                        addressCoordinatesRef.current[address] = null;
                        setAddressCoordinatesVersion((v) => v + 1);
                    }
                }
            } finally {
                if (!cancelled) setGeocoding(false);
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [viewMode, contacts, searchQuery]);

    const handleDownloadCSV = () => {
        const filteredContacts = filterContacts(contacts, searchQuery);
        if (filteredContacts.length === 0) return;

        const headers = [
            "First Name",
            "Last Name",
            "Email Address",
            "Company",
            "Position",
            "Phone Number",
            "Status",
            "Category",
            "Home Address",
            "Owned Properties",
            "Notes",
        ];

        const escapeCSV = (value: string | null | undefined): string => {
            if (value === null || value === undefined) return "";
            const str = String(value);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const rows = filteredContacts.map(contact => [
            escapeCSV(contact.first_name),
            escapeCSV(contact.last_name),
            escapeCSV(contact.email_address),
            escapeCSV(contact.company),
            escapeCSV(contact.position),
            escapeCSV(contact.phone_number),
            escapeCSV(contact.status),
            escapeCSV(contact.category),
            escapeCSV(contact.home_address),
            escapeCSV(contact.owned_properties?.join("; ")),
            escapeCSV(contact.notes),
        ]);

        const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
                                <a 
                                    href={`mailto:${contact.email_address}`}
                                    className="text-xs text-secondary mt-1 underline decoration-transparent hover:decoration-current hover:text-primary transition-colors"
                                >
                                    {contact.email_address}
                                </a>
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
                                {contact.category && (
                                    <div className="text-xs text-tertiary mt-1">
                                        {contact.category}
                                    </div>
                                )}
                                {contact.owned_properties && contact.owned_properties.length > 0 && (
                                    <div className="text-xs text-tertiary mt-1">
                                        {contact.owned_properties.length} owned propert{contact.owned_properties.length === 1 ? 'y' : 'ies'}
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

    const handleEditColumn = (index: number) => {
        if (index < 0 || index >= kanbanColumns.length) return;
        setEditColumnIndex(index);
        setEditColumnName(kanbanColumns[index]);
        setIsEditColumnModalOpen(true);
    };

    const handleSaveEditedColumn = async () => {
        if (editColumnIndex === null) return;
        const trimmedName = editColumnName.trim();
        if (!trimmedName) {
            setError("Column name is required");
            return;
        }

        const oldName = kanbanColumns[editColumnIndex];
        if (!oldName) return;

        // No change needed
        if (oldName === trimmedName) {
            setIsEditColumnModalOpen(false);
            return;
        }

        setColumnSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const contactsToUpdate = contacts.filter(
                (contact) => (contact.status || "Active Prospecting") === oldName
            );

            if (contactsToUpdate.length > 0) {
                const results = await Promise.all(
                    contactsToUpdate.map((contact) =>
                        fetch(`/api/contacts?id=${contact.id}`, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ status: trimmedName }),
                        })
                    )
                );

                if (results.some((response) => !response.ok)) {
                    throw new Error("Failed to update some contacts");
                }
            }

            setContacts((prevContacts) =>
                prevContacts.map((contact) =>
                    (contact.status || "Active Prospecting") === oldName
                        ? { ...contact, status: trimmedName }
                        : contact
                )
            );

            setKanbanColumns((prevColumns) =>
                prevColumns.map((col, idx) => (idx === editColumnIndex ? trimmedName : col))
            );

            setIsEditColumnModalOpen(false);
            setEditColumnIndex(null);
            setEditColumnName("");
            setSuccess("Column title updated");
        } catch (error) {
            console.error("Error updating column title:", error);
            setError(error instanceof Error ? error.message : "Failed to update column title");
        } finally {
            setColumnSaving(false);
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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                            <h2 className="text-lg font-semibold text-primary">Your Contacts</h2>
                            <div className="flex flex-wrap gap-3">
                                <Input
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    icon={SearchLg}
                                    size="sm"
                                    className="w-full sm:w-64"
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
                                    <Button
                                        color={viewMode === "map" ? "primary" : "secondary"}
                                        size="sm"
                                        iconLeading={Map01}
                                        onClick={() => setViewMode("map")}
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
                                    color="primary"
                                    size="sm"
                                    onClick={handleCreateContact}
                                    iconLeading={Plus}
                                    className="!px-3"
                                >
                                    New
                                </Button>
                                <Button
                                    color="secondary"
                                    size="sm"
                                    onClick={handleDownloadCSV}
                                    iconLeading={Download01}
                                    isDisabled={filterContacts(contacts, searchQuery).length === 0}
                                >
                                    Download
                                </Button>
                                <Button
                                    color="secondary"
                                    size="sm"
                                    onClick={() => {
                                        fileInputRef.current?.click();
                                    }}
                                    iconLeading={UploadCloud02}
                                >
                                    Upload
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files.length > 0) {
                                            handleFileUpload(e.target.files);
                                        }
                                    }}
                                />
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
                                                            <a 
                                                                href={`mailto:${contact.email_address}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="text-sm text-secondary mt-1 underline decoration-transparent hover:decoration-current hover:text-primary transition-colors"
                                                            >
                                                                {contact.email_address}
                                                            </a>
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
                                                            {contact.category && (
                                                                <div className="text-xs text-tertiary mt-1">
                                                                    {contact.category}
                                                                </div>
                                                            )}
                                                            {contact.owned_properties && contact.owned_properties.length > 0 && (
                                                                <div className="text-xs text-tertiary mt-1">
                                                                    {contact.owned_properties.length} owned propert{contact.owned_properties.length === 1 ? 'y' : 'ies'}
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
                        ) : viewMode === "kanban" ? (
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
                                                    <ButtonUtility
                                                        color="tertiary"
                                                        size="sm"
                                                        icon={Edit01}
                                                        onClick={() => {
                                                            const columnIndex = typeof column.id === "string"
                                                                ? parseInt(column.id.replace("col-", ""), 10)
                                                                : -1;
                                                            if (!Number.isNaN(columnIndex) && columnIndex >= 0) {
                                                                handleEditColumn(columnIndex);
                                                            }
                                                        }}
                                                        isDisabled={columnSaving}
                                                    />
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
                                                padding: "8px",
                                            })}
                                            cardsGap={8}
                                            rootStyle={{ width: "100%" }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-primary border border-secondary rounded-2xl overflow-hidden">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-tertiary">Loading contacts...</div>
                                    </div>
                                ) : (() => {
                                    const filteredContacts = filterContacts(contacts, searchQuery);
                                    // Ensure re-render as geocoding cache fills
                                    void addressCoordinatesVersion;

                                    const addressItems: Array<{
                                        id: string;
                                        name: string;
                                        email: string;
                                        addressLabel: "Home" | "Owned";
                                        address: string;
                                    }> = [];

                                    filteredContacts.forEach((c) => {
                                        if (c.home_address && c.home_address.trim()) {
                                            addressItems.push({
                                                id: `${c.id}-home`,
                                                name: `${c.first_name} ${c.last_name}`,
                                                email: c.email_address,
                                                addressLabel: "Home",
                                                address: c.home_address.trim(),
                                            });
                                        }

                                        (c.owned_properties || []).forEach((p, idx) => {
                                            if (!p || !p.trim()) return;
                                            addressItems.push({
                                                id: `${c.id}-owned-${idx}`,
                                                name: `${c.first_name} ${c.last_name}`,
                                                email: c.email_address,
                                                addressLabel: "Owned",
                                                address: p.trim(),
                                            });
                                        });
                                    });

                                    const locations: ContactLocation[] = addressItems
                                        .map((item) => {
                                            const coords = addressCoordinatesRef.current[item.address];
                                            if (!coords) return null;
                                            return {
                                                id: item.id,
                                                name: item.name,
                                                email: item.email,
                                                addressLabel: item.addressLabel,
                                                address: item.address,
                                                coordinates: coords,
                                            };
                                        })
                                        .filter((x): x is ContactLocation => Boolean(x));

                                    return (
                                        <div className="flex flex-col-reverse lg:flex-row border border-secondary rounded-2xl overflow-hidden bg-primary shadow-sm relative h-[calc(100vh-20rem)] min-h-[520px]">
                                            <div className="w-full lg:w-80 h-1/2 lg:h-auto border-t lg:border-t-0 lg:border-r border-secondary flex flex-col bg-primary z-10">
                                                <div className="p-4 border-b border-secondary flex justify-between items-center bg-primary">
                                                    <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
                                                        Contact Addresses
                                                    </span>
                                                    {geocoding && (
                                                        <div className="flex items-center gap-2 text-tertiary text-xs">
                                                            <Loading03 className="w-4 h-4 animate-spin" />
                                                            <span>Geocoding…</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 overflow-auto divide-y divide-secondary">
                                                    {addressItems.length === 0 ? (
                                                        <div className="p-8 text-center text-tertiary">
                                                            <p>No home/owned addresses found for the current filter.</p>
                                                        </div>
                                                    ) : (
                                                        addressItems.map((item) => {
                                                            const hasCoords = Boolean(addressCoordinatesRef.current[item.address]);
                                                            const isSelected = selectedLocationId === item.id;
                                                            return (
                                                                <button
                                                                    key={item.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (hasCoords) setSelectedLocationId(item.id);
                                                                    }}
                                                                    className={[
                                                                        "w-full text-left p-4 transition-colors",
                                                                        hasCoords ? "hover:bg-secondary/5 cursor-pointer" : "cursor-not-allowed opacity-60",
                                                                        isSelected ? "bg-secondary/10" : "",
                                                                    ].join(" ")}
                                                                >
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <div className="font-semibold text-primary truncate">{item.name}</div>
                                                                        <span className="text-xs font-semibold text-tertiary bg-secondary-subtle px-2 py-0.5 rounded-md border border-secondary">
                                                                            {item.addressLabel}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-secondary mt-1 truncate">{item.email}</div>
                                                                    <div className="text-sm text-tertiary mt-2 line-clamp-2">{item.address}</div>
                                                                    {!hasCoords && (
                                                                        <div className="text-xs text-tertiary mt-2">No coordinates found</div>
                                                                    )}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-1 relative">
                                                {locations.length === 0 ? (
                                                    <div className="absolute inset-0 flex items-center justify-center text-tertiary">
                                                        <div className="text-center max-w-md px-6">
                                                            <div className="font-medium text-primary mb-2">No mappable addresses</div>
                                                            <div className="text-sm">
                                                                Add a contact home address and/or owned property address (or refine your search) to show markers.
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <ContactMap
                                                        locations={locations}
                                                        selectedId={selectedLocationId}
                                                        className="absolute inset-0"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}

                {isContactModalOpen && (
                    <ModalOverlay isOpen={isContactModalOpen} onOpenChange={(isOpen) => !isOpen && closeContactModal()}>
                        <Modal>
                            <Dialog className="w-full max-w-2xl mx-auto bg-primary rounded-xl shadow-lg p-6">
                                {({ close }) => (
                                    <div className="w-full space-y-4">
                                        <div className="flex items-center justify-between border-b border-secondary pb-4 -mx-6 px-6 mb-2">
                                            <h2 className="text-lg font-semibold text-primary">
                                                {editingContact ? "Edit Contact" : "Add Contact"}
                                            </h2>
                                            <Button
                                                color="tertiary"
                                                size="sm"
                                                iconLeading={X}
                                                onClick={() => {
                                                    close();
                                                    closeContactModal();
                                                }}
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
                                            <Select
                                                label="Category"
                                                selectedKey={editFormData.category || null}
                                                onSelectionChange={(key) => setEditFormData({ ...editFormData, category: key as string || "" })}
                                                items={[
                                                    { id: "Realtor", label: "Realtor" },
                                                    { id: "Property Owner", label: "Property Owner" },
                                                    { id: "Lender", label: "Lender" },
                                                ]}
                                            >
                                                {(item) => <Select.Item id={item.id} label={item.label} />}
                                            </Select>
                                            <AddressInput
                                                label="Home Address"
                                                value={editFormData.home_address}
                                                onChange={(value) => setEditFormData({ ...editFormData, home_address: value })}
                                                placeholder="Search for an address..."
                                                className="col-span-2"
                                            />
                                            <div className="col-span-2 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-medium text-primary">Owned Properties</label>
                                                    <Button
                                                        color="secondary"
                                                        size="sm"
                                                        iconLeading={Plus}
                                                        onClick={() => {
                                                            setEditFormData({
                                                                ...editFormData,
                                                                owned_properties: [...editFormData.owned_properties, ""],
                                                            });
                                                        }}
                                                    >
                                                        Add Property
                                                    </Button>
                                                </div>
                                                {editFormData.owned_properties.map((property, index) => (
                                                    <div key={index} className="flex gap-2">
                                                        <AddressInput
                                                            value={property}
                                                            onChange={(value) => {
                                                                const newProperties = [...editFormData.owned_properties];
                                                                newProperties[index] = value;
                                                                setEditFormData({ ...editFormData, owned_properties: newProperties });
                                                            }}
                                                            placeholder="Search for an address..."
                                                            className="flex-1"
                                                        />
                                                        <Button
                                                            color="tertiary"
                                                            size="sm"
                                                            iconLeading={Minus}
                                                            onClick={() => {
                                                                const newProperties = editFormData.owned_properties.filter((_, i) => i !== index);
                                                                setEditFormData({ ...editFormData, owned_properties: newProperties });
                                                            }}
                                                            className="!px-3"
                                                        />
                                                    </div>
                                                ))}
                                                {editFormData.owned_properties.length === 0 && (
                                                    <p className="text-sm text-tertiary">No owned properties added yet.</p>
                                                )}
                                            </div>
                                            <TextArea
                                                label="Notes"
                                                value={editFormData.notes}
                                                onChange={(value: string) => setEditFormData({ ...editFormData, notes: value })}
                                                placeholder="Add notes about this contact..."
                                                rows={6}
                                                className="col-span-2"
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t border-secondary">
                                            <Button
                                                color="secondary"
                                                onClick={() => {
                                                    close();
                                                    closeContactModal();
                                                }}
                                                isDisabled={saving}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                color="primary"
                                                onClick={handleSaveContact}
                                                isDisabled={saving}
                                                iconLeading={saving ? undefined : Check}
                                            >
                                                {saving ? "Saving..." : editingContact ? "Save Changes" : "Create Contact"}
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

                {isEditColumnModalOpen && (
                    <ModalOverlay
                        isOpen={isEditColumnModalOpen}
                        onOpenChange={(isOpen) => {
                            if (!isOpen) {
                                setIsEditColumnModalOpen(false);
                                setEditColumnIndex(null);
                                setEditColumnName("");
                            }
                        }}
                    >
                        <Modal>
                            <Dialog className="w-full max-w-md mx-auto bg-primary rounded-xl shadow-lg p-6">
                                {({ close }) => (
                                    <div className="w-full space-y-4">
                                        <div className="flex items-center justify-between border-b border-secondary pb-4 -mx-6 px-6 mb-2">
                                            <h2 className="text-lg font-semibold text-primary">Edit Column</h2>
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
                                                value={editColumnName}
                                                onChange={(value) => setEditColumnName(value)}
                                                placeholder="Enter column name"
                                                isRequired
                                                autoFocus
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4 border-t border-secondary">
                                            <Button
                                                color="secondary"
                                                onClick={close}
                                                isDisabled={columnSaving}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                color="primary"
                                                onClick={handleSaveEditedColumn}
                                                isDisabled={!editColumnName.trim() || columnSaving}
                                                iconLeading={columnSaving ? undefined : Check}
                                            >
                                                {columnSaving ? "Saving..." : "Save Changes"}
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


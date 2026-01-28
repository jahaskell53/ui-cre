"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Mail, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { generateAuroraGradient, getInitials } from "@/app/(app)/network/utils";
import { cn } from "@/lib/utils";

// Mail icon component matching the network style
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
      <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
    </svg>
  );
}

interface Person {
  id: string;
  name: string;
  email: string | null;
}

interface InviteGuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onSuccess?: () => void;
}

type Tab = "suggestions" | "enter-emails";

export function InviteGuestsModal({
  isOpen,
  onClose,
  eventId,
  onSuccess,
}: InviteGuestsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("suggestions");
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [manualEmails, setManualEmails] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [invitationMessage, setInvitationMessage] = useState("We'd love to see you there!");

  // Fetch all people when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPeople();
    } else {
      // Reset state when modal closes
      setSelectedPeopleIds(new Set());
      setManualEmails([]);
      setEmailInput("");
      setSearchQuery("");
      setActiveTab("suggestions");
      setInvitationMessage("We'd love to see you there!");
    }
  }, [isOpen]);

  const fetchPeople = async () => {
    setIsLoadingPeople(true);
    try {
      const response = await fetch("/api/people");
      if (response.ok) {
        const data = await response.json();
        // Filter to only people with emails
        const peopleWithEmails = data.filter((p: Person) => p.email);
        setPeople(peopleWithEmails);
      }
    } catch (error) {
      console.error("Error fetching people:", error);
    } finally {
      setIsLoadingPeople(false);
    }
  };

  // Filter people based on search query
  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const query = searchQuery.toLowerCase();
    return people.filter(
      (person) =>
        person.name.toLowerCase().includes(query) ||
        person.email?.toLowerCase().includes(query)
    );
  }, [people, searchQuery]);

  const togglePersonSelection = (personId: string, checked?: boolean) => {
    setSelectedPeopleIds((prev) => {
      const next = new Set(prev);
      const shouldAdd = checked !== undefined ? checked : !next.has(personId);
      if (shouldAdd) {
        next.add(personId);
      } else {
        next.delete(personId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    const allFilteredIds = new Set(filteredPeople.map((p) => p.id));
    setSelectedPeopleIds((prev) => new Set([...prev, ...allFilteredIds]));
  };

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredPeople.map((p) => p.id));
    setSelectedPeopleIds((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const allFilteredSelected = filteredPeople.length > 0 && filteredPeople.every((p) => selectedPeopleIds.has(p.id));
  const someFilteredSelected = filteredPeople.some((p) => selectedPeopleIds.has(p.id));

  const handleAddEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;

    // Simple email validation
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      if (!manualEmails.includes(trimmed)) {
        setManualEmails([...manualEmails, trimmed]);
      }
      setEmailInput("");
    }
  };

  const removeManualEmail = (email: string) => {
    setManualEmails(manualEmails.filter((e) => e !== email));
  };

  const handleSendInvites = async () => {
    // Collect all emails: selected people + manual emails
    const selectedPeopleEmails = people
      .filter((p) => selectedPeopleIds.has(p.id))
      .map((p) => p.email)
      .filter((email): email is string => Boolean(email));

    const allEmails = [...new Set([...selectedPeopleEmails, ...manualEmails])];

    if (allEmails.length === 0) {
      alert("Please select at least one contact or enter an email address.");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/events/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          emails: allEmails,
          message: invitationMessage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send invitations");
      }

      const result = await response.json();
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Error sending invites:", error);
      alert(error.message || "Failed to send invitations. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const totalSelected = selectedPeopleIds.size + manualEmails.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl w-[90vw] h-[600px] p-0 gap-0 overflow-hidden flex flex-col" showCloseButton={false}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Invite Guests
          </DialogTitle>
          <div className="flex items-center gap-4">
            {totalSelected > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {totalSelected} selected
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Sidebar */}
          <div className="w-56 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0 flex flex-col">
            {/* Tabs */}
            <div className="p-3 space-y-1">
              <button
                onClick={() => setActiveTab("suggestions")}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === "suggestions"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50"
                )}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                Network
              </button>
              <button
                onClick={() => setActiveTab("enter-emails")}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  activeTab === "enter-emails"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50"
                )}
              >
                <Mail className="w-4 h-4" />
                Enter Emails
              </button>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white dark:bg-gray-950">
            {activeTab === "suggestions" ? (
              <>
                {/* Search */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search contacts..."
                      className="pl-10 h-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                    />
                  </div>
                </div>

                {/* Select All Header */}
                {!isLoadingPeople && filteredPeople.length > 0 && (
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            selectAllFiltered();
                          } else {
                            deselectAllFiltered();
                          }
                        }}
                        className="data-[state=checked]:bg-black data-[state=checked]:border-black"
                      />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {filteredPeople.length} {filteredPeople.length === 1 ? "Contact" : "Contacts"}
                      </span>
                    </div>
                    {someFilteredSelected && (
                      <button
                        onClick={deselectAllFiltered}
                        className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {/* People List */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {isLoadingPeople ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                  ) : filteredPeople.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                        <Mail className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {searchQuery
                          ? "No contacts found"
                          : "No contacts with email addresses"}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredPeople.map((person) => {
                        const isSelected = selectedPeopleIds.has(person.id);
                        return (
                          <div
                            key={person.id}
                            onClick={() => togglePersonSelection(person.id)}
                            className={cn(
                              "flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer group transition-colors",
                              isSelected && "bg-gray-50 dark:bg-gray-800"
                            )}
                          >
                            <Checkbox
                              className="mr-3 data-[state=checked]:bg-black data-[state=checked]:border-black"
                              checked={isSelected}
                              onCheckedChange={(checked) => togglePersonSelection(person.id, checked as boolean)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {person.name}
                                </span>
                                {person.email && (
                                  <MailIcon className="w-3 h-3 text-teal-500 shrink-0" />
                                )}
                              </div>
                              {person.email && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {person.email}
                                </div>
                              )}
                            </div>
                            <Avatar className="h-7 w-7 ml-2 shrink-0">
                              <AvatarFallback
                                className="text-white text-xs font-medium"
                                style={{ background: generateAuroraGradient(person.name) }}
                              >
                                {getInitials(person.name)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </ScrollArea>
                </div>
              </>
            ) : (
              <>
                {/* Email Input Section - matches search bar area */}
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddEmail();
                          }
                        }}
                        placeholder="Enter email address..."
                        className="pl-10 h-9 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800"
                      />
                    </div>
                    <Button
                      onClick={handleAddEmail}
                      variant="outline"
                      className="h-9 px-4"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Email Count Header */}
                {manualEmails.length > 0 && (
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-between shrink-0">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {manualEmails.length} {manualEmails.length === 1 ? "Email" : "Emails"}
                    </span>
                    <button
                      onClick={() => setManualEmails([])}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* Email List */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {manualEmails.length > 0 ? (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {manualEmails.map((email) => (
                        <div
                          key={email}
                          className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                        >
                          <div className="w-4 mr-3" /> {/* Spacer for alignment */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                {email}
                              </span>
                              <MailIcon className="w-3 h-3 text-teal-500 shrink-0" />
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Manual entry
                            </div>
                          </div>
                          <button
                            onClick={() => removeManualEmail(email)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4 text-gray-500" />
                          </button>
                          <Avatar className="h-7 w-7 ml-2 shrink-0 bg-gray-200 dark:bg-gray-700">
                            <AvatarFallback className="text-gray-600 dark:text-gray-300 text-xs font-medium">
                              {email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                        <Mail className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        No emails added yet
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Enter email addresses above to add them
                      </p>
                    </div>
                  )}
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Message Template Section */}
        {totalSelected > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Invitation Message
            </label>
            <Textarea
              value={invitationMessage}
              onChange={(e) => setInvitationMessage(e.target.value)}
              placeholder="Enter your invitation message..."
              className="min-h-[100px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 resize-none"
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shrink-0">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {totalSelected === 0 ? (
              "No guests selected"
            ) : (
              <span className="text-gray-900 dark:text-gray-100">
                {totalSelected} selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendInvites}
              disabled={totalSelected === 0 || isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitations
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

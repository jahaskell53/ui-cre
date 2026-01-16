"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Sample data matching the screenshot
const people = [
  { id: 1, name: "alon@greenpointcollection.com Collection", starred: true, hasEmail: true, hasSignal: true, color: "bg-amber-400" },
  { id: 2, name: "Josh @ Realie", starred: true, hasEmail: true, hasSignal: false, color: "bg-orange-400" },
  { id: 3, name: "Alon Carmel", starred: true, hasEmail: true, hasSignal: true, color: "bg-emerald-400" },
  { id: 4, name: "Drew Koch", starred: true, hasEmail: true, hasSignal: true, color: "bg-amber-500" },
  { id: 5, name: "Soren Craig", starred: true, hasEmail: true, hasSignal: true, color: "bg-emerald-400" },
  { id: 6, name: "enock.kenani.nyakundi@gmail.com", starred: true, hasEmail: true, hasSignal: true, color: "bg-orange-300" },
  { id: 7, name: "David Laidlaw", starred: true, hasEmail: true, hasSignal: true, color: "bg-slate-400" },
  { id: 8, name: "Jakobi Jakobi", starred: true, hasEmail: true, hasSignal: true, color: "bg-amber-400" },
  { id: 9, name: "He, Melvin", starred: true, hasEmail: true, hasSignal: false, color: "bg-amber-300" },
  { id: 10, name: "vihaskell@gmail.com Haskell", starred: true, hasEmail: true, hasSignal: true, color: "bg-violet-400" },
  { id: 11, name: "Russell Katz", starred: true, hasEmail: false, hasSignal: true, color: "bg-rose-400" },
  { id: 12, name: "Otis Katz", starred: true, hasEmail: true, hasSignal: true, color: "bg-orange-400" },
  { id: 13, name: "Omkar Podey", starred: true, hasEmail: true, hasSignal: false, color: "bg-orange-400" },
  { id: 14, name: "Tianyou Xu", starred: true, hasEmail: true, hasSignal: true, color: "bg-amber-400" },
  { id: 15, name: "christian_armstrong@brown.edu", starred: true, hasEmail: true, hasSignal: false, color: "bg-cyan-400" },
  { id: 16, name: "Al Smail, Jad Alkarim", starred: true, hasEmail: true, hasSignal: true, color: "bg-amber-400" },
  { id: 17, name: "Gabriella Vulakh", starred: true, hasEmail: true, hasSignal: true, color: "bg-emerald-400" },
  { id: 18, name: "ashura buckley", starred: true, hasEmail: true, hasSignal: true, color: "bg-amber-400" },
];

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 14L10 10M11.3333 6.66667C11.3333 9.244 9.244 11.3333 6.66667 11.3333C4.08934 11.3333 2 9.244 2 6.66667C2 4.08934 4.08934 2 6.66667 2C9.244 2 11.3333 4.08934 11.3333 6.66667Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 13.5H12M8.18 1.764L2.43 6.204C2.01 6.522 1.8 6.681 1.647 6.878C1.51 7.053 1.408 7.252 1.347 7.464C1.278 7.703 1.278 7.961 1.278 8.478V13.02C1.278 13.948 1.278 14.412 1.459 14.77C1.618 15.084 1.872 15.338 2.186 15.497C2.544 15.678 3.008 15.678 3.936 15.678H14.064C14.992 15.678 15.456 15.678 15.814 15.497C16.128 15.338 16.382 15.084 16.541 14.77C16.722 14.412 16.722 13.948 16.722 13.02V8.478C16.722 7.961 16.722 7.703 16.653 7.464C16.592 7.252 16.49 7.053 16.353 6.878C16.2 6.681 15.99 6.522 15.57 6.204L9.82 1.764C9.496 1.52 9.334 1.398 9.156 1.352C8.999 1.312 8.834 1.312 8.677 1.352C8.499 1.398 8.337 1.52 8.013 1.764L8.18 1.764Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 15.75C15 14.5074 15 13.8861 14.8463 13.3836C14.4921 12.2271 13.5229 11.3079 12.3036 10.9687C11.7748 10.8225 11.1178 10.8225 9.80385 10.8225H8.19615C6.88225 10.8225 6.2253 10.8225 5.6964 10.9687C4.4771 11.3079 3.5079 12.2271 3.1537 13.3836C3 13.8861 3 14.5074 3 15.75M12.375 5.625C12.375 7.48896 10.864 9 9 9C7.13604 9 5.625 7.48896 5.625 5.625C5.625 3.76104 7.13604 2.25 9 2.25C10.864 2.25 12.375 3.76104 12.375 5.625Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill={filled ? "currentColor" : "none"} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 1L7.545 4.13L11 4.635L8.5 7.07L9.09 10.51L6 8.885L2.91 10.51L3.5 7.07L1 4.635L4.455 4.13L6 1Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 3.5L5.2 6.3C5.68 6.62 6.32 6.62 6.8 6.3L11 3.5M2.2 10H9.8C10.46 10 11 9.46 11 8.8V3.2C11 2.54 10.46 2 9.8 2H2.2C1.54 2 1 2.54 1 3.2V8.8C1 9.46 1.54 10 2.2 10Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 6C2.5 6 3.5 4.5 6 4.5C8.5 4.5 9.5 6 9.5 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 4C1 4 2.5 2 6 2C9.5 2 11 4 11 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 8C4 8 4.75 7 6 7C7.25 7 8 8 8 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="9.5" r="0.5" fill="currentColor"/>
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 3.33333V12.6667M3.33333 8H12.6667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SortIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.3334 4L6.00002 11.3333L2.66669 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14.55 11.25C14.4302 11.5226 14.3949 11.8247 14.4485 12.1175C14.5022 12.4103 14.6424 12.6802 14.85 12.8925L14.8925 12.935C15.0588 13.1012 15.1904 13.2989 15.2797 13.5166C15.3691 13.7343 15.4144 13.9676 15.4131 14.2031C15.4118 14.4385 15.3639 14.6714 15.2722 14.8881C15.1804 15.1047 15.0466 15.301 14.8785 15.465C14.7104 15.629 14.5115 15.7577 14.2935 15.8438C14.0755 15.93 13.8426 15.9718 13.6071 15.9671C13.3717 15.9624 13.1407 15.9112 12.9265 15.8163C12.7123 15.7214 12.5194 15.5847 12.3575 15.415L12.315 15.3725C12.1027 15.1649 11.8328 15.0247 11.54 14.971C11.2472 14.9174 10.9451 14.9527 10.6725 15.0725C10.4056 15.1872 10.1773 15.3763 10.0152 15.6176C9.85303 15.8589 9.7637 16.1421 9.7575 16.4325V16.5625C9.7575 17.0421 9.56691 17.5021 9.22497 17.844C8.88302 18.186 8.42305 18.3766 7.94346 18.3766C7.46386 18.3766 7.00389 18.186 6.66195 17.844C6.32001 17.5021 6.12942 17.0421 6.12942 16.5625V16.4925C6.11761 16.1951 6.01976 15.9074 5.84771 15.6654C5.67567 15.4233 5.43709 15.2375 5.16 15.13C4.8874 15.0102 4.58534 14.9749 4.29252 15.0285C3.99971 15.0822 3.72981 15.2224 3.5175 15.43L3.475 15.4725C3.3081 15.6388 3.1104 15.7704 2.89268 15.8597C2.67496 15.9491 2.44166 15.9944 2.20621 15.9931C1.97076 15.9918 1.73793 15.9439 1.52131 15.8522C1.30469 15.7604 1.10843 15.6266 0.944393 15.4585C0.780361 15.2904 0.651651 15.0915 0.565478 14.8735C0.479305 14.6555 0.437514 14.4226 0.442196 14.1871C0.446879 13.9517 0.498121 13.7207 0.593045 13.5065C0.687969 13.2923 0.824689 13.0994 0.995 12.9375L1.0375 12.895C1.24514 12.6827 1.38535 12.4128 1.439 12.12C1.49265 11.8272 1.45727 11.5251 1.3375 11.2525C1.22278 10.9856 1.03373 10.7573 0.792413 10.5952C0.551094 10.433 0.267895 10.3437 -0.0225 10.3375H-0.15C-0.629597 10.3375 -1.08957 10.1469 -1.43151 9.80497C-1.77345 9.46302 -1.96404 9.00306 -1.96404 8.52346C-1.96404 8.04386 -1.77345 7.58389 -1.43151 7.24195C-1.08957 6.90001 -0.629597 6.70942 -0.15 6.70942H-0.08C0.217361 6.69761 0.505087 6.59976 0.747128 6.42772C0.989169 6.25567 1.17498 6.01709 1.2825 5.74C1.40227 5.4674 1.43765 5.16534 1.384 4.87252C1.33035 4.57971 1.19014 4.30981 0.9825 4.0975L0.94 4.055C0.773689 3.8881 0.642044 3.6904 0.552716 3.47268C0.463388 3.25496 0.418074 3.02166 0.419389 2.78621C0.420703 2.55076 0.468639 2.31793 0.560376 2.10131C0.652113 1.88469 0.785944 1.68843 0.954 1.52439C1.12206 1.36036 1.32099 1.23165 1.53899 1.14548C1.757 1.05931 1.99025 1.01751 2.2257 1.0222C2.46115 1.02688 2.69219 1.07812 2.90639 1.17305C3.12059 1.26797 3.31351 1.40469 3.4754 1.575L3.5179 1.6175C3.73021 1.82514 4.00012 1.96535 4.29293 2.019C4.58574 2.07265 4.88781 2.03727 5.16039 1.9175H5.16C5.42691 1.80278 5.65522 1.61373 5.81735 1.37241C5.97948 1.13109 6.0688 0.847895 6.075 0.5575V0.4375C6.075 -0.0420969 6.26559 -0.502068 6.60754 -0.844011C6.94948 -1.18595 7.40945 -1.37654 7.88905 -1.37654C8.36864 -1.37654 8.82862 -1.18595 9.17056 -0.844011C9.5125 -0.502068 9.70309 -0.0420969 9.70309 0.4375V0.5075C9.7093 0.797895 9.79862 1.08109 9.96075 1.32241C10.1229 1.56373 10.3512 1.75278 10.6181 1.8675C10.8907 1.98727 11.1928 2.02265 11.4856 1.969C11.7784 1.91535 12.0483 1.77514 12.2606 1.5675L12.3031 1.525C12.465 1.35869 12.6579 1.22697 12.8721 1.13805C13.0863 1.04912 13.3168 1.00488 13.5491 1.00813C13.7815 1.01138 14.0106 1.06204 14.2222 1.15695C14.4338 1.25186 14.6231 1.38899 14.7794 1.56C14.9357 1.73101 15.0559 1.93236 15.1324 2.15158C15.2089 2.37079 15.2402 2.60326 15.2242 2.83478C15.2082 3.0663 15.1454 3.29218 15.0393 3.49922C14.9333 3.70626 14.7862 3.89018 14.6063 4.04L14.5638 4.0825C14.3561 4.29481 14.2159 4.56472 14.1623 4.85753C14.1086 5.15034 14.144 5.45241 14.2638 5.72499V5.73C14.3785 5.99691 14.5675 6.22522 14.8089 6.38735C15.0502 6.54948 15.3334 6.6388 15.6238 6.645H15.7438C16.2234 6.645 16.6833 6.83559 17.0253 7.17754C17.3672 7.51948 17.5578 7.97945 17.5578 8.45905C17.5578 8.93864 17.3672 9.39862 17.0253 9.74056C16.6833 10.0825 16.2234 10.2731 15.7438 10.2731H15.6738C15.3834 10.2793 15.1002 10.3686 14.8589 10.5308C14.6175 10.6929 14.4285 10.9212 14.3138 11.1881L14.55 11.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1V3M4 1V3M1.5 5H10.5M2.5 2H9.5C10.0523 2 10.5 2.44772 10.5 3V10C10.5 10.5523 10.0523 11 9.5 11H2.5C1.94772 11 1.5 10.5523 1.5 10V3C1.5 2.44772 1.94772 2 2.5 2Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EmojiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="5" cy="6" r="0.75" fill="currentColor"/>
      <circle cx="9" cy="6" r="0.75" fill="currentColor"/>
      <path d="M4.5 8.5C5 9.5 6 10 7 10C8 10 9 9.5 9.5 8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

export default function PeoplePage() {
  const [selectedPerson, setSelectedPerson] = useState(people[0]);
  const [selectedTab, setSelectedTab] = useState("people");
  const [panelWidth, setPanelWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  const getInitials = (name: string) => {
    const parts = name.split(/[\s@]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0]?.slice(0, 2).toUpperCase() || "??";
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 200;
      const maxWidth = 600;
      setPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Left Sidebar */}
      <div className="w-[180px] border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">C</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">clay</span>
          <div className="ml-auto p-1 hover:bg-gray-100 rounded">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="2" y="2" width="4" height="4" rx="1" stroke="#9CA3AF" strokeWidth="1.5"/>
              <rect x="8" y="2" width="4" height="4" rx="1" stroke="#9CA3AF" strokeWidth="1.5"/>
              <rect x="2" y="8" width="4" height="4" rx="1" stroke="#9CA3AF" strokeWidth="1.5"/>
              <rect x="8" y="8" width="4" height="4" rx="1" stroke="#9CA3AF" strokeWidth="1.5"/>
            </svg>
          </div>
        </div>

        {/* My Workspace */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 cursor-pointer">
            <div className="w-4 h-4 bg-emerald-500 rounded" />
            <span className="text-sm text-gray-700">My Workspace</span>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search"
              className="pl-8 h-8 text-sm bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-2 space-y-0.5">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600">
            <HomeIcon className="w-4 h-4" />
            <span className="text-sm">Home</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-100 cursor-pointer text-gray-900">
            <PeopleIcon className="w-4 h-4" />
            <span className="text-sm font-medium">People</span>
          </div>
        </nav>

        {/* Groups */}
        <div className="px-3 py-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Groups</span>
            <PlusIcon className="w-3.5 h-3.5 text-gray-400 cursor-pointer hover:text-gray-600" />
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600">
            <StarIcon className="w-3.5 h-3.5 text-amber-400" filled />
            <span className="text-sm">Starred</span>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto border-t border-gray-200 p-3">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600">
            <PlusIcon className="w-4 h-4" />
            <span className="text-sm">Create new</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 cursor-pointer text-gray-600">
            <SettingsIcon className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header with Tabs */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="bg-transparent h-auto p-0 space-x-4">
                <TabsTrigger
                  value="people"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 border-b-2 border-transparent data-[state=active]:border-gray-900 rounded-none"
                >
                  People
                </TabsTrigger>
                <TabsTrigger
                  value="duplicates"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 border-b-2 border-transparent data-[state=active]:border-gray-900 rounded-none"
                >
                  Duplicates
                </TabsTrigger>
                <TabsTrigger
                  value="map"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 border-b-2 border-transparent data-[state=active]:border-gray-900 rounded-none"
                >
                  Map
                </TabsTrigger>
                <TabsTrigger
                  value="archive"
                  className="bg-transparent px-0 py-1 text-sm font-medium data-[state=active]:text-gray-900 data-[state=active]:shadow-none data-[state=inactive]:text-gray-500 border-b-2 border-transparent data-[state=active]:border-gray-900 rounded-none"
                >
                  Archive
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                <span>Recency</span>
                <SortIcon className="w-4 h-4" />
              </div>
              <CheckIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* People Count */}
        <div className="px-4 py-2 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">347 People</span>
        </div>

        {/* People List */}
        <ScrollArea className="flex-1">
          <div className="divide-y divide-gray-100">
            {people.map((person) => (
              <div
                key={person.id}
                onClick={() => setSelectedPerson(person)}
                className={cn(
                  "flex items-center px-4 py-2.5 hover:bg-gray-50 cursor-pointer group",
                  selectedPerson.id === person.id && "bg-gray-50"
                )}
              >
                <Checkbox className="mr-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-900 truncate">{person.name}</span>
                    <div className="flex items-center gap-1">
                      {person.starred && <StarIcon className="w-3 h-3 text-amber-400" filled />}
                      {person.hasEmail && <MailIcon className="w-3 h-3 text-teal-500" />}
                      {person.hasSignal && <SignalIcon className="w-3 h-3 text-orange-400" />}
                    </div>
                  </div>
                </div>
                <Avatar className={cn("h-7 w-7 ml-2", person.color)}>
                  <AvatarFallback className={cn("text-white text-xs font-medium", person.color)}>
                    {getInitials(person.name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Resizable Divider */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className="w-1 flex items-center justify-center cursor-col-resize flex-shrink-0 group"
      >
        <div className="w-px h-full bg-gray-200 group-hover:bg-gray-300 transition-colors" />
      </div>

      {/* Right Detail Panel */}
      <div className="flex flex-col bg-gray-50/50 flex-shrink-0" style={{ width: `${panelWidth}px` }}>
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Profile Header */}
            <div className="flex flex-col items-center mb-6">
              <Avatar className={cn("h-20 w-20 mb-3", selectedPerson.color)}>
                <AvatarFallback className={cn("text-white text-2xl font-medium", selectedPerson.color)}>
                  {getInitials(selectedPerson.name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-sm font-medium text-gray-900 text-center truncate max-w-full px-2">
                {selectedPerson.name}
              </h2>
              <Badge variant="secondary" className="mt-1.5 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5">
                AUTO
              </Badge>
            </div>

            {/* Network Strength */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Network Strength</h3>
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5">
                HIGH
              </Badge>
            </div>

            <Separator className="my-4" />

            {/* Timeline */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CalendarIcon className="w-2.5 h-2.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-700">You will meet with {selectedPerson.name.split(' ')[0]}...</p>
                    <p className="text-xs text-gray-400 mt-0.5">January 19</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-orange-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CalendarIcon className="w-2.5 h-2.5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-700">{selectedPerson.name.split(' ')[0]} imported via...</p>
                    <p className="text-xs text-gray-400 mt-0.5">1H</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CalendarIcon className="w-2.5 h-2.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-700">You met with {selectedPerson.name.split(' ')[0]}...</p>
                    <p className="text-xs text-gray-400 mt-0.5">January 12</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MailIcon className="w-2.5 h-2.5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-700">You emailed {selectedPerson.name.split(' ')[0]}...</p>
                    <p className="text-xs text-gray-400 mt-0.5">January 3</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Related People */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Related People</h3>
              <button className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700">
                <EmojiIcon className="w-4 h-4" />
                <span>Add related people</span>
              </button>
            </div>

            <Separator className="my-4" />

            {/* Properties */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Properties</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    <span className="text-xs text-gray-500">Last Updated</span>
                  </div>
                  <span className="text-xs text-gray-700">1 hour ago</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 ml-3">Created</span>
                  <span className="text-xs text-gray-700">1 hour ago</span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Sources */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Sources</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                You last chatted with {selectedPerson.name.split(' ')[0]} 1 week ago via email. You've had 30 meetings, most recently 3 days ago, and emailed them 119 times, most recently 1 week ago.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <MailIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-blue-600">{selectedPerson.name.includes('@') ? selectedPerson.name.split(' ')[0] : `${selectedPerson.name.toLowerCase().replace(' ', '.')}@email.com`}</span>
                <span className="text-xs text-gray-400 ml-auto">Email</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

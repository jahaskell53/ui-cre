"use client";

import { useRouter } from "next/navigation";

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface RegisterNavBarProps {
  title: string;
  backHref?: string;
}

export default function RegisterNavBar({ title, backHref = "/news" }: RegisterNavBarProps) {
  const router = useRouter();

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(backHref)}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <BackIcon className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        <div className="w-9" /> {/* Spacer for centering */}
      </div>
    </div>
  );
}

"use client";

import { type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fingerprint, AlertTriangle } from "lucide-react";

interface AdminTabsProps {
  activeTab: string;
  pendingHwidCount: number;
  detectionCount: number;
  hwidContent: ReactNode;
  detectionsContent: ReactNode;
}

export function AdminTabs({
  activeTab,
  pendingHwidCount,
  detectionCount,
  hwidContent,
  detectionsContent,
}: AdminTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function switchTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("page"); // reset pagination on tab switch
    router.push(`/admin?${params.toString()}`);
  }

  const tabs = [
    {
      key: "hwid",
      label: "HWID Requests",
      icon: <Fingerprint className="w-4 h-4" />,
      badge: pendingHwidCount > 0 ? (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
          {pendingHwidCount}
        </span>
      ) : null,
      activeColor: "border-purple-500 text-purple-300",
    },
    {
      key: "detections",
      label: "Detection Logs",
      icon: <AlertTriangle className="w-4 h-4" />,
      badge: detectionCount > 0 ? (
        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30">
          {detectionCount}
        </span>
      ) : null,
      activeColor: "border-red-500 text-red-300",
    },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-white/5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? t.activeColor
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.icon}
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>

      {/* Tab body */}
      {activeTab === "hwid" && hwidContent}
      {activeTab === "detections" && detectionsContent}
    </>
  );
}

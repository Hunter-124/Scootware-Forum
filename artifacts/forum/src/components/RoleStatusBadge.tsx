import React from "react";
import { cn } from "@/lib/utils";

interface RoleStatusBadgeProps {
  role: string;
  upgradeType?: string | null;
  compact?: boolean;
  showIcon?: boolean;
}

/**
 * Format upgrade type for display
 * RUST_PREMIUM -> Rust
 * SPOOFER_LIFETIME -> Spoofer (Lifetime)
 */
function formatUpgradeDisplay(upgradeType: string | null | undefined): string {
  if (!upgradeType) return "";
  
  const isLifetime = upgradeType.includes("LIFETIME");
  const base = upgradeType
    .replace(/_PREMIUM$/, "")
    .replace(/_LIFETIME$/, "")
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  
  if (isLifetime && base) {
    return `${base} (Lifetime)`;
  }
  return base || "Subscriber";
}

function getStatusColor(
  role: string,
  upgradeType?: string | null
): { text: string; bg: string; border: string } {
  // Admin takes priority
  if (role === "admin") {
    return {
      text: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30"
    };
  }

  // Premium/Lifetime colors
  if (upgradeType?.includes("LIFETIME")) {
    return {
      text: "text-rose-500",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30"
    };
  }

  if (upgradeType?.includes("PREMIUM")) {
    return {
      text: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30"
    };
  }

  // Default user - subtle
  return {
    text: "text-zinc-400",
    bg: "bg-zinc-400/5",
    border: "border-zinc-400/20"
  };
}

export function RoleStatusBadge({
  role,
  upgradeType,
  compact = false,
  showIcon = true
}: RoleStatusBadgeProps) {
  const colors = getStatusColor(role, upgradeType);
  const display = upgradeType 
    ? formatUpgradeDisplay(upgradeType)
    : role === "admin"
    ? "Admin"
    : "Member";

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold uppercase tracking-tight whitespace-nowrap",
          colors.text,
          colors.bg,
          colors.border
        )}
      >
        <span>{display}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wide",
        colors.text,
        colors.bg,
        colors.border
      )}
    >
      <span>{display}</span>
    </div>
  );
}

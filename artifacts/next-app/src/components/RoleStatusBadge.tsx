import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Shield, Zap, Target, Trophy, Crown, User, Sparkles } from "lucide-react";

interface RoleStatusBadgeProps {
  role: string;
  upgradeType?: string | null;
  compact?: boolean;
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
    return `${base} (LT)`;
  }
  return base || "Subscriber";
}

type BadgeTheme = {
  text: string;
  bg: string;
  border: string;
  glow: string;
  icon: React.ReactNode;
  gradient: string;
};

function getStatusTheme(
  role: string,
  upgradeType?: string | null
): BadgeTheme {
  // Admin takes priority
  if (role === "admin") {
    return {
      text: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/30",
      glow: "shadow-[0_0_15px_rgba(251,191,36,0.2)]",
      gradient: "from-amber-400/20 via-amber-400/5 to-transparent",
      icon: <Crown className="w-3.5 h-3.5" />
    };
  }

  const type = (upgradeType || "").toUpperCase();

  // Rust: Orange
  if (type.includes("RUST")) {
    return {
      text: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      glow: "shadow-[0_0_15px_rgba(249,115,22,0.2)]",
      gradient: "from-orange-500/20 via-orange-500/5 to-transparent",
      icon: <Zap className="w-3.5 h-3.5" />
    };
  }

  // Bodycam: Red
  if (type.includes("BODYCAM")) {
    return {
      text: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.2)]",
      gradient: "from-red-500/20 via-red-500/5 to-transparent",
      icon: <Target className="w-3.5 h-3.5" />
    };
  }

  // DayZ: Green
  if (type.includes("DAYZ")) {
    return {
      text: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.2)]",
      gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      icon: <Shield className="w-3.5 h-3.5" />
    };
  }

  // Tarkov: Gold/Amber
  if (type.includes("TARKOV")) {
    return {
      text: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      glow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]",
      gradient: "from-yellow-500/20 via-yellow-500/5 to-transparent",
      icon: <Trophy className="w-3.5 h-3.5" />
    };
  }

  // Spoofer: Purple
  if (type.includes("SPOOFER")) {
    return {
      text: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      glow: "shadow-[0_0_15px_rgba(139,92,246,0.2)]",
      gradient: "from-violet-500/20 via-violet-500/5 to-transparent",
      icon: <Sparkles className="w-3.5 h-3.5" />
    };
  }

  // Default User
  return {
    text: "text-zinc-400",
    bg: "bg-zinc-400/5",
    border: "border-zinc-400/20",
    glow: "shadow-none",
    gradient: "from-zinc-400/10 via-transparent to-transparent",
    icon: <User className="w-3.5 h-3.5" />
  };
}

export function RoleStatusBadge({
  role,
  upgradeType,
  compact = false
}: RoleStatusBadgeProps) {
  const theme = getStatusTheme(role, upgradeType);
  const display = upgradeType 
    ? formatUpgradeDisplay(upgradeType)
    : role === "admin"
    ? "Administrator"
    : "Verified Member";

  const isSpecial = role === "admin" || !!upgradeType;

  return (
    <motion.div
      initial={isSpecial ? { scale: 0.95, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={isSpecial ? { scale: 1.05, y: -1 } : {}}
      className={cn(
        "relative group inline-flex items-center gap-2 overflow-hidden transition-all duration-300",
        compact ? "px-2.5 py-1 rounded-md" : "px-4 py-1.5 rounded-xl",
        "border backdrop-blur-md font-black uppercase tracking-[0.1em]",
        theme.text,
        theme.bg,
        theme.border,
        theme.glow
      )}
    >
      {/* Animated Shine Effect for Special Roles */}
      {isSpecial && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />
      )}
      
      {/* Background Gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", theme.gradient)} />

      {/* Icon */}
      <span className="relative z-10 opacity-80 group-hover:opacity-100 transition-opacity">
        {theme.icon}
      </span>

      {/* Label */}
      <span className={cn(
        "relative z-10 leading-none",
        compact ? "text-[10px]" : "text-[11px]"
      )}>
        {display}
      </span>

      {/* Pulsing Dot for Admin/Premium */}
      {isSpecial && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", theme.text.replace('text-', 'bg-'))}></span>
          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", theme.text.replace('text-', 'bg-'))}></span>
        </span>
      )}
    </motion.div>
  );
}

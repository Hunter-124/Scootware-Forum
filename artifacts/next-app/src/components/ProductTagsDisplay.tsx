"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Target, Trophy, Shield, Sparkles } from "lucide-react";

interface ProductAccess {
  productId?: string;
  expiresAt?: Date;
}

interface ProductTagsDisplayProps {
  productAccess: ProductAccess[];
  upgradeType?: string | null;
  compact?: boolean;
}

/**
 * Map product IDs to display names and themes
 */
function getProductTheme(productId?: string) {
  const id = (productId || "").toUpperCase();

  // Rust: Orange
  if (id.includes("RUST")) {
    return {
      name: "Rust",
      text: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      glow: "shadow-[0_0_15px_rgba(249,115,22,0.2)]",
      gradient: "from-orange-500/20 via-orange-500/5 to-transparent",
      icon: <Zap className="w-3 h-3" />,
    };
  }

  // Bodycam: Red
  if (id.includes("BODYCAM")) {
    return {
      name: "Bodycam",
      text: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      glow: "shadow-[0_0_15px_rgba(239,68,68,0.2)]",
      gradient: "from-red-500/20 via-red-500/5 to-transparent",
      icon: <Target className="w-3 h-3" />,
    };
  }

  // DayZ: Green
  if (id.includes("DAYZ")) {
    return {
      name: "DayZ",
      text: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.2)]",
      gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
      icon: <Shield className="w-3 h-3" />,
    };
  }

  // Tarkov: Gold/Amber
  if (id.includes("TARKOV")) {
    return {
      name: "Tarkov",
      text: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      glow: "shadow-[0_0_15px_rgba(234,179,8,0.2)]",
      gradient: "from-yellow-500/20 via-yellow-500/5 to-transparent",
      icon: <Trophy className="w-3 h-3" />,
    };
  }

  // Spoofer: Purple
  if (id.includes("SPOOFER")) {
    return {
      name: "Spoofer",
      text: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      glow: "shadow-[0_0_15px_rgba(139,92,246,0.2)]",
      gradient: "from-violet-500/20 via-violet-500/5 to-transparent",
      icon: <Sparkles className="w-3 h-3" />,
    };
  }

  // Default
  return {
    name: productId || "Unknown",
    text: "text-zinc-400",
    bg: "bg-zinc-400/5",
    border: "border-zinc-400/20",
    glow: "shadow-none",
    gradient: "from-zinc-400/10 via-transparent to-transparent",
    icon: null,
  };
}

/**
 * Individual product tag component
 */
function ProductTag({ productId, compact }: { productId?: string; compact?: boolean }) {
  const theme = getProductTheme(productId);

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05, y: -1 }}
      className={cn(
        "relative group inline-flex items-center gap-1.5 overflow-hidden transition-all duration-300",
        compact ? "px-2 py-0.5 rounded-md" : "px-3 py-1 rounded-lg",
        "border backdrop-blur-md font-black uppercase tracking-[0.05em]",
        theme.text,
        theme.bg,
        theme.border,
        theme.glow
      )}
    >
      {/* Animated Shine Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />

      {/* Background Gradient */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", theme.gradient)} />

      {/* Icon */}
      {theme.icon && (
        <span className="relative z-10 opacity-80 group-hover:opacity-100 transition-opacity">
          {theme.icon}
        </span>
      )}

      {/* Label */}
      <span className={cn("relative z-10 leading-none", compact ? "text-[9px]" : "text-[10px]")}>
        {theme.name}
      </span>
    </motion.div>
  );
}

/**
 * Dropdown trigger for overflow tags
 */
function OverflowTrigger({ count, compact }: { count: number; compact?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05, y: -1 }}
      className={cn(
        "relative group inline-flex items-center justify-center overflow-hidden transition-all duration-300 cursor-pointer",
        compact ? "w-7 h-6 rounded-md" : "w-9 h-7 rounded-lg",
        "border border-white/20 bg-white/5 backdrop-blur-md",
        "hover:bg-white/10 hover:border-white/40"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shine" />
      <span className={cn("relative z-10 font-black", compact ? "text-[9px]" : "text-[10px]")}>
        +{count}
      </span>
    </motion.div>
  );
}

/**
 * Dropdown menu for overflow tags
 */
function OverflowDropdown({
  tags,
  isOpen,
  compact,
}: {
  tags: ProductAccess[];
  isOpen: boolean;
  compact?: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "absolute top-full right-0 mt-2 bg-card/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl z-50",
            compact ? "min-w-max" : "min-w-[160px]"
          )}
        >
          <div className="flex flex-col gap-2 p-2">
            {tags.map((access, index) => (
              <div key={index} className="flex items-center gap-2">
                <ProductTag productId={access.productId} compact={compact} />
                {access.expiresAt && (
                  <span className="text-[8px] text-muted-foreground whitespace-nowrap">
                    {new Date(access.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Main component: displays product tags with horizontal overflow handling
 * Shows a "..." dropdown for tags that don't fit
 */
export function ProductTagsDisplay({
  productAccess,
  upgradeType,
  compact = false,
}: ProductTagsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(
    productAccess?.length || 0
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && tagsRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const tagsWidth = tagsRef.current.scrollWidth;

        // If content overflows, calculate how many tags can fit
        if (tagsWidth > containerWidth) {
          setHasOverflow(true);
          // Try to fit at least one tag + the overflow indicator
          let count = 0;
          let currentWidth = 0;
          const overflowWidth = compact ? 35 : 45; // Width of "+N" button

          for (let i = 0; i < (productAccess?.length || 0); i++) {
            // Estimate tag width (rough approximation)
            const estimatedTagWidth = compact ? 60 : 80;
            currentWidth += estimatedTagWidth + 8; // 8px gap

            if (currentWidth + overflowWidth <= containerWidth) {
              count = i + 1;
            } else {
              break;
            }
          }

          setVisibleCount(Math.max(1, count));
        } else {
          setHasOverflow(false);
          setVisibleCount(productAccess?.length || 0);
        }
      }
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [productAccess, compact]);

  if (!productAccess || productAccess.length === 0) {
    return null;
  }

  const visibleTags = productAccess.slice(0, visibleCount);
  const overflowTags = productAccess.slice(visibleCount);
  const showOverflow = hasOverflow && overflowTags.length > 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center gap-1.5 relative max-w-full overflow-hidden",
        compact ? "max-w-36" : "max-w-64"
      )}
    >
      <div
        ref={tagsRef}
        className="flex items-center gap-1.5 flex-wrap"
      >
        {visibleTags.map((access, index) => (
          <ProductTag key={index} productId={access.productId} compact={compact} />
        ))}

        {showOverflow && (
          <div className="relative group">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              <OverflowTrigger
                count={overflowTags.length}
                compact={compact}
              />
            </button>
            <OverflowDropdown
              tags={overflowTags}
              isOpen={isDropdownOpen}
              compact={compact}
            />
          </div>
        )}
      </div>
    </div>
  );
}

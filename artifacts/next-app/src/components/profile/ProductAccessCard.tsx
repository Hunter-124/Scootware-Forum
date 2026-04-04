"use client";

import React from "react";
import { motion } from "framer-motion";
import { PRODUCT_ICONS } from "@/lib/product-assets";
import { cn } from "@/lib/utils";
import { Calendar, ChevronRight } from "lucide-react";

interface ProductAccessCardProps {
  productId: string;
  expiresAt: Date;
}

type ProductTheme = {
  color: string;
  bg: string;
  border: string;
  glow: string;
  name: string;
};

const PRODUCT_THEMES: Record<string, ProductTheme> = {
  RUST: {
    name: "Rust Premium",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]",
  },
  BODYCAM: {
    name: "Bodycam Access",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
  },
  DAYZ: {
    name: "DayZ Private",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
  },
  TARKOV: {
    name: "Tarkov Elite",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    glow: "shadow-[0_0_20px_rgba(234,179,8,0.15)]",
  },
  SPOOFER: {
    name: "HWID Spoofer",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]",
  },
};

const DEFAULT_THEME: ProductTheme = {
  name: "Software Access",
  color: "text-primary",
  bg: "bg-primary/10",
  border: "border-primary/20",
  glow: "shadow-[0_0_20px_rgba(var(--primary),0.15)]",
};

export function ProductAccessCard({ productId, expiresAt }: ProductAccessCardProps) {
  const theme = PRODUCT_THEMES[productId.toUpperCase()] || DEFAULT_THEME;
  const icon = PRODUCT_ICONS[productId.toUpperCase()] || PRODUCT_ICONS.DEFAULT;
  
  const daysRemaining = Math.ceil((expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      className={cn(
        "glass-panel p-6 rounded-3xl border transition-all duration-500 group relative overflow-hidden",
        theme.border,
        theme.glow,
        "hover:bg-white/[0.04]"
      )}
    >
      {/* Background Accent */}
      <div className={cn("absolute -right-8 -bottom-8 w-32 h-32 blur-[60px] opacity-20 transition-opacity group-hover:opacity-40", theme.bg)} />
      
      <div className="flex items-center gap-6 relative z-10">
        {/* Icon Container */}
        <div className={cn(
          "w-16 h-16 rounded-2xl flex items-center justify-center border transition-transform duration-500 group-hover:rotate-6",
          theme.bg,
          theme.border
        )}>
          {React.cloneElement(icon as React.ReactElement<any>, { className: cn("w-8 h-8", theme.color) })}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1">
          <h3 className="text-lg font-black text-white uppercase tracking-tighter group-hover:text-glow transition-all">
            {theme.name}
          </h3>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
              Expires in {daysRemaining} days
            </span>
          </div>
        </div>

        {/* Action/Chevron */}
        <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
          <div className={cn("p-2 rounded-xl border bg-white/5", theme.border)}>
            <ChevronRight className={cn("w-5 h-5", theme.color)} />
          </div>
        </div>
      </div>

      {/* Progress Bar (Visual Only) */}
      <div className="mt-6 h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={cn("h-full", theme.color.replace('text-', 'bg-'))} 
        />
      </div>
    </motion.div>
  );
}

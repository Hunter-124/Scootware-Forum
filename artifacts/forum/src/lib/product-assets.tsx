import React from "react";
import { Sparkles, Target, Zap, ShieldCheck, Trophy, Layout } from "lucide-react";

export const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  BODYCAM: <Target className="w-10 h-10 text-primary" />,
  RUST: <Zap className="w-10 h-10 text-amber-500" />,
  DAYZ: <ShieldCheck className="w-10 h-10 text-green-500" />,
  TARKOV: <Trophy className="w-10 h-10 text-blue-500" />,
  FREE: <Sparkles className="w-10 h-10 text-accent" />,
  SPOOFER: <Zap className="w-10 h-10 text-purple-500" />,
  DEFAULT: <Layout className="w-10 h-10 text-muted-foreground" />
};

export const PRODUCT_IMAGES: Record<string, string> = {
  BODYCAM: "images/products/bodycam.jpg",
  RUST: "images/products/rust.jpg",
  DAYZ: "images/products/dayz.jpg",
  TARKOV: "images/products/tarkov.png",
  SPOOFER: "images/products/spoofer.jpg",
  DEFAULT: "images/hero-bg.png"
};

// Helper function to get image by category
export function getCategoryImage(category: any): string {
  // Check by productId first
  if (category.productId && PRODUCT_IMAGES[category.productId]) {
    return PRODUCT_IMAGES[category.productId];
  }
  
  // Check by category name
  const name = category.name?.toLowerCase() || "";
  if (name.includes("general")) {
    return "images/products/general.jpg";
  }
  if (name.includes("support")) {
    return "images/products/support.jpg";
  }
  
  // Default fallback
  return PRODUCT_IMAGES.DEFAULT;
}

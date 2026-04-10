import React from "react";
import { Sparkles, Target, Zap, ShieldCheck, Trophy, Layout } from "lucide-react";

export const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  BODYCAM: <Target className="w-10 h-10 text-primary" />,
  RUST: <Zap className="w-10 h-10 text-amber-500" />,
  DAYZ: <ShieldCheck className="w-10 h-10 text-green-500" />,
  TARKOV: <Trophy className="w-10 h-10 text-blue-500" />,
  CS2: <Target className="w-10 h-10 text-orange-500" />,
  FREE: <Sparkles className="w-10 h-10 text-accent" />,
  SPOOFER: <Zap className="w-10 h-10 text-purple-500" />,
  DEFAULT: <Layout className="w-10 h-10 text-muted-foreground" />
};

export const PRODUCT_IMAGES: Record<string, string> = {
  BODYCAM: "images/products/bodycam.jpg",
  RUST: "images/products/rust.jpg",
  DAYZ: "images/products/dayz.jpg",
  TARKOV: "images/products/tarkov.png",
  CS2: "images/products/cs2.jpg",
  SPOOFER: "images/products/spoofer.jpg",
  DEFAULT: "images/hero-bg.png"
};

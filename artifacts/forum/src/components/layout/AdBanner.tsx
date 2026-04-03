import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdBanner({ className = "" }: { className?: string }) {
  return (
    <div className={cn("glass-panel rounded-xl border border-white/10 overflow-hidden shadow-2xl shadow-primary/5", className)}>
      <div className="relative h-full rounded-xl overflow-hidden border border-white/10 shadow-lg">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Cybernetic grid background" 
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/80 to-transparent" />
        
        <div className="relative z-10 p-6 flex flex-col items-center text-center space-y-4">
          <h3 className="text-xl font-display font-bold tracking-wide text-glow">
            DOMINATE THE <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">GAME.</span>
          </h3>
          <p className="text-sm text-gray-300 font-light leading-snug">
            Unlock elite performance with premium access.
          </p>
          <Link href="/store" className="w-full">
            <Button variant="glow" size="sm" className="w-full font-bold tracking-wide text-xs">
              GET ACCESS <Zap className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

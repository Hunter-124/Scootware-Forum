import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Download, Shield, Zap, RefreshCw, CheckCircle2,
  Lock, AlertTriangle, ChevronRight, Terminal, Cpu, Box
} from "lucide-react";
import { Shoutbox } from "@/components/layout/Shoutbox";
import { motion } from "framer-motion";

const LOADER_VERSION = "2.4.1";
const LOADER_DATE = "March 2026";
const LOADER_SIZE = "3.2 MB";

const products = [
  { id: "BODYCAM", status: "stable", version: "1.9.3", name: "Bodycam Access" },
  { id: "RUST", status: "stable", version: "2.1.0", name: "Rust Access" },
  { id: "DAYZ", status: "beta",   version: "3.0.0-beta", name: "DayZ Access" },
  { id: "TARKOV", status: "stable", version: "1.4.7", name: "Tarkov Access" },
  { id: "SPOOFER", status: "stable", version: "2.6.2", name: "Spoofer Module" },
];

const changelog = [
  { version: "2.4.1", date: "Mar 2026", notes: ["Improved software injection stability", "Fixed rare crash on Windows 11 24H2", "Faster update checks on startup"] },
  { version: "2.4.0", date: "Feb 2026", notes: ["Added Spoofer support", "New auto-update engine", "Reduced memory footprint by 18%"] },
  { version: "2.3.2", date: "Jan 2026", notes: ["Hotfix: Session token refresh", "UI scaling fix for 4K displays"] },
];

const steps = [
  { n: "01", label: "Download", desc: "Get the Scootware Hub below." },
  { n: "02", label: "Run as Admin", desc: "Right-click the .exe and run as Administrator." },
  { n: "03", label: "Log In", desc: "Sign in with your Scootware account." },
  { n: "04", label: "Select Module", desc: "Pick a product and click Sync — done." },
];

export default function Loader() {
  const { isAuthenticated, user } = useAuth();
  const hasProduct = isAuthenticated && user?.upgradeType;

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col lg:flex-row gap-12 w-full relative">
       {/* Background Decoration */}
       <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -z-10" />

      <div className="flex-1 min-w-0 flex flex-col gap-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2 text-primary text-xs font-black tracking-[0.3em] uppercase">
            <Terminal className="w-4 h-4" />
            <span>Scootware Ecosystem</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black text-white tracking-tighter leading-none">
            SOFTWARE <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x">HUB</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-xl font-medium leading-relaxed">
            The unified control center for all your Scootware products. 
            Automated syncing, HWID protection, and seamless integration in one lightweight tool.
          </p>
        </motion.div>

        {/* Download card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-[2.5rem] overflow-hidden border border-primary/30 shadow-[0_20px_50px_rgba(168,85,247,0.1)] bg-card/40 backdrop-blur-sm group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none group-hover:opacity-100 transition-opacity" />
          <div className="relative p-10 md:p-12 flex flex-col md:flex-row items-center gap-10">
            {/* Icon */}
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.2)] shrink-0 group-hover:scale-110 transition-transform duration-500">
              <Download className="w-12 h-12 md:w-14 md:h-14 text-primary" />
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
                <h2 className="text-3xl font-display font-black text-white tracking-tight uppercase">ScootwareHub.exe</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2.5 py-1 rounded-full font-black tracking-widest uppercase">
                    v{LOADER_VERSION}
                  </span>
                  <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">
                    Verified
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4 font-bold uppercase tracking-widest opacity-60">
                Windows 10 / 11 (64-bit) &nbsp;·&nbsp; {LOADER_SIZE} &nbsp;·&nbsp; {LOADER_DATE}
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Auto-Sync</span>
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><Shield className="w-3.5 h-3.5 text-primary" /> Encrypted</span>
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5"><Zap className="w-3.5 h-3.5 text-accent" /> Low-Latency</span>
              </div>
            </div>

            {/* Download button or gate */}
            <div className="shrink-0 flex flex-col items-center md:items-end gap-3">
              {hasProduct ? (
                <Button
                    size="lg"
                    className="h-16 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs shadow-[0_10px_30px_rgba(168,85,247,0.3)] hover:scale-[1.02] active:scale-95 transition-all"
                    onClick={() => alert("Deployment scheduled. Binary will be available shortly.")}
                >
                  <Download className="w-5 h-5 mr-2" /> Initialize Download
                </Button>
              ) : isAuthenticated ? (
                <div className="flex flex-col items-center md:items-end gap-3">
                  <div className="flex items-center gap-2 text-amber-500 text-[10px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                    <Lock className="w-3.5 h-3.5" /> Access Restricted
                  </div>
                  <Link href="/products">
                    <Button variant="glow" size="sm" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest">
                      Obtain Access <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center md:items-end gap-3">
                  <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest bg-blue-400/10 border border-blue-400/20 px-4 py-2 rounded-xl">
                    <Lock className="w-3.5 h-3.5" /> Identity Required
                  </div>
                  <Link href="/login">
                    <Button variant="glow" size="sm" className="rounded-xl px-6 font-black text-[10px] uppercase tracking-widest">
                      Sign In <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Notice */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-5 p-6 rounded-3xl border border-primary/20 bg-primary/5 text-sm text-primary group"
        >
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <AlertTriangle className="w-6 h-6 text-primary" />
          </div>
          <span className="font-bold flex-1 tracking-tight leading-snug">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] block mb-1 opacity-60 text-white">System Advisory</span>
            Due to our proprietary low-level injection technology, some security software may flag the Hub. 
            We guarantee the safety of our binaries—please add the execution path to your exclusions list.
          </span>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* How to use */}
          <div className="glass-panel rounded-[2rem] border border-white/10 p-8 flex flex-col gap-6 shadow-xl">
            <h3 className="text-xl font-display font-black text-white flex items-center gap-3 uppercase tracking-tight">
              <Cpu className="w-6 h-6 text-primary" /> Hub Operations
            </h3>
            <div className="flex flex-col gap-8">
              {steps.map(step => (
                <div key={step.n} className="flex items-start gap-6 group">
                  <span className="font-display text-primary font-black text-3xl shrink-0 opacity-20 group-hover:opacity-100 transition-opacity leading-none pt-1">{step.n}</span>
                  <div>
                    <div className="font-black text-white text-[11px] uppercase tracking-widest mb-1">{step.label}</div>
                    <div className="text-muted-foreground text-sm font-medium leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Modules */}
          <div className="glass-panel rounded-[2rem] border border-white/10 p-8 flex flex-col gap-6 shadow-xl">
            <h3 className="text-xl font-display font-black text-white flex items-center gap-3 uppercase tracking-tight">
              <Box className="w-6 h-6 text-accent" /> Active Modules
            </h3>
            <div className="flex flex-col gap-4">
              {products.map(p => (
                <div key={p.id} className="flex items-center justify-between py-4 px-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/20 transition-all hover:bg-white/[0.05] group">
                  <div className="flex items-center gap-4">
                     <Zap className="w-4 h-4 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
                    <div>
                      <div className="font-black text-white text-[10px] uppercase tracking-widest">{p.name}</div>
                      <div className="font-mono text-muted-foreground text-[10px] opacity-40 uppercase tracking-tighter">{p.id}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn(
                      "text-[8px] uppercase font-black px-2 py-0.5 rounded-full border tracking-[0.2em]",
                      p.status === "beta"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-green-500/10 text-green-400 border-green-500/20"
                    )}>
                      {p.status}
                    </span>
                    <span className="font-mono text-muted-foreground text-[10px] opacity-50">v{p.version}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Changelog */}
        <div className="glass-panel rounded-[2rem] border border-white/10 p-10 flex flex-col gap-8 shadow-xl mb-20">
          <h3 className="text-xl font-display font-black text-white flex items-center gap-3 uppercase tracking-tight">
            <RefreshCw className="w-6 h-6 text-primary" /> System Changelog
          </h3>
          <div className="flex flex-col divide-y divide-white/5">
            {changelog.map(entry => (
              <div key={entry.version} className="py-8 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-6 md:gap-16">
                <div className="shrink-0 flex items-baseline gap-4 md:w-44">
                  <span className="font-display font-black text-white text-2xl tracking-tighter italic">v{entry.version}</span>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">{entry.date}</span>
                </div>
                <ul className="flex flex-col gap-4">
                  {entry.notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-4 text-sm text-gray-400 font-medium leading-relaxed">
                      <div className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_10px_rgba(168,85,247,1)]" /> 
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-24">
            <Shoutbox />
          </div>
        </aside>
      )}
    </div>
  );
}

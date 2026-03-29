import React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Download, Shield, Zap, RefreshCw, CheckCircle2,
  Lock, AlertTriangle, ChevronRight, Terminal, Cpu
} from "lucide-react";

const LOADER_VERSION = "2.4.1";
const LOADER_DATE = "March 2026";
const LOADER_SIZE = "3.2 MB";

const drivers = [
  { id: "BC1482", status: "stable", version: "1.9.3" },
  { id: "RU1823", status: "stable", version: "2.1.0" },
  { id: "DZ1923", status: "beta",   version: "3.0.0-beta" },
  { id: "TK7321", status: "stable", version: "1.4.7" },
  { id: "SPF1643", status: "stable", version: "2.6.2" },
];

const changelog = [
  { version: "2.4.1", date: "Mar 2026", notes: ["Improved driver injection stability", "Fixed rare crash on Windows 11 24H2", "Faster update checks on startup"] },
  { version: "2.4.0", date: "Feb 2026", notes: ["Added SPF1643 support", "New auto-update engine", "Reduced memory footprint by 18%"] },
  { version: "2.3.2", date: "Jan 2026", notes: ["Hotfix: Session token refresh", "UI scaling fix for 4K displays"] },
];

const steps = [
  { n: "01", label: "Download", desc: "Get the Scootware Loader below." },
  { n: "02", label: "Run as Admin", desc: "Right-click the .exe and run as Administrator." },
  { n: "03", label: "Log In", desc: "Sign in with your Scootware account." },
  { n: "04", label: "Select Driver", desc: "Pick a driver and click Inject — done." },
];

export default function Loader() {
  const { isAuthenticated, user } = useAuth();
  const hasUpgrade = isAuthenticated && user?.upgradeType;

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary text-xs font-bold tracking-widest uppercase">
          <Terminal className="w-4 h-4" />
          <span>Scootware Loader</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-extrabold text-white tracking-tight">
          SOFTWARE LOADER
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg">
          The Scootware Loader is the unified launcher for all your licensed driver products.
          One tool, all your performance gear — updated automatically.
        </p>
      </div>

      {/* Download card */}
      <div className="relative rounded-2xl overflow-hidden border border-primary/30 shadow-2xl shadow-primary/10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5 pointer-events-none" />
        <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-8">
          {/* Icon */}
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.3)] shrink-0">
            <Download className="w-10 h-10 md:w-12 md:h-12 text-primary" />
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 className="text-2xl font-display font-bold text-white">ScootwareLoader.exe</h2>
              <span className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-mono font-bold">
                v{LOADER_VERSION}
              </span>
              <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                Latest
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Windows 10 / 11 (64-bit) &nbsp;·&nbsp; {LOADER_SIZE} &nbsp;·&nbsp; Updated {LOADER_DATE}
            </p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Auto-updates</span>
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" /> Digitally signed</span>
              <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-accent" /> Injects in &lt;2s</span>
            </div>
          </div>

          {/* Download button or gate */}
          <div className="shrink-0 flex flex-col items-end gap-3">
            {hasUpgrade ? (
              <a
                href="#"
                onClick={e => { e.preventDefault(); alert("Download will be available once the loader binary is uploaded by an admin."); }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base transition-all duration-200 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"
              >
                <Download className="w-5 h-5" /> Download Loader
              </a>
            ) : isAuthenticated ? (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium bg-amber-400/10 border border-amber-400/20 px-4 py-2 rounded-lg">
                  <Lock className="w-4 h-4" /> Upgrade required
                </div>
                <Link href="/upgrades">
                  <Button variant="glow" size="sm">Get an Upgrade <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium bg-amber-400/10 border border-amber-400/20 px-4 py-2 rounded-lg">
                  <Lock className="w-4 h-4" /> Login required
                </div>
                <Link href="/login">
                  <Button variant="glow" size="sm">Log In to Download <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-300">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
        <span>
          <strong className="text-amber-400">Antivirus notice:</strong> The loader uses low-level driver injection techniques.
          Your AV may flag it as a false positive. Add it to your exclusions list or temporarily disable real-time protection during installation.
          The loader is digitally signed — always verify the signature before running.
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* How to use */}
        <div className="glass-panel rounded-2xl border border-white/10 p-6 flex flex-col gap-5">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" /> How to Use
          </h3>
          <div className="flex flex-col gap-4">
            {steps.map(step => (
              <div key={step.n} className="flex items-start gap-4">
                <span className="font-mono text-primary font-bold text-sm shrink-0 w-8 pt-0.5">{step.n}</span>
                <div>
                  <div className="font-semibold text-white text-sm">{step.label}</div>
                  <div className="text-muted-foreground text-sm mt-0.5">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supported drivers */}
        <div className="glass-panel rounded-2xl border border-white/10 p-6 flex flex-col gap-5">
          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" /> Supported Drivers
          </h3>
          <div className="flex flex-col gap-2">
            {drivers.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-white text-sm">{d.id}</span>
                  <span className={cn(
                    "text-[10px] uppercase font-bold px-2 py-0.5 rounded border tracking-widest",
                    d.status === "beta"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-green-500/10 text-green-400 border-green-500/20"
                  )}>
                    {d.status}
                  </span>
                </div>
                <span className="font-mono text-muted-foreground text-xs">v{d.version}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Changelog */}
      <div className="glass-panel rounded-2xl border border-white/10 p-6 flex flex-col gap-5">
        <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" /> Changelog
        </h3>
        <div className="flex flex-col divide-y divide-white/5">
          {changelog.map(entry => (
            <div key={entry.version} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row gap-3 md:gap-8">
              <div className="shrink-0 flex items-baseline gap-3 md:w-36">
                <span className="font-mono font-bold text-white text-sm">v{entry.version}</span>
                <span className="text-xs text-muted-foreground">{entry.date}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {entry.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-1">▸</span> {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

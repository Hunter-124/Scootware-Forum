import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Mail, Lock, User, LinkIcon, UserPlus, ArrowLeft, Shield, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SsoPendingData {
  provider: "google" | "discord" | "steam";
  displayName: string;
  avatarUrl: string | null;
  suggestedUsername: string;
  email: string | null;
}

const PROVIDER_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
  discord: { border: "border-[#5865F2]/30", bg: "bg-[#5865F2]/10", text: "text-[#5865F2]", label: "Discord" },
  google: { border: "border-white/20", bg: "bg-white/5", text: "text-white", label: "Google" },
  steam: { border: "border-[#66c0f4]/30", bg: "bg-[#171a21]/40", text: "text-[#66c0f4]", label: "Steam" },
};

export default function SsoLink() {
  const [, setLocation] = useLocation();
  const { invalidateAuth } = useAuth();
  const [pending, setPending] = useState<SsoPendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"choose" | "link" | "create">("choose");

  // Link form state
  const [linkEmail, setLinkEmail] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const [linkError, setLinkError] = useState("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  // Create form state
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/sso/pending", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          setLocation("/login");
          return;
        }
        const data = await r.json();
        setPending(data);
        setCreateUsername(data.suggestedUsername);
        if (data.email) setCreateEmail(data.email);
      })
      .catch(() => setLocation("/login"))
      .finally(() => setLoading(false));
  }, [setLocation]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError("");
    setLinkSubmitting(true);
    try {
      const res = await fetch("/api/auth/sso/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: linkEmail, password: linkPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLinkError(data.error || "Failed to link account.");
        return;
      }
      invalidateAuth();
      setLocation("/");
    } catch {
      setLinkError("Network error. Please try again.");
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/auth/sso/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: createUsername,
          email: createEmail || "",
          password: createPassword || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create account.");
        return;
      }
      invalidateAuth();
      setLocation("/");
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm uppercase tracking-widest">Loading SSO data...</span>
        </div>
      </div>
    );
  }

  if (!pending) return null;

  const providerStyle = PROVIDER_COLORS[pending.provider] || PROVIDER_COLORS.google;

  return (
    <div className="container mx-auto px-4 py-8 min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md relative">
        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
        <div className="glass-panel rounded-3xl border border-white/10 shadow-2xl p-8 relative z-10 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-accent" />

          {/* SSO Identity Badge */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 text-primary mb-4 box-glow overflow-hidden">
              {pending.avatarUrl ? (
                <img src={pending.avatarUrl} alt={pending.displayName} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Cpu className="w-7 h-7" />
              )}
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">SSO ACCOUNT SETUP</h1>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${providerStyle.border} ${providerStyle.bg} ${providerStyle.text}`}>
              <Shield className="w-3 h-3" />
              Authenticated via {providerStyle.label}
            </div>
            <p className="text-muted-foreground text-sm mt-3">
              Welcome, <span className="text-white font-medium">{pending.displayName}</span>! Choose how to continue.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {mode === "choose" && (
              <motion.div
                key="choose"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <button
                  onClick={() => setMode("link")}
                  className="w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/30 transition-all duration-300 text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary group-hover:box-glow transition-all">
                      <LinkIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">Link Existing Account</div>
                      <div className="text-muted-foreground text-xs mt-0.5">Connect your {providerStyle.label} to an account you already have</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setMode("create")}
                  className="w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-accent/30 transition-all duration-300 text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent group-hover:box-glow transition-all">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">Create New Account</div>
                      <div className="text-muted-foreground text-xs mt-0.5">Set up a brand new Scootware identity</div>
                    </div>
                  </div>
                </button>

                <div className="pt-2 text-center">
                  <Link href="/login" className="text-xs text-muted-foreground hover:text-white transition-colors">
                    ← Cancel and return to login
                  </Link>
                </div>
              </motion.div>
            )}

            {mode === "link" && (
              <motion.div
                key="link"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <button
                  onClick={() => setMode("choose")}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors mb-4 group"
                >
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                  Back to options
                </button>

                <h2 className="text-lg font-display font-bold text-white mb-1 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-primary" />
                  Link Existing Account
                </h2>
                <p className="text-muted-foreground text-xs mb-4">
                  Enter the credentials for the account you want to connect your {providerStyle.label} to.
                </p>

                <form onSubmit={handleLink} className="space-y-4">
                  {linkError && (
                    <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">{linkError}</div>
                  )}
                  <div className="space-y-1 text-left">
                    <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Account Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input type="email" required className="pl-9 bg-black/40" value={linkEmail} onChange={e => setLinkEmail(e.target.value)} placeholder="your@email.com" />
                    </div>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Account Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input type="password" required className="pl-9 bg-black/40" value={linkPassword} onChange={e => setLinkPassword(e.target.value)} />
                    </div>
                  </div>
                  <Button type="submit" variant="glow" className="w-full py-5 font-bold tracking-wide" disabled={linkSubmitting}>
                    {linkSubmitting ? "LINKING..." : "LINK ACCOUNT"}
                  </Button>
                </form>
              </motion.div>
            )}

            {mode === "create" && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <button
                  onClick={() => setMode("choose")}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors mb-4 group"
                >
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                  Back to options
                </button>

                <h2 className="text-lg font-display font-bold text-white mb-1 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-accent" />
                  Create New Account
                </h2>
                <p className="text-muted-foreground text-xs mb-4">
                  Choose your callsign. Email and password are optional — you can always sign in with {providerStyle.label}.
                </p>

                <form onSubmit={handleCreate} className="space-y-4">
                  {createError && (
                    <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">{createError}</div>
                  )}
                  <div className="space-y-1 text-left">
                    <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">
                      Callsign (Username) <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        required
                        minLength={3}
                        maxLength={30}
                        className="pl-9 bg-black/40"
                        value={createUsername}
                        onChange={e => setCreateUsername(e.target.value)}
                        placeholder="Your unique callsign"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground ml-1">Auto-generated. Feel free to change it!</p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/5" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-card px-2 text-muted-foreground tracking-widest">Optional</span>
                    </div>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">
                      Email <span className="text-muted-foreground/50 text-[10px] normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input type="email" className="pl-9 bg-black/40" value={createEmail} onChange={e => setCreateEmail(e.target.value)} placeholder="Optional — for password recovery" />
                    </div>
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">
                      Password <span className="text-muted-foreground/50 text-[10px] normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input type="password" minLength={8} className="pl-9 bg-black/40" value={createPassword} onChange={e => setCreatePassword(e.target.value)} placeholder="Optional — for email login" />
                    </div>
                  </div>
                  <Button type="submit" variant="glow" className="w-full py-5 font-bold tracking-wide" disabled={createSubmitting}>
                    {createSubmitting ? "CREATING..." : "CREATE ACCOUNT"}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

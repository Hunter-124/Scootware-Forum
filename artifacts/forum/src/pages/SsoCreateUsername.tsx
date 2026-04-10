import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, User, ArrowLeft, Shield, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface SsoPendingData {
  provider: "google" | "discord" | "steam";
  displayName: string;
  avatarUrl: string | null;
  suggestedUsername: string;
  email: string | null;
}

// Branded SSO Icons
const SteamIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.568 3.797 10.25 8.922 11.603l-.014-.005c.814-.366 1.173-1.096 1.173-1.096.012-.023.013-.046.002-.066l-1.085-1.53c-.007-.01-.019-.015-.03-.014-.012.001-.023.008-.028.02a3.486 3.486 0 0 1-.871.218 1.867 1.867 0 1 1 0-3.734 1.867 1.867 0 0 1 0 3.734c.045 0 .09.002.133.006.012.001.023-.005.029-.016l1.222-1.721c.54.148 1.11.226 1.7.226 3.482 0 6.305-2.823 6.305-6.305s-2.823-6.305-6.305-6.305-6.305 2.823-6.305 6.305c0 .324.025.642.072.953.002.012.012.02.024.019.012-.001.021-.01.02-.023a4.343 4.343 0 0 1 4.364-4.502c2.395 0 4.336 1.942 4.336 4.337s-1.941 4.336-4.336 4.336c-.464 0-.91-.073-1.328-.209-.012-.004-.025 0-.031.011l-1.573 1.107c-.122.14-.15.424-.04.64l3.181 1.312a12.002 12.002 0 0 0 10.05-11.144c0-6.627-5.373-12-12-12z"/>
  </svg>
);

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" className={className}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
  </svg>
);

const PROVIDER_COLORS: Record<string, { border: string; bg: string; text: string; label: string; icon: any }> = {
  discord: { border: "border-[#5865F2]/30", bg: "bg-[#5865F2]/10", text: "text-[#5865F2]", label: "Discord", icon: DiscordIcon },
  google: { border: "border-white/20", bg: "bg-white/5", text: "text-white", label: "Google", icon: GoogleIcon },
  steam: { border: "border-[#66c0f4]/30", bg: "bg-[#171a21]/40", text: "text-[#66c0f4]", label: "Steam", icon: SteamIcon },
};

export default function SsoCreateUsername() {
  const [, setLocation] = useLocation();
  const { invalidateAuth } = useAuth();
  const [pending, setPending] = useState<SsoPendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/sso/pending", { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          setLocation("/login");
          return;
        }
        const data = await r.json();
        setPending(data);
        setUsername(data.suggestedUsername);
      })
      .catch(() => setLocation("/login"))
      .finally(() => setLoading(false));
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/sso/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          // Only sending username - backend will handle email generation
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account.");
        return;
      }
      invalidateAuth();
      setLocation("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
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
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 text-primary mb-4 box-glow overflow-hidden">
              {pending.avatarUrl ? (
                <img src={pending.avatarUrl} alt={pending.displayName} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <Cpu className="w-7 h-7" />
              )}
            </div>
            <h1 className="text-2xl font-display font-bold text-white mb-2">CREATE YOUR CALLSIGN</h1>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${providerStyle.border} ${providerStyle.bg} ${providerStyle.text}`}>
              <providerStyle.icon className="w-3.5 h-3.5" />
              Authenticated via {providerStyle.label}
            </div>
            <p className="text-muted-foreground text-sm mt-3">
              Welcome, <span className="text-white font-medium">{pending.displayName}</span>!
            </p>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <p className="text-muted-foreground text-xs mb-4">
              Choose your forum username. You can update it later from your account settings.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">
                  {error}
                </div>
              )}

              <div className="space-y-2">
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
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your unique callsign"
                    disabled={submitting}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground ml-1">3-30 characters. Can contain letters, numbers, and underscores.</p>
              </div>

              <Button 
                type="submit" 
                variant="glow" 
                className="w-full py-5 font-bold tracking-wide"
                disabled={submitting}
              >
                {submitting ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
              </Button>

              <div className="pt-2 text-center">
                <a href="/login" className="text-xs text-muted-foreground hover:text-white transition-colors flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3 h-3" />
                  Cancel and return to login
                </a>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

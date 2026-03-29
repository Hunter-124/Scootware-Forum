import React, { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Mail, Lock, User } from "lucide-react";

function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle: string }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <div className="w-full max-w-md relative">
        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full" />
        <div className="glass-panel rounded-3xl border border-white/10 shadow-2xl p-8 relative z-10 overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-accent" />
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 text-primary mb-4 box-glow">
              <Cpu className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">{title}</h1>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>
          
          {children}

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground tracking-widest">Or authenticate via</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <a href="/api/auth/sso/discord" className="flex items-center justify-center h-10 rounded-md border border-[#5865F2]/30 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] transition-colors"><i className="fab fa-discord font-bold">DISC</i></a>
              <a href="/api/auth/sso/google" className="flex items-center justify-center h-10 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"><i className="fab fa-google font-bold">GOOG</i></a>
              <a href="/api/auth/sso/steam" className="flex items-center justify-center h-10 rounded-md border border-[#171a21]/50 bg-[#171a21]/40 hover:bg-[#171a21]/60 text-white transition-colors"><i className="fab fa-steam font-bold">STM</i></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { invalidateAuth } = useAuth();
  const [errorMsg, setErrorMsg] = useState("");
  
  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        invalidateAuth();
        setLocation("/");
      },
      onError: (err) => {
        setErrorMsg((err as any)?.error || "Authentication failed.");
      }
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <AuthLayout title="SYSTEM LOGIN" subtitle="Enter credentials to access the grid.">
      <form onSubmit={onSubmit} className="space-y-4">
        {errorMsg && <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">{errorMsg}</div>}
        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Email Protocol</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input type="email" required className="pl-9 bg-black/40" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Security Key</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input type="password" required className="pl-9 bg-black/40" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        </div>
        <Button type="submit" variant="glow" className="w-full py-6 mt-4 font-bold text-lg tracking-wide" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? "VERIFYING..." : "INITIALIZE LOGIN"}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Unregistered operative? <Link href="/register" className="text-primary hover:underline font-medium">Create an account</Link>
      </div>
    </AuthLayout>
  );
}

export function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const [errorMsg, setErrorMsg] = useState("");
  
  const registerMutation = useRegister({
    mutation: {
      onSuccess: () => {
        // usually wait for email verification, but we can redirect to a "check email" page or home
        setLocation("/"); 
      },
      onError: (err) => {
        setErrorMsg((err as any)?.error || "Registration failed.");
      }
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    registerMutation.mutate({ data: { username, email, password } });
  };

  return (
    <AuthLayout title="BECOME AN OPERATIVE" subtitle="Register to access Scootware systems.">
      <form onSubmit={onSubmit} className="space-y-4">
        {errorMsg && <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">{errorMsg}</div>}
        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Callsign (Username)</label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input required minLength={3} maxLength={30} className="pl-9 bg-black/40" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Secure Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input type="email" required className="pl-9 bg-black/40" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Encryption Key (Pass)</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input type="password" required minLength={8} className="pl-9 bg-black/40" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
        </div>
        <Button type="submit" variant="glow" className="w-full py-6 mt-4 font-bold text-lg tracking-wide" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "PROCESSING..." : "REGISTER IDENTITY"}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already registered? <Link href="/login" className="text-primary hover:underline font-medium">Initialize Login</Link>
      </div>
    </AuthLayout>
  );
}

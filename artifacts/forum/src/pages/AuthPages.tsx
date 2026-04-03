import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useLogin, useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Mail, Lock, User } from "lucide-react";

function AuthLayout({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle: string }) {
  return (
    <div className="container mx-auto px-4 py-8 min-h-[80vh] flex items-center justify-center">
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
              <a 
                href="/api/auth/sso/discord" 
                className="flex items-center justify-center h-12 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 hover:bg-[#5865F2]/20 text-[#5865F2] transition-all duration-300 hover:shadow-[0_0_20px_rgba(88,101,242,0.3)] group"
                title="Discord SSO"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="group-hover:scale-110 transition-transform">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
              <a 
                href="/api/auth/sso/google" 
                className="flex items-center justify-center h-12 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] group"
                title="Google SSO"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" className="group-hover:scale-110 transition-transform">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
                </svg>
              </a>
              <a 
                href="/api/auth/sso/steam" 
                className="flex items-center justify-center h-12 rounded-xl border border-[#171a21]/50 bg-[#171a21]/40 hover:bg-[#171a21]/60 text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(23,26,33,0.5)] group"
                title="Steam SSO"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="group-hover:scale-110 transition-transform">
                  <path d="M12.002 0a12 12 0 0 0-11.97 10.957l6.536 2.701c.28-.152.593-.243.926-.263l2.836-4.085V9.22c0-1.892 1.543-3.435 3.435-3.435 1.892 0 3.435 1.543 3.435 3.435 0 1.893-1.543 3.436-3.435 3.436-.184 0-.361-.018-.535-.045l-4.041 2.853a2.022 2.022 0 0 1-.027.954l2.71 1.12c.15-.027.303-.046.46-.046 1.408 0 2.55 1.137 2.55 2.54 0 1.403-1.141 2.541-2.55 2.541-1.408 0-2.55-1.138-2.55-2.541 0-.12.012-.236.03-.351l-1.071-.444c-.754.739-1.801 1.205-2.956 1.205-2.31 0-4.183-1.873-4.183-4.183 0-.814.236-1.573.64-2.213L.044 11.233c.125 7.152 5.96 12.767 13.14 12.767 7.234 0 13.1-5.866 13.1-13.1C26.284 3.666 20.418 0 12.002 0zm1.782 11.594c.31.063.628.095.954.095 1.304 0 2.365-1.06 2.365-2.365s-1.06-2.364-2.365-2.364-2.365 1.06-2.365 2.364c0 .324.066.634.183.916l1.228-1.768a.17.17 0 0 1 .14-.075.176.176 0 0 1 .176.176c0 .034-.01.066-.027.094l-1.294 2.967zm-9.351 7.27a1.636 1.636 0 1 1-1.636 1.636 1.636 1.636 0 0 1 1.636-1.636z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { invalidateAuth } = useAuth();
  const [errorMsg, setErrorMsg] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleResend = async () => {
    // Only allow resend when identifier contains an email
    if (!identifier || !identifier.includes("@")) {
      setErrorMsg("Enter your email address above to resend the verification link.");
      return;
    }
    setResendStatus("sending");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier.toLowerCase() }),
      });
      setResendStatus(res.ok ? "sent" : "error");
    } catch {
      setResendStatus("error");
    }
  };
  
  const loginMutation = useLogin({
    mutation: {
      onSuccess: () => {
        invalidateAuth();
        setLocation("/");
      },
      onError: (err) => {
        const msg = (err as any)?.data?.error || "Authentication failed.";
        setErrorMsg(msg);
        setShowResend(msg.toLowerCase().includes("verify your email"));
      }
    }
  });

  // Read query params set by backend verification redirect and post-registration redirect
  const [verifiedMsg, setVerifiedMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    const reason = params.get("reason");
    const registered = params.get("registered");

    if (registered === "true") {
      setVerifiedMsg({ type: "success", text: "✅ Account created! Check your email inbox for a verification link before logging in." });
    } else if (verified === "success") {
      setVerifiedMsg({ type: "success", text: "✅ Email verified! You can now log in below." });
    } else if (verified === "error") {
      const reasonMap: Record<string, string> = {
        missing_token: "Verification link is missing a token.",
        invalid_token: "This verification link is invalid or has already been used. Try registering again.",
        server_error: "A server error occurred during verification. Please try again.",
      };
      setVerifiedMsg({ type: "error", text: `❌ ${reasonMap[reason || ""] || "Email verification failed."}` });
    }

    // Clean up query params from URL
    if (verified || registered) {
      const url = new URL(window.location.href);
      url.searchParams.delete("verified");
      url.searchParams.delete("reason");
      url.searchParams.delete("registered");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setShowResend(false);
    setResendStatus("idle");
    loginMutation.mutate({ data: { identifier, password } });
  };

  return (
    <AuthLayout title="SYSTEM LOGIN" subtitle="Enter credentials to access the grid.">
      <form onSubmit={onSubmit} className="space-y-4">
        {verifiedMsg && (
          <div className={`p-3 rounded-md border text-sm text-center ${
            verifiedMsg.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}>{verifiedMsg.text}</div>
        )}
        {errorMsg && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">
            {errorMsg}
            {showResend && (
              <div className="mt-2">
                {resendStatus === "sent" ? (
                  <span className="text-green-400">&#x2705; Verification email sent! Check your inbox.</span>
                ) : resendStatus === "error" ? (
                  <span className="text-yellow-400">&#x26A0;&#xFE0F; Failed to send. Please try again later.</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendStatus === "sending"}
                    className="underline text-primary hover:text-primary/80 transition-colors font-medium"
                  >
                    {resendStatus === "sending" ? "Sending..." : "Resend verification email"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Email or Username</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input type="text" required className="pl-9 bg-black/40" value={identifier} onChange={e => setIdentifier(e.target.value)} />
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
      <div className="mt-2 text-center text-sm text-muted-foreground">
        <Link href="/forgot-password" className="text-primary hover:underline font-medium">Forgot password?</Link>
      </div>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [, setLocation] = useLocation();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || "Request failed");
        setIsLoading(false);
        return;
      }

      setIsSubmitted(true);
    } catch (err) {
      setErrorMsg("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthLayout 
        title="CHECK YOUR EMAIL" 
        subtitle="Follow the link to reset your password"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-center text-sm">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
          </div>
          
          <div className="space-y-3 text-sm text-muted-foreground">
            <h3 className="font-semibold text-white">What's next:</h3>
            <ol className="space-y-2 list-decimal list-inside">
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the reset link in the email</li>
              <li>Enter your new password</li>
              <li>Login with your new credentials</li>
            </ol>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-xs text-yellow-400">
              💡 The reset link expires in 1 hour for security
            </p>
          </div>

          <Button 
            onClick={() => setLocation("/login")} 
            variant="outline" 
            className="w-full"
          >
            Back to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="RESET PASSWORD" 
      subtitle="Enter your email to reset your password"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">
            {errorMsg}
          </div>
        )}
        
        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              type="email" 
              required 
              className="pl-9 bg-black/40" 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            We'll send you a secure link to reset your password
          </p>
        </div>

        <Button 
          type="submit" 
          variant="glow" 
          className="w-full py-6 mt-4 font-bold text-lg tracking-wide" 
          disabled={isLoading}
        >
          {isLoading ? "SENDING..." : "SEND RESET LINK"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Remember your password? <Link href="/login" className="text-primary hover:underline font-medium">Back to login</Link>
      </div>
    </AuthLayout>
  );
}

export function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isValidating, setIsValidating] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    
    if (!urlToken) {
      setErrorMsg("No reset token provided. Please click the link in your email.");
      setIsValidating(false);
      return;
    }

    setToken(urlToken);

    // Validate token
    (async () => {
      try {
        const res = await fetch("/api/auth/validate-reset-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: urlToken }),
        });

        if (!res.ok) {
          const data = await res.json();
          setErrorMsg(data.error || "Invalid or expired reset link");
        } else {
          const data = await res.json();
          if (data.valid) {
            setErrorMsg("");
          }
        }
      } catch (err) {
        setErrorMsg("Failed to validate reset link");
      } finally {
        setIsValidating(false);
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || "Reset failed");
        setIsLoading(false);
        return;
      }

      setSuccessMsg("✅ Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    } catch (err) {
      setErrorMsg("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <AuthLayout 
        title="RESET PASSWORD" 
        subtitle="Validating your reset link..."
      >
        <div className="text-center py-8">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
          <p className="mt-4 text-muted-foreground">Verifying your identity...</p>
        </div>
      </AuthLayout>
    );
  }

  if (errorMsg && errorMsg.includes("Invalid") || errorMsg.includes("expired")) {
    return (
      <AuthLayout 
        title="RESET LINK EXPIRED" 
        subtitle="Your reset link is no longer valid"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <p className="text-center text-sm text-destructive">
              {errorMsg}
            </p>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <p className="font-semibold text-white">Reset links expire after 1 hour for security.</p>
            <p>Request a new password reset link:</p>
          </div>

          <Button 
            onClick={() => setLocation("/forgot-password")} 
            variant="glow" 
            className="w-full"
          >
            Request New Reset Link
          </Button>

          <Button 
            onClick={() => setLocation("/login")} 
            variant="outline" 
            className="w-full"
          >
            Back to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="SET NEW PASSWORD" 
      subtitle="Create a new password to secure your account"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center">
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div className="p-3 rounded-md bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center">
            {successMsg}
          </div>
        )}

        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <p className="text-xs text-green-400">
            ✅ Your email has been verified. Set your new password below.
          </p>
        </div>

        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              type="password" 
              required 
              minLength={8}
              className="pl-9 bg-black/40" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
        </div>

        <div className="space-y-1 text-left">
          <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input 
              type="password" 
              required 
              minLength={8}
              className="pl-9 bg-black/40" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
            />
          </div>
        </div>

        <Button 
          type="submit" 
          variant="glow" 
          className="w-full py-6 mt-4 font-bold text-lg tracking-wide" 
          disabled={isLoading}
        >
          {isLoading ? "RESETTING..." : "RESET PASSWORD"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline font-medium">Back to login</Link>
      </div>
    </AuthLayout>
  );
}

export function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [siteConfig, setSiteConfig] = useState<any>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [inviteRequestReason, setInviteRequestReason] = useState("");
  const [inviteRequestStatus, setInviteRequestStatus] = useState<string>("");
  const [, setLocation] = useLocation();
  const [errorMsg, setErrorMsg] = useState("");
  
  useEffect(() => {
    fetch('/api/auth/site-config').then(res => res.json()).then(setSiteConfig).catch(() => setSiteConfig({ inviteOnlyMode: false }));
  }, []);

  const inviteOnly = siteConfig?.inviteOnlyMode === true;

  const registerMutation = useRegister({
    mutation: {
      onSuccess: () => {
        // Redirect to login with a flag to show "check your email" banner
        setLocation("/login?registered=true");
      },
      onError: (err) => {
        setErrorMsg((err as any)?.data?.error || "Registration failed.");
      }
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (inviteOnly && !inviteCode.trim()) {
      setErrorMsg("Invite code is required while invite-only mode is enabled.");
      return;
    }

    const body: any = { username, email, password };
    if (inviteCode.trim()) body.inviteCode = inviteCode.trim();

    registerMutation.mutate({ data: body });
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

        {inviteOnly ? (
          <div className="space-y-1 text-left">
            <label className="text-xs uppercase text-muted-foreground font-bold tracking-wider ml-1">Invite Code</label>
            <Input value={inviteCode} onChange={e => setInviteCode(e.target.value)} className="bg-black/40" placeholder="Enter your invite code" />
            <p className="text-xs text-muted-foreground">Invite-only mode is active. If you don't have a code, request one below.</p>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Open registration is active. Invite code optional.</div>
        )}

        <Button type="submit" variant="glow" className="w-full py-6 mt-4 font-bold text-lg tracking-wide" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "PROCESSING..." : "REGISTER IDENTITY"}
        </Button>

        <div className="mt-4 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setShowRequestForm(!showRequestForm)}
            className="text-sm text-primary hover:text-primary/80 underline"
          >
            {showRequestForm ? "Hide" : "Request"} an invite
          </button>
          {showRequestForm && (
            <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 space-y-2">
              <div className="text-xs text-muted-foreground">Invite request mode: {siteConfig?.inviteRequestMode === 'auto' ? 'Automatic with cooldown' : 'Admin approval required'}</div>
              <textarea
                value={inviteRequestReason}
                onChange={e => setInviteRequestReason(e.target.value)}
                placeholder="Why do you want access?"
                className="w-full p-2 text-sm rounded-md bg-black/40 border border-white/10"
              />
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  setInviteRequestStatus('Sending...');
                  try {
                    const payload = { email, username, reason: inviteRequestReason };
                    const resp = await fetch('/api/auth/request-invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data.error || 'Failed');
                    setInviteRequestStatus(data.inviteCode ? `Invite code granted: ${data.inviteCode}` : 'Request submitted, awaiting approval.');
                  } catch (err) {
                    setInviteRequestStatus((err as any).message || 'Invite request failed.');
                  }
                }}
                className="mt-1 w-full"
              >
                {siteConfig?.inviteRequestMode === 'auto' ? 'Request or get instant invite' : 'Request invite (admin approval)'}
              </Button>
              {inviteRequestStatus && <div className="text-xs text-muted-foreground mt-1">{inviteRequestStatus}</div>}
            </div>
          )}
        </div>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already registered? <Link href="/login" className="text-primary hover:underline font-medium">Initialize Login</Link>
      </div>
    </AuthLayout>
  );
}

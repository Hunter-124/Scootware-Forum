import React, { useState, useEffect } from "react";
import { useGetMe, useGetMyInvites, useRequestInviteAuthenticated, useGetSiteConfig } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Shield, Unlink, Link2, Chrome, MessageCircle, Inbox, Check, X, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LinkedProvider {
  provider: "google" | "discord" | "steam";
  linked: boolean;
}

interface DialogState {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

interface PasswordChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface UsernameChangeForm {
  newUsername: string;
  currentPassword: string;
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
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
  </svg>
);

const providerInfo = {
  google: {
    name: "Google",
    icon: GoogleIcon,
    color: "bg-white/5 border-white/10 text-white",
    hoverColor: "hover:bg-white/10",
  },
  discord: {
    name: "Discord",
    icon: DiscordIcon,
    color: "bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2]",
    hoverColor: "hover:bg-[#5865F2]/20",
  },
  steam: {
    name: "Steam",
    icon: SteamIcon,
    color: "bg-[#171a21]/40 text-white border-[#171a21]/50",
    hoverColor: "hover:bg-[#171a21]/60",
  },
};

export default function AccountSettings() {
  const { user: currentUser } = useAuth();
  const { data: meData } = useGetMe({ query: { enabled: !!currentUser } as any });
  const { data: siteConfig } = useGetSiteConfig();
  const { data: invitesData, isLoading: invitesLoading } = useGetMyInvites({ query: { enabled: !!currentUser } as any });
  const [providers, setProviders] = useState<LinkedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inviteReason, setInviteReason] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  
  // Password change dialog state
  const [passwordDialog, setPasswordDialog] = useState<DialogState>({ isOpen: false, isLoading: false, error: null });
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  
  // Username change dialog state
  const [usernameDialog, setUsernameDialog] = useState<DialogState>({ isOpen: false, isLoading: false, error: null });
  const [usernameForm, setUsernameForm] = useState<UsernameChangeForm>({ newUsername: "", currentPassword: "" });

  const requestInviteMutation = useRequestInviteAuthenticated({
    mutation: {
      onSuccess: () => {
        setInviteReason("");
        setShowRequestForm(false);
        setSuccessMessage("Invite request submitted successfully!");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    }
  });

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await fetch("/api/auth/user/linked-providers", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers);
        }
      } catch (error) {
        console.error("Failed to load linked providers:", error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      loadProviders();
    }
  }, [currentUser]);

  useEffect(() => {
    // Check URL params for success message (e.g., from Steam callback)
    const params = new URLSearchParams(window.location.search);
    if (params.get("linked")) {
      setSuccessMessage(`Successfully linked ${params.get("linked")}!`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLinkProvider = (provider: "google" | "discord" | "steam") => {
    setLinking(provider);
    window.location.href = `/api/auth/user/link-sso/${provider}`;
  };

  const handleUnlinkProvider = async (provider: "google" | "discord" | "steam") => {
    try {
      const response = await fetch(`/api/auth/user/unlink-sso/${provider}`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        setProviders(providers.map(p => 
          p.provider === provider ? { ...p, linked: false } : p
        ));
        setSuccessMessage(`Successfully unlinked ${provider}!`);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        alert(data.error || "Failed to unlink provider");
      }
    } catch (error) {
      console.error("Failed to unlink provider:", error);
      alert("Failed to unlink provider");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordDialog(prev => ({ ...prev, error: "All fields are required" }));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordDialog(prev => ({ ...prev, error: "New passwords do not match" }));
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordDialog(prev => ({ ...prev, error: "Password must be at least 8 characters" }));
      return;
    }

    setPasswordDialog(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordDialog(prev => ({ ...prev, error: data.error || "Failed to change password" }));
        return;
      }

      setSuccessMessage("Password changed successfully!");
      setPasswordDialog({ isOpen: false, isLoading: false, error: null });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Password change error:", error);
      setPasswordDialog(prev => ({ ...prev, error: "An error occurred. Please try again." }));
    } finally {
      setPasswordDialog(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!usernameForm.newUsername || !usernameForm.currentPassword) {
      setUsernameDialog(prev => ({ ...prev, error: "All fields are required" }));
      return;
    }

    if (usernameForm.newUsername.length < 3 || usernameForm.newUsername.length > 30) {
      setUsernameDialog(prev => ({ ...prev, error: "Username must be 3-30 characters" }));
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(usernameForm.newUsername)) {
      setUsernameDialog(prev => ({ ...prev, error: "Username can only contain letters, numbers, and underscores" }));
      return;
    }

    setUsernameDialog(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/users/${currentUser?.id}/username`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newUsername: usernameForm.newUsername,
          currentPassword: usernameForm.currentPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if user needs to set password first (SSO-only accounts)
        if (response.status === 403 && data.requiresPassword) {
          setUsernameDialog(prev => ({ 
            ...prev, 
            error: "You must set a password before changing your username. Please go to the Password Settings section above." 
          }));
        } else {
          setUsernameDialog(prev => ({ ...prev, error: data.error || "Failed to change username" }));
        }
        return;
      }

      setSuccessMessage("Username changed successfully!");
      setUsernameDialog({ isOpen: false, isLoading: false, error: null });
      setUsernameForm({ newUsername: "", currentPassword: "" });
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refresh user data
      window.location.reload();
    } catch (error) {
      console.error("Username change error:", error);
      setUsernameDialog(prev => ({ ...prev, error: "An error occurred. Please try again." }));
    } finally {
      setUsernameDialog(prev => ({ ...prev, isLoading: false }));
    }
  };

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-destructive">Please log in to view account settings.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account and connected SSO providers</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
          ✅ {successMessage}
        </div>
      )}

      {/* Account Email Section */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-white">Account Email</h2>
        </div>
        <p className="text-gray-300 font-mono">{currentUser.email}</p>
        <p className="text-muted-foreground text-sm mt-2">
          {currentUser.isEmailVerified ? "✅ Email verified" : "⚠️ Email not verified"}
        </p>
      </div>

      {/* Password Settings Section */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-white">Password Settings</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-4">
          Change or update your password to keep your account secure.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPasswordDialog({ ...passwordDialog, isOpen: true })}
          className="border-primary/50 text-primary hover:bg-primary/10"
        >
          <Lock className="w-4 h-4 mr-2" />
          Change Password
        </Button>

        {/* Password Change Dialog */}
        {passwordDialog.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-black border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Change Password</h3>
              
              {passwordDialog.error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {passwordDialog.error}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    placeholder="Enter your current password"
                    disabled={passwordDialog.isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    placeholder="Enter your new password (min 8 characters)"
                    disabled={passwordDialog.isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    placeholder="Confirm your new password"
                    disabled={passwordDialog.isLoading}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPasswordDialog({ isOpen: false, isLoading: false, error: null });
                      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                    }}
                    disabled={passwordDialog.isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="glow"
                    size="sm"
                    disabled={passwordDialog.isLoading}
                  >
                    {passwordDialog.isLoading ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Username Settings Section */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-white">Username Settings</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-2">Current username: <span className="text-white font-mono">{currentUser.username}</span></p>
        <p className="text-muted-foreground text-sm mb-4">
          Change your forum username. This will be visible to other users.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setUsernameDialog({ ...usernameDialog, isOpen: true })}
          className="border-primary/50 text-primary hover:bg-primary/10"
        >
          <User className="w-4 h-4 mr-2" />
          Change Username
        </Button>

        {/* Username Change Dialog */}
        {usernameDialog.isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-black border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Change Username</h3>
              
              {usernameDialog.error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {usernameDialog.error}
                </div>
              )}

              <form onSubmit={handleChangeUsername} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Current Password</label>
                  <input
                    type="password"
                    value={usernameForm.currentPassword}
                    onChange={(e) => setUsernameForm({ ...usernameForm, currentPassword: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    placeholder="Enter your password"
                    disabled={usernameDialog.isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">New Username</label>
                  <input
                    type="text"
                    value={usernameForm.newUsername}
                    onChange={(e) => setUsernameForm({ ...usernameForm, newUsername: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                    placeholder="Enter your new username"
                    disabled={usernameDialog.isLoading}
                    maxLength={30}
                  />
                  <p className="text-xs text-muted-foreground mt-1">3-30 alphanumeric characters and underscores</p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUsernameDialog({ isOpen: false, isLoading: false, error: null });
                      setUsernameForm({ newUsername: "", currentPassword: "" });
                    }}
                    disabled={usernameDialog.isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="glow"
                    size="sm"
                    disabled={usernameDialog.isLoading}
                  >
                    {usernameDialog.isLoading ? "Changing..." : "Change Username"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* SSO Providers Section */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-white">Connected Accounts</h2>
        </div>

        <p className="text-muted-foreground text-sm mb-6">
          Link your Scootware account with your social accounts for easier login.
          If your email matches a social account, they'll automatically link!
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => {
              const info = providerInfo[provider.provider];
              const Icon = info.icon;

              return (
                <div
                  key={provider.provider}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${info.color} ${info.hoverColor}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <div>
                      <div className="font-bold text-white">{info.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {provider.linked ? "Connected" : "Not connected"}
                      </div>
                    </div>
                  </div>

                  {provider.linked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnlinkProvider(provider.provider)}
                      className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Unlink
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLinkProvider(provider.provider)}
                      disabled={linking === provider.provider}
                      className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      {linking === provider.provider ? "Linking..." : "Link"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300">
            💡 <strong>Tip:</strong> When you have multiple providers linked, you can sign in with any of them.
            If your account email matches a social account email, they will automatically link on first use.
          </p>
        </div>
      </div>

      {/* Invites Section (Only visible when invite-only mode is enabled) */}
      {siteConfig?.registrationMode === "invite-only" && (
        <div className="glass-panel p-6 rounded-2xl border border-primary/30 bg-primary/5 mt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Inbox className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-white">Invitations</h2>
            </div>
            {!showRequestForm && (
              <Button
                variant="outline"
                size="sm"
                className="border-primary/50 text-primary hover:bg-primary/10"
                onClick={() => setShowRequestForm(true)}
              >
                Request Invite
              </Button>
            )}
          </div>

          {/* Request Invite Form */}
          {showRequestForm && (
            <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  requestInviteMutation.mutate({ data: { reason: inviteReason || undefined } });
                }}
                className="space-y-3"
              >
                <textarea
                  className="w-full bg-black/40 rounded-lg p-3 text-sm text-white placeholder:text-muted-foreground border border-white/5 focus:border-primary/50 focus:outline-none resize-none"
                  placeholder="Optional: Tell us why you're requesting an invite..."
                  rows={3}
                  value={inviteReason}
                  onChange={(e) => setInviteReason(e.target.value)}
                  maxLength={1000}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRequestForm(false)}
                    disabled={requestInviteMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="glow"
                    size="sm"
                    disabled={requestInviteMutation.isPending}
                  >
                    {requestInviteMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Invites List */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider">Your Issued Invites</h3>
            {invitesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading invites...</div>
            ) : !invitesData?.invites || invitesData.invites.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground italic">
                You haven't issued any invites yet. {siteConfig?.registrationMode === "invite-only" ? "Request one above!" : ""}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase text-xs tracking-wider">Code</th>
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase text-xs tracking-wider">Status</th>
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase text-xs tracking-wider">Used By</th>
                      <th className="text-left px-4 py-2 font-bold text-muted-foreground uppercase text-xs tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitesData.invites.map((invite) => (
                      <tr key={invite.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <code className="bg-black/40 px-2 py-1 rounded text-xs font-mono text-primary">
                            {invite.code}
                          </code>
                        </td>
                        <td className="px-4 py-3">
                          {invite.isBanned ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive uppercase">
                              <X className="w-3 h-3" /> Banned
                            </span>
                          ) : invite.isUsed ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-500 uppercase">
                              <Check className="w-3 h-3" /> Used
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 uppercase">
                              ● Unused
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {invite.usedByUsername ? (
                            <span className="text-white">{invite.usedByUsername}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(invite.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
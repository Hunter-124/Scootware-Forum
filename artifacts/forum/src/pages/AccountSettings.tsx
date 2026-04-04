import React, { useState, useEffect } from "react";
import { useGetMe, useGetMyInvites, useRequestInviteAuthenticated, useGetSiteConfig } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Mail, Shield, Unlink, Link2, Chrome, MessageCircle, Flame, Inbox, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LinkedProvider {
  provider: "google" | "discord" | "steam";
  linked: boolean;
}

const providerInfo = {
  google: {
    name: "Google",
    icon: Chrome,
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    hoverColor: "hover:bg-blue-500/30",
  },
  discord: {
    name: "Discord",
    icon: MessageCircle,
    color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    hoverColor: "hover:bg-indigo-500/30",
  },
  steam: {
    name: "Steam",
    icon: Flame,
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    hoverColor: "hover:bg-orange-500/30",
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
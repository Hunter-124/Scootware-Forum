import React, { useState } from "react";
import { useAdminGetUsers, useAdminGetConfig, useAdminUpdateConfig, type SiteConfigInviteRequestMode } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Shield, Settings, Users, Search, Save, AlertCircle, Plus, Trash2, Slash, Unlock, ChevronDown, X, Download, Mail, Chrome, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, getRoleColor, formatDate, formatUpgradeDisplay } from "@/lib/utils";
import { RoleStatusBadge } from "@/components/RoleStatusBadge";
import { toast } from "sonner";

const PRODUCTS = ["BODYCAM", "RUST", "DAYZ", "TARKOV", "CS2", "SPOOFER"] as const;
const TIERS = ["premium", "lifetime"] as const;

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

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'config' | 'logins' | 'invites' | 'loaders' | 'product-assets' | 'rate-limits' | 'email-settings'>('users');
  const [search, setSearch] = useState("");
  
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <Shield className="w-20 h-20 text-destructive mb-6 opacity-80" />
        <h1 className="text-4xl font-display font-bold text-white mb-2 text-glow-destructive">ACCESS DENIED</h1>
        <p className="text-muted-foreground">Admin clearance required for this sector.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        <div className="flex items-center gap-4 border-b border-white/10 pb-6">
          <div className="p-3 bg-amber-500/20 rounded-xl text-amber-500 border border-amber-500/30 box-glow">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white">System Administration</h1>
            <p className="text-amber-500/80 text-sm tracking-widest uppercase mt-1">Level 5 Clearance Active</p>
          </div>
        </div>

        <div className="flex gap-4">
          <Button 
            variant={activeTab === 'users' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('users')}
            className="gap-2"
          >
            <Users className="w-4 h-4" /> Operative Directory
          </Button>
          <Button 
            variant={activeTab === 'config' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('config')}
            className="gap-2"
          >
            <Settings className="w-4 h-4" /> Core Configuration
          </Button>
          <Button 
            variant={activeTab === 'logins' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('logins')}
            className="gap-2"
          >
            <Shield className="w-4 h-4" /> Login Events
          </Button>
          <Button 
            variant={activeTab === 'invites' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('invites')}
            className="gap-2"
          >
            <Users className="w-4 h-4" /> Invitations
          </Button>
          <Button 
            variant={activeTab === 'loaders' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('loaders')}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Loader Version
          </Button>
          <Button 
            variant={activeTab === 'product-assets' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('product-assets')}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Product Assets
          </Button>
          <Button 
            variant={activeTab === 'rate-limits' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('rate-limits')}
            className="gap-2"
          >
            <Shield className="w-4 h-4" /> Rate Limits
          </Button>
          <Button 
            variant={activeTab === 'email-settings' ? 'glow' : 'outline'} 
            onClick={() => setActiveTab('email-settings')}
            className="gap-2"
          >
            <Mail className="w-4 h-4" /> Email Templates
          </Button>
        </div>

        {activeTab === 'users' && <UserManagementTab search={search} setSearch={setSearch} />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'logins' && <LoginEventsTab />}
        {activeTab === 'invites' && <InvitesTab />}
        {activeTab === 'loaders' && <LoadersTab />}
        {activeTab === 'product-assets' && <ProductAssetsTab />}
        {activeTab === 'rate-limits' && <RateLimitingTab />}
        {activeTab === 'email-settings' && <EmailSettingsTab />}
      </div>
    </div>
  );
}

function LoginEventsTab() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/login-events?page=1`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { fetchEvents(); }, []);

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-white/5 bg-black/40">
        <h2 className="font-bold text-lg">Login Events</h2>
        <p className="text-sm text-muted-foreground">Recent user and guest login IPs</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase bg-white/[0.02] text-muted-foreground border-b border-white/5">
            <tr>
              <th className="px-6 py-4">When</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">IP</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No login events yet.</td></tr>
            ) : (
              events.map((e: any) => (
                <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 text-muted-foreground text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4">{e.username || (e.userId ? `#${e.userId}` : 'Guest')}</td>
                  <td className="px-6 py-4 text-xs">{e.ip}</td>
                  <td className="px-6 py-4 text-xs">{e.eventType}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{e.userAgent ?? ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserManagementTab({ search, setSearch }: { search: string, setSearch: (s:string)=>void }) {
  const { data, isLoading, refetch } = useAdminGetUsers({ page: 1, search });
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [banningId, setBanningId] = useState<number | null>(null);
  const [togglingRoleId, setTogglingRoleId] = useState<number | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalUserId, setRoleModalUserId] = useState<number | null>(null);
  const [roleModalCurrentRole, setRoleModalCurrentRole] = useState<string>("user");
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalUserId, setSubModalUserId] = useState<number | null>(null);
  const [subModalActiveProducts, setSubModalActiveProducts] = useState<any[]>([]);

  const handleVerifyEmail = async (userId: number) => {
    setVerifyingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/verify-email`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        toast.error("Failed to verify email");
        return;
      }
      toast.success("Email verified successfully");
      refetch();
    } catch (err) {
      console.error(err);
      toast.error("Failed to verify email");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleBanToggle = async (userId: number, isBanned: boolean) => {
    setBanningId(userId);
    try {
      if (isBanned) {
        const res = await fetch(`/api/admin/users/${userId}/unban`, { method: "POST", credentials: "include" });
        if (!res.ok) throw new Error("Unban failed");
        toast.success("User unbanned");
      } else {
        const reason = window.prompt("Enter ban reason:", "Violated site rules.");
        if (!reason) {
          setBanningId(null);
          return;
        }
        const res = await fetch(`/api/admin/users/${userId}/ban`, { 
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
          credentials: "include" 
        });
        if (!res.ok) throw new Error("Ban failed");
        toast.success("User banned successfully");
      }
      refetch();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${isBanned ? "unban" : "ban"} user`);
    } finally {
      setBanningId(null);
    }
  };

  const handleUpdateRole = async (userId: number, role: string) => {
    setTogglingRoleId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to update role");
      toast.success(`User role updated to ${role}`);
      refetch();
      setRoleModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update user role`);
    } finally {
      setTogglingRoleId(null);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm("WARNING: This will permanently delete the user and all of their posts, threads, and payments. Proceed?")) return;
    
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/delete`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed with status ${res.status}`);
      }
      toast.success("User deleted successfully");
      refetch();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to delete user";
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateSubscription = (userId: number, activeProducts: any[] = []) => {
    setSubModalUserId(userId);
    setSubModalActiveProducts(activeProducts);
    setSubModalOpen(true);
  };

  const handleOpenRoleModal = (userId: number, currentRole: string) => {
    setRoleModalUserId(userId);
    setRoleModalCurrentRole(currentRole);
    setRoleModalOpen(true);
  };

  const handleSubscriptionConfirm = async (
    productIds: string[] | null, 
    tier: string | null,
    action: 'replace' | 'extend' = 'replace',
    extendDays: number = 0,
    reason: string = ""
  ) => {
    if (!subModalUserId) return;

    try {
      if (action === 'extend') {
        // Use new dedicated extension endpoint
        const body = {
          productIds: productIds || [],
          extensionDays: extendDays,
          reason: reason || undefined
        };
        
        const res = await fetch(`/api/admin/users/${subModalUserId}/extend-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include"
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || "Extension failed");
        }
        toast.success(`Extended ${productIds?.length || 0} subscription(s) successfully`);
      } else {
        // Replace subscriptions using PATCH
        const body: any = { 
          tier: tier || "premium",
          productIds: productIds || []
        };
        
        const res = await fetch(`/api/admin/users/${subModalUserId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include"
        });
        if (!res.ok) throw new Error("Update failed");
        toast.success("Subscription updated successfully");
      }
      refetch();
      setSubModalOpen(false);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to update subscription";
      toast.error(message);
    }
  };

  return (
    <>
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 bg-black/40 flex justify-between items-center">
          <h2 className="font-bold text-lg">Directory</h2>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search callsign or email..." 
              className="pl-9 h-9 bg-black/60 border-white/10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-white/[0.02] text-muted-foreground border-b border-white/5">
              <tr>
              <th className="px-6 py-4">Operative</th>
              <th className="px-6 py-4">Classification</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Scanning database...</td></tr>
            ) : data?.users.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No matches found in directory.</td></tr>
            ) : (
              data?.users.map(user => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden">
                        {user.avatarUrl && <img src={user.avatarUrl} className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <div className="font-bold text-white">{user.username}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.role === "admin" || user.role === "mod" ? (
                      <RoleStatusBadge role={user.role} compact />
                    ) : user.activeProducts && user.activeProducts.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.activeProducts.map((ap: any) => (
                          <span 
                            key={ap.productId} 
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border inline-block",
                              ap.tier === "lifetime"
                                ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                                : "bg-primary/20 border-primary/50 text-primary"
                            )}
                            title={`${ap.tier} - expires ${new Date(ap.expiresAt).toLocaleDateString()}`}
                          >
                            {formatUpgradeDisplay(ap.productId)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <RoleStatusBadge role="user" compact />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        {user.isBanned 
                          ? <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Banned</span> 
                          : <span className="text-xs text-green-500">Active</span>}
                        {!user.isEmailVerified && (
                          <span className="text-xs text-yellow-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Unverified</span>
                        )}
                      </div>
                      {/* SSO Providers */}
                      {(user.googleId || user.discordId || user.steamId) && (
                        <div className="flex gap-2 mt-2">
                          {user.googleId && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-white" title="Google linked">
                              <GoogleIcon className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {user.discordId && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#5865F2]/10 border border-[#5865F2]/30 rounded text-[#5865F2]" title="Discord linked">
                              <DiscordIcon className="w-3.5 h-3.5" />
                            </div>
                          )}
                          {user.steamId && (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#171a21]/40 border border-[#171a21]/50 rounded text-white" title="Steam linked">
                              <SteamIcon className="w-3.5 h-3.5 text-[#66c0f4]" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-xs">
                      {!user.isEmailVerified && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 h-7 px-2"
                          disabled={verifyingId === user.id}
                          onClick={() => handleVerifyEmail(user.id)}
                        >
                          {verifyingId === user.id ? "..." : "Verify"}
                        </Button>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 px-2"
                        onClick={() => handleUpdateSubscription(user.id, user.activeProducts || [])}
                      >
                        Sub
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn("h-7 px-2", user.isBanned ? "text-green-500 hover:bg-green-500/10" : "text-amber-500 hover:bg-amber-500/10")}
                        disabled={banningId === user.id}
                        onClick={() => handleBanToggle(user.id, user.isBanned)}
                      >
                        {banningId === user.id ? "..." : (user.isBanned ? "Unban" : "Ban")}
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn("h-7 px-2", user.role === "admin" ? "text-amber-500 hover:bg-amber-500/10" : user.role === "mod" ? "text-indigo-400 hover:bg-indigo-500/10" : "text-zinc-400 hover:bg-zinc-400/10")}
                        disabled={togglingRoleId === user.id}
                        onClick={() => handleOpenRoleModal(user.id, user.role)}
                      >
                        {togglingRoleId === user.id ? "..." : "Role"}
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10 h-7 px-2"
                        disabled={deletingId === user.id}
                        onClick={() => handleDelete(user.id)}
                      >
                        {deletingId === user.id ? "..." : ("Delete")}
                      </Button>

                      <Link href={`/profile/${user.id}`}>
                        <Button variant="ghost" size="sm" className="text-primary hover:text-primary-foreground hover:bg-primary/20 h-7 px-2">
                          Inspect
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

    {subModalOpen && (
      <SubscriptionModal
        activeProducts={subModalActiveProducts}
        onConfirm={handleSubscriptionConfirm}
        onClose={() => setSubModalOpen(false)}
      />
    )}

    {roleModalOpen && (
      <RoleSelectionModal
        currentRole={roleModalCurrentRole}
        onConfirm={(role) => handleUpdateRole(roleModalUserId!, role)}
        onClose={() => setRoleModalOpen(false)}
      />
    )}
    </>
  );
}

function ConfigTab() {
  const { data: config, isLoading } = useAdminGetConfig();
  const updateConfig = useAdminUpdateConfig();
  const [formData, setFormData] = useState(config);

  // Update local state when query data loads
  React.useEffect(() => { if (config) setFormData(config); }, [config]);

  if (isLoading || !formData) return <div className="h-64 animate-pulse bg-white/5 rounded-2xl" />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig.mutate({ data: formData }, {
      onSuccess: () => alert("Configuration saved securely.")
    });
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl max-w-3xl">
      <div className="space-y-6">
        <div>
          <label className="text-sm font-bold text-white uppercase tracking-wider mb-2 block">System Designation (Site Name)</label>
          <Input 
            value={formData.siteName} 
            onChange={e => setFormData({...formData, siteName: e.target.value})} 
            className="bg-black/40 border-white/10" 
          />
        </div>
        <div>
          <label className="text-sm font-bold text-white uppercase tracking-wider mb-2 block">System Directive (Description)</label>
          <textarea 
            value={formData.siteDescription} 
            onChange={e => setFormData({...formData, siteDescription: e.target.value})} 
            className="w-full bg-black/40 rounded-lg p-3 text-sm text-white border border-white/10 focus:border-primary/50" 
            rows={3} 
          />
        </div>
        
        <div className="pt-6 border-t border-white/10">
          <label className="text-sm font-bold text-white uppercase tracking-wider mb-4 block">Registration Mode</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className={cn("flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors", formData.registrationMode === "open" ? "border-primary bg-primary/10" : "border-white/5 hover:bg-white/[0.02]")}>
              <input 
                type="radio" 
                name="registrationMode"
                value="open"
                checked={formData.registrationMode === "open"}
                onChange={e => setFormData({...formData, registrationMode: e.target.value as any})}
                className="w-5 h-5 text-primary focus:ring-primary/50"
              />
              <div>
                <div className="font-bold text-white">Open Registration</div>
                <div className="text-xs text-muted-foreground">Allow public registration</div>
              </div>
            </label>

            <label className={cn("flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors", formData.registrationMode === "invite-only" ? "border-primary bg-primary/10" : "border-white/5 hover:bg-white/[0.02]")}>
              <input 
                type="radio" 
                name="registrationMode"
                value="invite-only"
                checked={formData.registrationMode === "invite-only"}
                onChange={e => setFormData({...formData, registrationMode: e.target.value as any})}
                className="w-5 h-5 text-primary focus:ring-primary/50"
              />
              <div>
                <div className="font-bold text-white">Invite Only</div>
                <div className="text-xs text-muted-foreground">Require invite code</div>
              </div>
            </label>

            <label className={cn("flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors", formData.registrationMode === "closed" ? "border-destructive bg-destructive/10" : "border-white/5 hover:bg-white/[0.02]")}>
              <input 
                type="radio" 
                name="registrationMode"
                value="closed"
                checked={formData.registrationMode === "closed"}
                onChange={e => setFormData({...formData, registrationMode: e.target.value as any})}
                className="w-5 h-5 text-destructive"
              />
              <div>
                <div className="font-bold text-white">Closed</div>
                <div className="text-xs text-muted-foreground">Disable registration</div>
              </div>
            </label>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10">
          <label className="flex items-center gap-3 p-4 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              checked={formData.maintenanceMode}
              onChange={e => setFormData({...formData, maintenanceMode: e.target.checked})}
              className="w-5 h-5 rounded border-destructive/50 text-destructive focus:ring-destructive/50 bg-black/40"
            />
            <div>
              <div className="font-bold text-destructive">Lockdown Mode</div>
              <div className="text-xs text-destructive/70">Restrict access to Admins only</div>
            </div>
          </label>

          <div className="p-4 rounded-xl border border-white/5 bg-black/40">
            <label className="block text-sm font-semibold text-white mb-2">Invite Request Workflow</label>
            <select
              value={formData.inviteRequestMode || 'admin'}
              onChange={e => setFormData({...formData, inviteRequestMode: e.target.value as SiteConfigInviteRequestMode})}
              className="w-full bg-black/50 border border-white/10 rounded-md p-2 text-sm"
            >
              <option value="admin">Admin approval required</option>
              <option value="auto">Auto grant (with cooldown)</option>
            </select>
            <div className="text-xs text-muted-foreground mt-2">Set your invite request policy.</div>
          </div>

          <div className="p-4 rounded-xl border border-white/5 bg-black/40">
            <label className="block text-sm font-semibold text-white mb-2">Invite Request Cooldown (days)</label>
            <Input type="number" min={0} value={formData.inviteRequestCooldownDays ?? 7} onChange={e => setFormData({...formData, inviteRequestCooldownDays: Number(e.target.value)})} className="bg-black/40" />
            <div className="text-xs text-muted-foreground mt-2">Prevent abuse by limiting request frequency.</div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/10">
          <h3 className="text-sm font-bold text-white mb-3">Products Pricing</h3>
          <p className="text-xs text-muted-foreground mb-4">Adjust base price and bulk pricing per product. Leave bulk fields empty to keep default behavior.</p>
          <div className="grid grid-cols-1 gap-4">
            {/* Fetch available products from server and render inputs */}
            <ProductsPricingEditor formData={formData} setFormData={setFormData} />
          </div>
        </div>

        <div className="pt-6 text-right">
          <Button type="submit" variant="glow" disabled={updateConfig.isPending} className="gap-2">
            <Save className="w-4 h-4" /> COMMIT CHANGES
          </Button>
        </div>
      </div>
    </form>
  );
}

function InvitesTab() {
  const [invites, setInvites] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newInviteCode, setNewInviteCode] = useState("");
  const [newInviteExpiry, setNewInviteExpiry] = useState("");
  const [newInviteProduct, setNewInviteProduct] = useState("");
  const [status, setStatus] = useState("");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [inviteRes, reqRes] = await Promise.all([
        fetch('/api/admin/invites', { credentials: 'include' }),
        fetch('/api/admin/invite-requests', { credentials: 'include' })
      ]);
      const inviteJson = await inviteRes.json();
      const reqJson = await reqRes.json();
      setInvites(inviteJson.invites || []);
      setRequests(reqJson.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => { fetchData(); }, []);

  const refresh = () => { fetchData(); };

  const handleCreateInvite = async () => {
    try {
      setStatus('Creating invite...');
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code: newInviteCode || undefined,
          expiresAt: newInviteExpiry || undefined,
          productId: newInviteProduct || undefined,
        })
      });
      if (!res.ok) throw new Error('Create failed');
      await fetchData();
      setStatus('Invite created');
      setNewInviteCode('');
      setNewInviteExpiry('');
      setNewInviteProduct('');
    } catch (err) {
      setStatus('Failed to create invite.');
      console.error(err);
    }
  };

  const actionOnInvite = async (id: number, action: 'close'|'reopen'|'delete') => {
    try {
      if (action === 'delete') {
        await fetch(`/api/admin/invites/${id}`, { method: 'DELETE', credentials: 'include' });
      } else {
        await fetch(`/api/admin/invites/${id}/${action === 'close' ? 'ban' : 'unban'}`, { method: 'POST', credentials: 'include' });
      }
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: number, approve: boolean) => {
    try {
      await fetch(`/api/admin/invite-requests/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST', credentials: 'include' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-6 space-y-4">
      <h2 className="text-xl font-bold">Invite Management</h2>
      <p className="text-sm text-muted-foreground">Create invite codes, close/reopen, and process user requests.</p>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Input placeholder="Invite code (leave blank to auto-generate)" value={newInviteCode} onChange={e => setNewInviteCode(e.target.value)} className="bg-black/40" />
        <Input type="datetime-local" placeholder="Expires at" value={newInviteExpiry} onChange={e => setNewInviteExpiry(e.target.value)} className="bg-black/40" />
        <Input placeholder="Product ID (optional)" value={newInviteProduct} onChange={e => setNewInviteProduct(e.target.value)} className="bg-black/40" />
        <Button variant="glow" onClick={handleCreateInvite} className="w-full"> <Plus className="w-4 h-4" /> Create</Button>
      </div>

      <p className="text-xs text-muted-foreground">{status}</p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border border-white/10 rounded-lg">
          <thead className="text-xs uppercase bg-white/[0.02] text-muted-foreground border-b border-white/5">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? <tr><td colSpan={5} className="px-3 py-4 text-center">Loading...</td></tr> :
              invites.map(inv => (
                <tr key={inv.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-xs">{inv.code}</td>
                  <td className="px-3 py-2 text-xs">{inv.productId || 'global'}</td>
                  <td className="px-3 py-2 text-xs">{inv.expiresAt ? new Date(inv.expiresAt).toLocaleString() : 'never'}</td>
                  <td className="px-3 py-2 text-xs">{inv.isBanned ? 'Closed' : inv.isUsed ? 'Used' : 'Active'}</td>
                  <td className="px-3 py-2 text-xs space-x-1">
                    <Button size="sm" variant="ghost" className="text-yellow-400" onClick={() => actionOnInvite(inv.id, inv.isBanned ? 'reopen' : 'close')}>
                      {inv.isBanned ? <Unlock className="w-3 h-3" /> : <X className="w-3 h-3" />} {inv.isBanned ? 'Reopen' : 'Close'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => actionOnInvite(inv.id, 'delete')}>
                      <Trash2 className="w-3 h-3" /> Delete
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="pt-5 border-t border-white/10">
        <h3 className="text-lg font-semibold">Invite Requests</h3>
        {isLoading ? <p>Loading...</p> : requests.length === 0 ? <p className="text-xs text-muted-foreground">No pending requests.</p> : (
          <table className="w-full text-sm text-left border border-white/10 rounded-lg">
            <thead className="text-xs uppercase bg-white/[0.02] text-muted-foreground border-b border-white/5">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map(req => (
                <tr key={req.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-xs">{req.email}</td>
                  <td className="px-3 py-2 text-xs">{req.username}</td>
                  <td className="px-3 py-2 text-xs">{req.reason || 'No reason'}</td>
                  <td className="px-3 py-2 text-xs">{req.status}</td>
                  <td className="px-3 py-2 text-xs">
                    <Button size="sm" variant="ghost" onClick={() => handleApprove(req.id, true)}>Approve</Button>
                    <Button size="sm" variant="ghost" onClick={() => handleApprove(req.id, false)}>Reject</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LoadersTab() {
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [status, setStatus] = useState("");

  const validateFile = (file: File | null) => {
    if (!file) {
      setFileError("");
      return true;
    }
    
    if (!file.name.toLowerCase().endsWith('.exe')) {
      setFileError(`Invalid file: "${file.name}" is not an .exe file. Please select a .exe file.`);
      return false;
    }
    
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      setFileError(`File is too large: ${formatFileSize(file.size)}. Maximum size is 500MB.`);
      return false;
    }
    
    setFileError("");
    return true;
  };

  const fetchVersions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/loaders/versions', { credentials: 'include' });
      const responseText = await res.text();
      
      if (!res.ok) {
        let errorMessage = `Server error (${res.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }
      
      const data = JSON.parse(responseText);
      setVersions(data);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to fetch loader versions';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => { fetchVersions(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    if (!version) {
      toast.error('Please enter a version number');
      return;
    }
    if (fileError) {
      toast.error(`File validation error: ${fileError}`);
      return;
    }
    if (!validateFile(selectedFile)) {
      toast.error('Please select a valid .exe file');
      return;
    }

    setUploading(true);
    setStatus('Uploading...');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('version', version);
      formData.append('changelog', changelog);
      formData.append('isActive', String(isActive));

      const res = await fetch('/api/loaders/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      let error: any = null;
      
      // Read response once and try parsing as JSON
      const responseText = await res.text();
      let data: any = null;
      
      try {
        data = JSON.parse(responseText);
      } catch {
        // Response was not JSON - use raw text
        data = { error: responseText || `Upload failed with status ${res.status}` };
      }

      if (!res.ok) {
        error = data;
      } else {
        // Success
        toast.success(`Loader v${version} uploaded successfully`);
        setSelectedFile(null);
        setVersion('');
        setChangelog('');
        setIsActive(true);
        setStatus('');
        await fetchVersions();
        return;
      }

      if (error) {
        throw new Error(error.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      toast.error(message);
      setStatus(`Error: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleActivate = async (versionId: number) => {
    try {
      const res = await fetch(`/api/loaders/${versionId}/activate`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Failed to activate';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }
      toast.success('Loader version activated');
      await fetchVersions();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to activate version';
      toast.error(message);
    }
  };

  const handleDelete = async (versionId: number) => {
    if (!window.confirm('Are you sure you want to delete this loader version?')) return;

    try {
      const res = await fetch(`/api/loaders/${versionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = 'Failed to delete';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }
      toast.success('Loader version deleted');
      await fetchVersions();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to delete version';
      toast.error(message);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Upload New Loader Version</h2>
        
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Version (X.Y.Z format)</label>
              <Input 
                type="text" 
                placeholder="e.g., 2.4.2" 
                value={version} 
                onChange={(e) => setVersion(e.target.value)}
                pattern="\d+\.\d+\.\d+"
                required
                className="bg-black/40"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Loader File (.exe)</label>
              <input 
                type="file" 
                accept=".exe"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  validateFile(file);
                  setSelectedFile(file);
                }}
                required
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
              />
              {fileError && (
                <p className="text-xs text-red-500 mt-1">{fileError}</p>
              )}
              {selectedFile && !fileError && (
                <p className="text-xs text-muted-foreground mt-1">✓ {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Changelog (optional)</label>
            <textarea 
              placeholder="List changes and improvements..."
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white placeholder-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="setActive" 
              checked={isActive} 
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="setActive" className="text-sm text-muted-foreground">
              Set as active version (users will download this)
            </label>
          </div>

          <Button 
            type="submit" 
            disabled={uploading || !selectedFile || !version}
            className="w-full gap-2"
            variant="glow"
          >
            <Download className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Loader'}
          </Button>
        </form>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Loader Versions</h2>
        
        {isLoading ? (
          <p className="text-muted-foreground">Loading versions...</p>
        ) : versions.length === 0 ? (
          <p className="text-muted-foreground">No loader versions uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-white/[0.02] text-muted-foreground border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">File Size</th>
                  <th className="px-4 py-3">Released</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {versions.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-bold text-white">v{v.version}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatFileSize(v.fileSize)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(v.releaseDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-xs font-bold px-2 py-1 rounded-full",
                        v.isActive 
                          ? "bg-green-500/20 text-green-400" 
                          : "bg-gray-500/20 text-gray-400"
                      )}>
                        {v.isActive ? '● ACTIVE' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs space-x-2">
                      {!v.isActive && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-green-400 hover:bg-green-500/10"
                          onClick={() => handleActivate(v.id)}
                        >
                          Activate
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDelete(v.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RateLimitingTab() {
  const { data: config, isLoading } = useAdminGetConfig();
  const updateConfig = useAdminUpdateConfig();
  const [formData, setFormData] = React.useState(config);

  // Update local state when query data loads
  React.useEffect(() => { if (config) setFormData(config); }, [config]);

  if (isLoading || !formData) return <div className="h-64 animate-pulse bg-white/5 rounded-2xl" />;

  const handleSave = async () => {
    updateConfig.mutate({ data: formData }, {
      onSuccess: () => toast.success('Rate limiting configuration saved'),
      onError: (err: any) => {
        const message = err?.message || 'Failed to save rate limiting configuration';
        console.error('Config save failed:', err);
        toast.error(message);
      }
    });
  };

  const RateLimitSection = ({ title, category, description }: { title: string; category: string; description: string }) => (
    <div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-white/5 bg-black/40">
          <label className="block text-sm font-semibold text-white mb-2">Requests Per Window</label>
          <Input 
            type="number" 
            min={1}
            max={1000}
            value={formData[`rateLimit${category}PerWindow`] ?? 0} 
            onChange={e => setFormData({...formData, [`rateLimit${category}PerWindow`]: Number(e.target.value)})} 
            className="bg-black/40 border-white/10" 
          />
        </div>

        <div className="p-4 rounded-xl border border-white/5 bg-black/40">
          <label className="block text-sm font-semibold text-white mb-2">Window Duration (milliseconds)</label>
          <Input 
            type="number" 
            min={1000}
            step={1000}
            value={formData[`rateLimit${category}WindowMs`] ?? 0} 
            onChange={e => setFormData({...formData, [`rateLimit${category}WindowMs`]: Number(e.target.value)})} 
            className="bg-black/40 border-white/10" 
          />
          <div className="text-xs text-muted-foreground mt-2">
            {formData[`rateLimit${category}WindowMs`] && `${Math.round(formData[`rateLimit${category}WindowMs`] / 1000)}s`}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="glass-panel p-8 rounded-2xl border border-white/10 shadow-2xl max-w-5xl">
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Rate Limiting Configuration</h2>
          <p className="text-sm text-muted-foreground">Manage rate limits for all system components</p>
        </div>

        {/* Login */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Login" 
            category="Login"
            description="Limit login attempts"
          />
        </div>

        {/* Register */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Registration" 
            category="Register"
            description="Limit new account registrations"
          />
        </div>

        {/* Forgot Password */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Forgot Password" 
            category="ForgotPassword"
            description="Limit password reset requests per email"
          />
        </div>

        {/* Reset Password */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Reset Password" 
            category="ResetPassword"
            description="Limit password reset confirmations per token"
          />
        </div>

        {/* Change Password */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Change Password" 
            category="ChangePassword"
            description="Limit password change attempts for authenticated users"
          />
        </div>

        {/* Change Username */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Change Username" 
            category="ChangeUsername"
            description="Limit username change attempts for authenticated users"
          />
        </div>

        {/* SSO Link */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="SSO Linking" 
            category="SsoLink"
            description="Limit SSO account linking attempts"
          />
        </div>

        {/* Invite Request */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Invite Requests" 
            category="InviteRequest"
            description="Limit invite code requests per email"
          />
        </div>

        {/* API */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="General API" 
            category="Api"
            description="Limit general API requests per IP"
          />
        </div>

        {/* Forum Interactions */}
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">Forum Interactions</h3>
          <div className="space-y-6">
            <RateLimitSection 
              title="Create Topics/Threads" 
              category="CreateThread"
              description="Limit new thread creation rate"
            />
            <RateLimitSection 
              title="Create Posts" 
              category="CreatePost"
              description="Limit new post creation in threads"
            />
            <RateLimitSection 
              title="Edit Posts" 
              category="EditPost"
              description="Limit post editing rate"
            />
            <RateLimitSection 
              title="Delete Posts" 
              category="DeletePost"
              description="Limit post deletion rate"
            />
          </div>
        </div>

        {/* Profile Interactions */}
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">Profile Interactions</h3>
          <div className="space-y-6">
            <RateLimitSection 
              title="Post on Profile" 
              category="PostOnProfile"
              description="Limit posting on user profiles"
            />
            <RateLimitSection 
              title="Edit Profile Posts" 
              category="EditProfilePost"
              description="Limit profile post editing"
            />
            <RateLimitSection 
              title="Delete Profile Posts" 
              category="DeleteProfilePost"
              description="Limit profile post deletion"
            />
          </div>
        </div>

        {/* File Uploads */}
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">File Management</h3>
          <div className="space-y-6">
            <RateLimitSection 
              title="General File Uploads" 
              category="FileUpload"
              description="Limit file uploads (posts, attachments)"
            />
            <RateLimitSection 
              title="Avatar Uploads" 
              category="AvatarUpload"
              description="Limit profile picture changes"
            />
          </div>
        </div>

        {/* Email & Verification */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Email Verification" 
            category="EmailVerify"
            description="Limit email verification request resends"
          />
        </div>

        {/* Purchases */}
        <div className="pt-6 border-t border-white/10">
          <RateLimitSection 
            title="Account Purchases" 
            category="Purchase"
            description="Limit subscription and product purchases per user"
          />
        </div>

        {/* Shoutbox Rate Limiting */}
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-lg font-bold text-white mb-4">Shoutbox</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-white/5 bg-black/40">
              <label className="block text-sm font-semibold text-white mb-2">Messages Per Window</label>
              <Input 
                type="number" 
                min={1}
                max={100}
                value={formData.shoutboxRateLimitPerWindow ?? 5} 
                onChange={e => setFormData({...formData, shoutboxRateLimitPerWindow: Number(e.target.value)})} 
                className="bg-black/40 border-white/10" 
              />
              <div className="text-xs text-muted-foreground mt-2">Maximum messages allowed per time window</div>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-black/40">
              <label className="block text-sm font-semibold text-white mb-2">Window Duration (milliseconds)</label>
              <Input 
                type="number" 
                min={1000}
                step={1000}
                value={formData.shoutboxRateLimitWindowMs ?? 10000} 
                onChange={e => setFormData({...formData, shoutboxRateLimitWindowMs: Number(e.target.value)})} 
                className="bg-black/40 border-white/10" 
              />
              <div className="text-xs text-muted-foreground mt-2">Time period in milliseconds (10000 = 10 seconds)</div>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-black/40">
              <label className="block text-sm font-semibold text-white mb-2">Strike Decay Time (seconds)</label>
              <Input 
                type="number" 
                min={60}
                step={60}
                value={formData.shoutboxRateLimitStrikeDecayMs ?? 3600} 
                onChange={e => setFormData({...formData, shoutboxRateLimitStrikeDecayMs: Number(e.target.value)})} 
                className="bg-black/40 border-white/10" 
              />
              <div className="text-xs text-muted-foreground mt-2">Time for strikes to decay (3600 = 1 hour)</div>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-black/40">
              <label className="block text-sm font-semibold text-white mb-2">Max Strikes Before Block</label>
              <Input 
                type="number" 
                min={1}
                max={10}
                value={formData.shoutboxRateLimitMaxStrikes ?? 3} 
                onChange={e => setFormData({...formData, shoutboxRateLimitMaxStrikes: Number(e.target.value)})} 
                className="bg-black/40 border-white/10" 
              />
              <div className="text-xs text-muted-foreground mt-2">Users are blocked after reaching this many violations</div>
            </div>
          </div>
        </div>

        <div className="pt-6 text-right">
          <Button 
            onClick={handleSave} 
            disabled={updateConfig.isPending} 
            variant="glow" 
            className="gap-2"
          >
            <Save className="w-4 h-4" /> {updateConfig.isPending ? 'SAVING...' : 'SAVE RATE LIMITING'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductsPricingEditor({ formData, setFormData }: any) {
  const [products, setProducts] = React.useState<any[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    fetch('/api/products').then(r => r.json()).then(data => { if (!cancelled) setProducts(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleChange = (id: string, key: string, value: any) => {
    const next = { ...(formData.products || {}) };
    const entry = { ...(next[id] || {}) };
    if (key === 'price' || key === 'bulkDiscountPercent' || key === 'bulkQuantity') {
      // Keep the raw input value for editing, convert on blur/save
      entry[key] = value === "" ? "" : Number(value);
    } else if (key === 'inviteOnly') {
      entry[key] = Boolean(value);
    } else {
      entry[key] = value;
    }
    next[id] = entry;
    setFormData({ ...formData, products: next });
  };

  if (!products || products.length === 0) return <div className="text-sm text-muted-foreground">No products loaded.</div>;

  return (
    <div className="grid grid-cols-1 gap-3">
      {products.map(p => {
        const cfg = (formData.products && formData.products[p.id]) || {};
        return (
          <div key={p.id} className="p-3 rounded-xl border border-white/5 bg-black/40 grid grid-cols-3 gap-3 items-center">
            <div>
              <div className="font-bold text-white">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.description}</div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Price (USD) <span className="text-white/50">default: ${p.price}</span></label>
              <Input value={cfg.price ?? ''} onChange={(e:any) => handleChange(p.id, 'price', e.target.value)} placeholder={String(p.price)} className="bg-black/40" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bulk: qty / % off</label>
              <div className="flex gap-2">
                <Input placeholder="qty" value={cfg.bulkQuantity ?? ''} onChange={(e:any) => handleChange(p.id, 'bulkQuantity', e.target.value)} className="bg-black/40" />
                <Input placeholder="discount %" value={cfg.bulkDiscountPercent ?? ''} onChange={(e:any) => handleChange(p.id, 'bulkDiscountPercent', e.target.value)} className="bg-black/40" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={cfg.inviteOnly || false} onChange={(e:any) => handleChange(p.id, 'inviteOnly', e.target.checked)} className="w-4 h-4" />
              <span className="text-xs text-muted-foreground">Invite-only product</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubscriptionModal({ 
  activeProducts, 
  onConfirm, 
  onClose 
}: { 
  activeProducts: any[]; 
  onConfirm: (products: string[] | null, tier: string | null, action: 'replace' | 'extend', extendDays?: number, reason?: string) => void; 
  onClose: () => void; 
}) {
  const [mode, setMode] = React.useState<'replace' | 'extend'>('replace');
  const [selectedProducts, setSelectedProducts] = React.useState<Set<string>>(new Set());
  const [selectedTier, setSelectedTier] = React.useState<string>("premium");
  const [extendDays, setExtendDays] = React.useState<number>(30);
  const [extendReason, setExtendReason] = React.useState<string>("");
  const [selectedExtendProducts, setSelectedExtendProducts] = React.useState<Set<string>>(
    new Set(activeProducts.map(p => p.productId))
  );

  const existingProductIds = React.useMemo(() => new Set(activeProducts.map(p => p.productId)), [activeProducts]);

  const toggleProduct = (product: string) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(product)) {
      newSet.delete(product);
    } else {
      newSet.add(product);
    }
    setSelectedProducts(newSet);
  };

  const toggleExtendProduct = (product: string) => {
    const newSet = new Set(selectedExtendProducts);
    if (newSet.has(product)) {
      newSet.delete(product);
    } else {
      newSet.add(product);
    }
    setSelectedExtendProducts(newSet);
  };

  const handleConfirm = () => {
    if (mode === 'extend') {
      onConfirm(Array.from(selectedExtendProducts), null, 'extend', extendDays, extendReason);
    } else {
      if (selectedProducts.size === 0) {
        onConfirm(null, null, 'replace');
      } else {
        onConfirm(Array.from(selectedProducts), selectedTier, 'replace');
      }
    }
  };

  const handleRemove = () => {
    onConfirm(null, null, 'replace');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="glass-panel border border-white/10 rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Manage Subscriptions</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Subscriptions */}
        {activeProducts.length > 0 && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <h3 className="text-sm font-semibold text-green-300 mb-2">Current Subscriptions</h3>
            <div className="flex flex-wrap gap-2">
              {activeProducts.map(ap => (
                <div 
                  key={ap.productId}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-sm font-medium",
                    ap.tier === "lifetime"
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300"
                      : "bg-green-500/20 border-green-500/50 text-green-300"
                  )}
                  title={`Expires: ${new Date(ap.expiresAt).toLocaleDateString()}`}
                >
                  {formatUpgradeDisplay(ap.productId)} ({ap.tier}) • Expires {new Date(ap.expiresAt).toLocaleDateString()}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10">
          <button
            onClick={() => setMode('replace')}
            className={cn(
              "px-4 py-2 font-medium transition-colors border-b-2",
              mode === 'replace'
                ? "border-blue-500 text-blue-300"
                : "border-transparent text-muted-foreground hover:text-white"
            )}
          >
            Replace
          </button>
          {activeProducts.length > 0 && (
            <button
              onClick={() => setMode('extend')}
              className={cn(
                "px-4 py-2 font-medium transition-colors border-b-2",
                mode === 'extend'
                  ? "border-green-500 text-green-300"
                  : "border-transparent text-muted-foreground hover:text-white"
              )}
            >
              Extend
            </button>
          )}
        </div>

        {/* Replace Mode */}
        {mode === 'replace' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Products (select multiple)</label>
              <div className="grid grid-cols-3 gap-2">
                {PRODUCTS.map(product => {
                  const isExisting = existingProductIds.has(product);
                  return (
                    <button
                      key={product}
                      onClick={() => toggleProduct(product)}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                        selectedProducts.has(product)
                          ? "bg-blue-500/20 border-blue-500 text-blue-200"
                          : isExisting
                          ? "bg-green-500/20 border-green-500/50 text-green-300"
                          : "bg-black/40 border-white/10 text-muted-foreground hover:border-white/20"
                      )}
                      title={isExisting ? "User already has this subscription" : ""}
                    >
                      {selectedProducts.has(product) && "✓ "}{formatUpgradeDisplay(product)}{isExisting && " ◆"}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">◆ = User already has this subscription</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Tier (applies to all)</label>
              <div className="grid grid-cols-2 gap-2">
                {TIERS.map(tier => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors capitalize",
                      selectedTier === tier
                        ? "bg-green-500/20 border-green-500 text-green-200"
                        : "bg-black/40 border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {selectedProducts.size > 0 && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-muted-foreground">
                Selected: <span className="text-white font-semibold">{Array.from(selectedProducts).join(", ")} ({selectedTier})</span>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleRemove} variant="ghost" className="flex-1 text-amber-500 hover:bg-amber-500/10">
                Remove All
              </Button>
              <Button 
                onClick={handleConfirm} 
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                Replace
              </Button>
            </div>
          </div>
        )}

        {/* Extend Mode */}
        {mode === 'extend' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Select products to extend</label>
              <div className="grid grid-cols-3 gap-2">
                {activeProducts.map(product => (
                  <button
                    key={product.productId}
                    onClick={() => toggleExtendProduct(product.productId)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                      selectedExtendProducts.has(product.productId)
                        ? "bg-green-500/20 border-green-500 text-green-200"
                        : "bg-black/40 border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                  >
                    {selectedExtendProducts.has(product.productId) && "✓ "}{formatUpgradeDisplay(product.productId)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Select which product subscriptions to extend</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Extend by (days)</label>
              <div className="flex gap-2 items-center">
                <Input 
                  type="number" 
                  min="1" 
                  max="365"
                  value={extendDays} 
                  onChange={(e) => setExtendDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-black/40 border-white/10 w-24"
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Reason (optional)</label>
              <textarea 
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                placeholder="e.g., Compensation for downtime during updates"
                maxLength={500}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white placeholder-muted-foreground focus:border-white/30 focus:outline-none resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">{extendReason.length}/500</p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
              <p className="text-muted-foreground">Will extend <span className="text-blue-300 font-semibold">{selectedExtendProducts.size} product(s)</span> by <span className="text-blue-300 font-semibold">{extendDays} days</span></p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={onClose} variant="ghost" className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={selectedExtendProducts.size === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Extend
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailSettingsTab() {
  const { data: config, isLoading } = useAdminGetConfig();
  const updateConfig = useAdminUpdateConfig();
  const [formData, setFormData] = React.useState<any>(config);

  React.useEffect(() => { if (config) setFormData(config); }, [config]);

  if (isLoading || !formData) return <div className="h-64 animate-pulse bg-white/5 rounded-2xl" />;

  const handleSave = async () => {
    updateConfig.mutate({ data: formData }, {
      onSuccess: () => toast.success('Email settings saved successfully'),
      onError: (err: any) => {
        const message = err?.message || 'Failed to save email settings';
        console.error('Email settings save failed:', err);
        toast.error(message);
      }
    });
  };

  return (
    <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
      <div className="p-6 border-b border-white/5 bg-black/40">
        <h2 className="font-bold text-lg">Email Template Settings</h2>
        <p className="text-sm text-muted-foreground">Configure email notification templates</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Email Verification Template */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Verification Email Subject</label>
            <Input 
              value={formData.emailVerificationSubject || 'Verify your email'} 
              onChange={e => setFormData({...formData, emailVerificationSubject: e.target.value})} 
              className="bg-black/40 border-white/10" 
              placeholder="Subject line for verification emails"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Verification Email Body</label>
            <textarea 
              value={formData.emailVerificationBody || ''} 
              onChange={e => setFormData({...formData, emailVerificationBody: e.target.value})} 
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-muted-foreground focus:border-white/30 focus:outline-none resize-none"
              placeholder="Email body with {link} and {username} placeholders"
              rows={4}
            />
            <div className="text-xs text-muted-foreground mt-2">Available placeholders: {'{username}'}, {'{link}'}, {'{expiryTime}'}</div>
          </div>
        </div>

        {/* Password Reset Template */}
        <div className="space-y-3 pt-6 border-t border-white/10">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Password Reset Email Subject</label>
            <Input 
              value={formData.emailPasswordResetSubject || 'Reset your password'} 
              onChange={e => setFormData({...formData, emailPasswordResetSubject: e.target.value})} 
              className="bg-black/40 border-white/10" 
              placeholder="Subject line for password reset emails"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Password Reset Email Body</label>
            <textarea 
              value={formData.emailPasswordResetBody || ''} 
              onChange={e => setFormData({...formData, emailPasswordResetBody: e.target.value})} 
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-muted-foreground focus:border-white/30 focus:outline-none resize-none"
              placeholder="Email body with {link} and {username} placeholders"
              rows={4}
            />
            <div className="text-xs text-muted-foreground mt-2">Available placeholders: {'{username}'}, {'{link}'}, {'{expiryTime}'}</div>
          </div>
        </div>

        {/* Welcome Email Template */}
        <div className="space-y-3 pt-6 border-t border-white/10">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Welcome Email Subject</label>
            <Input 
              value={formData.emailWelcomeSubject || 'Welcome to our community'} 
              onChange={e => setFormData({...formData, emailWelcomeSubject: e.target.value})} 
              className="bg-black/40 border-white/10" 
              placeholder="Subject line for welcome emails"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">Welcome Email Body</label>
            <textarea 
              value={formData.emailWelcomeBody || ''} 
              onChange={e => setFormData({...formData, emailWelcomeBody: e.target.value})} 
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-muted-foreground focus:border-white/30 focus:outline-none resize-none"
              placeholder="Email body with {username} placeholder"
              rows={4}
            />
            <div className="text-xs text-muted-foreground mt-2">Available placeholders: {'{username}'}</div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-6 text-right border-t border-white/10">
          <Button 
            onClick={handleSave} 
            disabled={updateConfig.isPending} 
            variant="glow" 
            className="gap-2"
          >
            <Save className="w-4 h-4" /> {updateConfig.isPending ? 'SAVING...' : 'SAVE EMAIL SETTINGS'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoleSelectionModal({ 
  currentRole, 
  onConfirm, 
  onClose 
}: { 
  currentRole: string; 
  onConfirm: (role: string) => void; 
  onClose: () => void; 
}) {
  const roles = [
    { id: "user", label: "User", description: "Standard forum member permissions.", color: "text-zinc-400", bg: "bg-zinc-400/10", border: "border-zinc-400/30" },
    { id: "mod", label: "Moderator", description: "Management access: moderate threads and users.", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/30" },
    { id: "admin", label: "Administrator", description: "Full system access: config, payments, and loaders.", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="glass-panel border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Adjust Operative Classification</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => onConfirm(role.id)}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden",
                currentRole === role.id 
                  ? cn(role.bg, role.border, "ring-1", role.id === 'admin' ? "ring-amber-500/50" : role.id === 'mod' ? "ring-indigo-500/50" : "ring-white/20")
                  : "bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn("font-bold text-sm uppercase tracking-wider", role.color)}>{role.label}</span>
                {currentRole === role.id && (
                  <div className={cn("px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 border border-white/10 text-white uppercase")}>
                    Current
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 leading-relaxed">
                {role.description}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <Button variant="outline" onClick={onClose} className="w-full">
            CANCEL
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductAssetsTab() {
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [assetType, setAssetType] = useState<"primary_exe" | "dll" | "driver" | "config" | "other">("primary_exe");
  const [version, setVersion] = useState("1.0.0");
  const [isActive, setIsActive] = useState(true);
  const [allocationSize, setAllocationSize] = useState("");

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products/${selectedProduct}/assets`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assets");
      const data = await res.json();
      setAssets(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load product assets");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAssets();
  }, [selectedProduct]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return toast.error("Please select a file");
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("version", version);
    formData.append("assetType", assetType);
    formData.append("isActive", String(isActive));

    if (allocationSize) {
      formData.append("allocationSize", allocationSize);
    }

    try {
      const res = await fetch(`/api/products/${selectedProduct}/assets`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      
      toast.success("Asset uploaded successfully");
      setSelectedFile(null);
      fetchAssets();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this asset permanently?")) return;
    try {
      const res = await fetch(`/api/products/${selectedProduct}/assets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete asset");
      toast.success("Asset deleted");
      fetchAssets();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Upload Product Asset</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Product</label>
              <select 
                value={selectedProduct} 
                onChange={e => setSelectedProduct(e.target.value as any)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm"
              >
                {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Asset Type</label>
              <select 
                value={assetType} 
                onChange={e => setAssetType(e.target.value as any)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm"
              >
                <option value="primary_exe">Primary EXE</option>
                <option value="dll">DLL Payload</option>
                <option value="driver">Kernel Driver</option>
                <option value="config">Config File</option>
                <option value="other">Other/Data</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Version</label>
              <Input 
                value={version} 
                onChange={e => setVersion(e.target.value)} 
                className="bg-black/40" 
                required 
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Custom Alloc (Bytes) <span className="text-muted-foreground text-xs">(optional)</span></label>
              <Input 
                type="number"
                placeholder="e.g. 52428800 (50MB)"
                className="bg-black/40" 
                value={allocationSize}
                onChange={e => setAllocationSize(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">File</label>
              <input 
                type="file" 
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4" />
            <label className="text-sm text-muted-foreground">Mark as active</label>
          </div>
          <Button type="submit" disabled={uploading} variant="glow" className="w-full">
            <Download className="w-4 h-4 mr-2" /> {uploading ? "Uploading..." : "Upload Asset"}
          </Button>
        </form>
      </div>

      <div className="glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Assets for {selectedProduct}</h2>
        {isLoading ? <p>Loading...</p> : assets.length === 0 ? <p className="text-sm text-muted-foreground">No assets found for this product.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-white/[0.02] border-b border-white/5">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Alloc</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assets.map(asset => (
                  <tr key={asset.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">{asset.assetType}</td>
                    <td className="px-4 py-3">{asset.version}</td>
                    <td className="px-4 py-3">{asset.fileName}</td>
                    <td className="px-4 py-3">{(asset.fileSize / 1024 / 1024).toFixed(2)} MB</td>
                    <td className="px-4 py-3">{asset.allocationSize ? (asset.allocationSize / 1024 / 1024).toFixed(2) + " MB" : "Auto"}</td>
                    <td className="px-4 py-3 text-xs">
                      {asset.isActive ? <span className="text-green-400">ACTIVE</span> : <span className="text-zinc-500">INACTIVE</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(asset.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


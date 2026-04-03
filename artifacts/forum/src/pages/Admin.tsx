import React, { useState } from "react";
import { useAdminGetUsers, useAdminGetConfig, useAdminUpdateConfig, type SiteConfigInviteRequestMode } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Shield, Settings, Users, Search, Save, AlertCircle, Plus, Trash2, Slash, Unlock, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, getRoleColor, formatDate } from "@/lib/utils";
import { toast } from "sonner";

const PRODUCTS = ["BODYCAM", "RUST", "DAYZ", "TARKOV", "SPOOFER"] as const;
const TIERS = ["premium", "lifetime"] as const;

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'config' | 'logins' | 'invites'>('users');
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
        </div>

        {activeTab === 'users' && <UserManagementTab search={search} setSearch={setSearch} />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'logins' && <LoginEventsTab />}
        {activeTab === 'invites' && <InvitesTab />}
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
  const [togglingAdminId, setTogglingAdminId] = useState<number | null>(null);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalUserId, setSubModalUserId] = useState<number | null>(null);
  const [subModalCurrentValue, setSubModalCurrentValue] = useState<string | null>(null);

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

  const handleToggleAdmin = async (userId: number, isAdmin: boolean) => {
    setTogglingAdminId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: isAdmin ? "user" : "admin" }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to update role");
      toast.success(isAdmin ? "Removed admin status" : "Promoted to admin");
      refetch();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${isAdmin ? "remove" : "grant"} admin status`);
    } finally {
      setTogglingAdminId(null);
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

  const handleUpdateSubscription = (userId: number, currentSub: string | null) => {
    setSubModalUserId(userId);
    setSubModalCurrentValue(currentSub);
    setSubModalOpen(true);
  };

  const handleSubscriptionConfirm = async (product: string | null, tier: string | null) => {
    if (!subModalUserId) return;

    let upgradeType: string | null = null;
    if (product && tier) {
      upgradeType = `${product}_${tier.toUpperCase()}`;
    }

    try {
      const res = await fetch(`/api/admin/users/${subModalUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upgradeType }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Subscription updated successfully");
      refetch();
      setSubModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update subscription");
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
                    <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border inline-block", getRoleColor(user.role, user.upgradeType))}>
                      {user.upgradeType || user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {user.isBanned 
                        ? <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Banned</span> 
                        : <span className="text-xs text-green-500">Active</span>}
                      {!user.isEmailVerified && (
                        <span className="text-xs text-yellow-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Unverified</span>
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
                        onClick={() => handleUpdateSubscription(user.id, user.upgradeType || null)}
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
                        className={cn("h-7 px-2", user.role === "admin" ? "text-purple-500 hover:bg-purple-500/10" : "text-cyan-500 hover:bg-cyan-500/10")}
                        disabled={togglingAdminId === user.id}
                        onClick={() => handleToggleAdmin(user.id, user.role === "admin")}
                      >
                        {togglingAdminId === user.id ? "..." : (user.role === "admin" ? "Demote" : "Promote")}
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
        currentValue={subModalCurrentValue}
        onConfirm={handleSubscriptionConfirm}
        onClose={() => setSubModalOpen(false)}
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
        
        <div className="pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <label className="flex items-center gap-3 p-4 rounded-xl border border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              checked={formData.allowRegistration}
              onChange={e => setFormData({...formData, allowRegistration: e.target.checked})}
              className="w-5 h-5 rounded border-white/20 text-primary focus:ring-primary/50 bg-black/40"
            />
            <div>
              <div className="font-bold text-white">Accept New Operatives</div>
              <div className="text-xs text-muted-foreground">Allow public registration</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-4 rounded-xl border border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors">
            <input 
              type="checkbox" 
              checked={formData.inviteOnlyMode}
              onChange={e => setFormData({...formData, inviteOnlyMode: e.target.checked})}
              className="w-5 h-5 rounded border-white/20 text-primary focus:ring-primary/50 bg-black/40"
            />
            <div>
              <div className="font-bold text-white">Invite-Only Mode</div>
              <div className="text-xs text-muted-foreground">Require invite code on registration</div>
            </div>
          </label>

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

  const actionOnInvite = async (id: number, action: 'ban'|'unban'|'delete') => {
    try {
      if (action === 'delete') {
        await fetch(`/api/admin/invites/${id}`, { method: 'DELETE', credentials: 'include' });
      } else {
        await fetch(`/api/admin/invites/${id}/${action}`, { method: 'POST', credentials: 'include' });
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
      <p className="text-sm text-muted-foreground">Create invite codes, ban/unban, and process user requests.</p>

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
                  <td className="px-3 py-2 text-xs">{inv.isBanned ? 'Banned' : inv.isUsed ? 'Used' : 'Active'}</td>
                  <td className="px-3 py-2 text-xs space-x-1">
                    <Button size="sm" variant="ghost" className="text-green-400" onClick={() => actionOnInvite(inv.id, inv.isBanned ? 'unban' : 'ban')}>
                      {inv.isBanned ? <Unlock className="w-3 h-3" /> : <Slash className="w-3 h-3" />} {inv.isBanned ? 'Unban' : 'Ban'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => actionOnInvite(inv.id, 'delete')}>
                      <Trash2 className="w-3 h-3" /> Remove
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
    if (value === "") delete entry[key];
    else if (key === 'price' || key === 'bulkDiscountPercent' || key === 'bulkQuantity') entry[key] = Number(value);
    else if (key === 'inviteOnly') entry[key] = Boolean(value);
    else entry[key] = value;
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
              <label className="text-xs text-muted-foreground">Price (USD)</label>
              <Input value={cfg.price ?? p.price} onChange={(e:any) => handleChange(p.id, 'price', e.target.value)} className="bg-black/40" />
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
  currentValue, 
  onConfirm, 
  onClose 
}: { 
  currentValue: string | null; 
  onConfirm: (product: string | null, tier: string | null) => void; 
  onClose: () => void; 
}) {
  const [selectedProduct, setSelectedProduct] = React.useState<string | null>(null);
  const [selectedTier, setSelectedTier] = React.useState<string | null>(null);

  // Parse current value if it exists
  React.useEffect(() => {
    if (currentValue) {
      const parts = currentValue.split('_');
      if (parts.length === 2) {
        setSelectedProduct(parts[0]);
        setSelectedTier(parts[1].toLowerCase());
      }
    }
  }, [currentValue]);

  const handleConfirm = () => {
    onConfirm(selectedProduct, selectedTier);
  };

  const handleRemove = () => {
    onConfirm(null, null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="glass-panel border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Assign Subscription</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Product</label>
            <div className="grid grid-cols-2 gap-2">
              {PRODUCTS.map(product => (
                <button
                  key={product}
                  onClick={() => setSelectedProduct(product)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                    selectedProduct === product
                      ? "bg-blue-500/20 border-blue-500 text-blue-200"
                      : "bg-black/40 border-white/10 text-muted-foreground hover:border-white/20"
                  )}
                >
                  {product}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Tier</label>
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

          {selectedProduct && selectedTier && (
            <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-muted-foreground">
              Selected: <span className="text-white font-semibold">{selectedProduct}_{selectedTier.toUpperCase()}</span>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button onClick={handleRemove} variant="ghost" className="flex-1 text-amber-500 hover:bg-amber-500/10">
              Remove
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!selectedProduct || !selectedTier}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Assign
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

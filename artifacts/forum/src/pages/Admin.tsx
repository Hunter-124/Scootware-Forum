import React, { useState } from "react";
import { useAdminGetUsers, useAdminGetConfig, useAdminUpdateConfig } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Shield, Settings, Users, Search, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, getRoleColor, formatDate } from "@/lib/utils";

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'config'>('users');
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
      </div>

      {activeTab === 'users' && <UserManagementTab search={search} setSearch={setSearch} />}
      {activeTab === 'config' && <ConfigTab />}
    </div>
  );
}

function UserManagementTab({ search, setSearch }: { search: string, setSearch: (s:string)=>void }) {
  const { data, isLoading } = useAdminGetUsers({ page: 1, search });

  return (
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
                    {user.isBanned 
                      ? <span className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Banned</span> 
                      : <span className="text-xs text-green-500">Active</span>}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(user.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/profile/${user.id}`}>
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary-foreground hover:bg-primary/20">Inspect</Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
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

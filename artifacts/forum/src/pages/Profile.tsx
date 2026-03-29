import React, { useState } from "react";
import { useRoute } from "wouter";
import { useGetUserProfile, useCreateProfilePost, useUploadAvatar } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, getRoleColor, cn } from "@/lib/utils";
import { User, Activity, Calendar, ShieldAlert, Upload, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UserProfile() {
  const [, params] = useRoute("/profile/:id");
  const userId = parseInt(params?.id || "0", 10);
  const { user: currentUser, isAdmin } = useAuth();
  
  const { data: profile, isLoading, refetch } = useGetUserProfile(userId, { query: { enabled: !!userId } });
  const [postContent, setPostContent] = useState("");

  const postMutation = useCreateProfilePost({
    mutation: { onSuccess: () => { setPostContent(""); refetch(); } }
  });

  const uploadMutation = useUploadAvatar({
    mutation: { onSuccess: () => { refetch(); } }
  });

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadMutation.mutate({ userId, data: { avatar: e.target.files[0] } });
    }
  };

  if (isLoading) return <div className="animate-pulse h-96 bg-white/5 rounded-2xl" />;
  if (!profile) return <div className="text-center p-12 text-destructive">User not found.</div>;

  const { user, recentPosts } = profile;
  const isOwnProfile = currentUser?.id === user.id;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Profile Header Card */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
        <div className="h-32 bg-gradient-to-r from-primary/30 to-accent/30 relative">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
        </div>
        
        <div className="px-8 pb-8 pt-0 flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 relative z-10 text-center md:text-left">
          
          {/* Avatar Area */}
          <div className="relative group">
            <div className="w-32 h-32 rounded-2xl border-4 border-card bg-secondary overflow-hidden box-glow shadow-xl flex items-center justify-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-muted-foreground" />
              )}
            </div>
            {isOwnProfile && (
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-opacity backdrop-blur-sm">
                <Upload className="w-6 h-6 text-white mb-1" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Upload</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadMutation.isPending} />
              </label>
            )}
          </div>

          <div className="flex-1 pb-2">
            <h1 className="text-3xl font-display font-bold text-white">{user.username}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
              <span className={cn("text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border", getRoleColor(user.role, user.upgradeType))}>
                {user.upgradeType || user.role}
              </span>
              {user.isBanned && <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border text-destructive bg-destructive/10 border-destructive/30">Banned</span>}
              <div className="text-muted-foreground text-sm flex items-center gap-1 ml-2">
                <Calendar className="w-4 h-4" /> Joined {new Date(user.createdAt).getFullYear()}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-4 text-center pb-2">
            <div className="glass-panel px-6 py-3 rounded-xl border-white/5">
              <div className="text-2xl font-mono text-white font-bold">{user.postCount}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Transmissions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Controls Section (Only visible to admins on other users profiles) */}
      {isAdmin && !isOwnProfile && (
        <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <h3 className="text-amber-500 font-bold flex items-center gap-2 mb-4"><ShieldAlert className="w-5 h-5" /> Admin Controls Override</h3>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/20">Edit User Details</Button>
            {!user.isBanned ? (
              <Button variant="destructive" className="bg-red-500/20 text-red-500 hover:bg-red-500/40 border border-red-500/50">Issue Ban</Button>
            ) : (
              <Button variant="outline" className="border-green-500/50 text-green-500 hover:bg-green-500/20">Revoke Ban</Button>
            )}
          </div>
          <p className="text-xs text-amber-500/70 mt-4 italic">Full management available in the central Admin Panel.</p>
        </div>
      )}

      {/* Profile Wall Grid */}
      <div className="grid grid-cols-1 gap-8">
        
        {/* Wall Posts Area */}
        <div className="space-y-6">
          <h2 className="text-xl font-display font-bold flex items-center gap-2 border-b border-white/10 pb-2">
            <Activity className="w-5 h-5 text-primary" /> Profile Comm-Link
          </h2>

          {/* New Post Box */}
          {currentUser && !user.isBanned && (
            <form 
              className="glass-panel rounded-xl p-4 border border-white/10 flex flex-col gap-3"
              onSubmit={(e) => { e.preventDefault(); postMutation.mutate({ userId, data: { content: postContent } }); }}
            >
              <textarea 
                className="w-full bg-black/40 rounded-lg p-3 text-sm text-white placeholder:text-muted-foreground border border-white/5 focus:border-primary/50 focus:outline-none resize-none"
                placeholder={`Leave a message for ${user.username}...`}
                rows={3}
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="secondary" size="sm" disabled={!postContent.trim() || postMutation.isPending} className="gap-2">
                  Post Message <Send className="w-3 h-3" />
                </Button>
              </div>
            </form>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {recentPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground italic border border-dashed border-white/10 rounded-xl">
                No signals on this frequency.
              </div>
            ) : (
              recentPosts.map(post => (
                <div key={post.id} className="glass-panel p-4 rounded-xl border border-white/5 flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-secondary overflow-hidden border border-white/10">
                    {post.authorAvatarUrl ? <img src={post.authorAvatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-bold text-white text-sm">{post.authorUsername}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-300">{post.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

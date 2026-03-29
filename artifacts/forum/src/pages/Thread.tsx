import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetThread, useCreatePost } from "@workspace/api-client-react";
import { formatDate, cn, getRoleColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User as UserIcon, ShieldAlert, AlertTriangle, Send } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function ThreadView() {
  const [, params] = useRoute("/thread/:id");
  const threadId = parseInt(params?.id || "0", 10);
  const { isAuthenticated, user: currentUser } = useAuth();
  const [replyContent, setReplyContent] = useState("");

  const { data, isLoading, refetch } = useGetThread(threadId, { page: 1 }, {
    query: { enabled: !!threadId }
  });

  const replyMutation = useCreatePost({
    mutation: {
      onSuccess: () => {
        setReplyContent("");
        refetch();
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
    }
  });

  if (isLoading) return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  if (!data) return <div className="text-center p-12 text-destructive">Signal lost. Thread not found.</div>;

  const { thread, posts } = data;

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || replyMutation.isPending) return;
    replyMutation.mutate({ data: { content: replyContent, threadId } });
  };

  return (
    <div className="space-y-6">
      {/* Thread Header */}
      <div className="pb-4 border-b border-white/10">
        <h1 className="text-3xl font-display font-bold text-white mb-2 break-words">{thread.title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{formatDate(thread.createdAt)}</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>{thread.viewCount} views</span>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-6">
        {posts.map((post, idx) => (
          <div key={post.id} className="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-lg flex flex-col md:flex-row" id={`post-${post.id}`}>
            
            {/* User Sidebar */}
            <div className="w-full md:w-56 shrink-0 bg-black/40 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-row md:flex-col items-center md:items-stretch gap-4 md:gap-0">
              <Link href={`/profile/${post.authorId}`} className="shrink-0">
                <div className="w-16 h-16 md:w-24 md:h-24 mx-auto rounded-lg border-2 border-primary/30 overflow-hidden bg-secondary box-glow-hover transition-shadow cursor-pointer">
                  {post.authorAvatarUrl ? (
                    <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-full h-full p-4 text-muted-foreground" />
                  )}
                </div>
              </Link>
              
              <div className="flex-1 min-w-0 md:text-center md:mt-4">
                <Link href={`/profile/${post.authorId}`} className="text-lg font-bold text-white hover:text-primary transition-colors truncate block">
                  {post.authorUsername}
                </Link>
                <div className={cn("text-xs font-bold uppercase tracking-widest mt-1 px-2 py-0.5 rounded border inline-block", getRoleColor(post.authorRole, post.authorUpgradeType))}>
                  {post.authorUpgradeType || post.authorRole}
                </div>
                
                <div className="hidden md:block mt-6 space-y-2 text-xs text-muted-foreground border-t border-white/10 pt-4">
                  <div className="flex justify-between">
                    <span>Posts</span>
                    <span className="font-mono text-white">{post.authorPostCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Joined</span>
                    <span className="font-mono text-white">{new Date(post.authorJoinedAt).getFullYear()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Post Content */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="px-6 py-3 border-b border-white/5 bg-white/[0.02] flex justify-between text-xs text-muted-foreground">
                <span className="hover:text-white transition-colors cursor-pointer">{formatDate(post.createdAt)}</span>
                <span className="font-mono opacity-50">#{idx + 1}</span>
              </div>
              <div className="p-6 text-gray-200 leading-relaxed whitespace-pre-wrap flex-1 prose prose-invert max-w-none">
                {post.content}
              </div>
              {post.authorRole === 'admin' && (
                <div className="px-6 py-3 bg-amber-500/5 border-t border-amber-500/10 flex items-center gap-2 text-xs text-amber-500/80">
                  <ShieldAlert className="w-4 h-4" /> Official Scootware Communication
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Reply Box */}
      {thread.isLocked ? (
        <div className="glass-panel p-8 text-center rounded-xl border-destructive/20 bg-destructive/5 flex flex-col items-center">
          <AlertTriangle className="w-12 h-12 text-destructive mb-3" />
          <h3 className="text-xl font-bold text-white mb-1">Thread Locked</h3>
          <p className="text-muted-foreground text-sm">No further signals can be transmitted here.</p>
        </div>
      ) : isAuthenticated ? (
        <div className="glass-panel rounded-xl p-1 shadow-2xl shadow-primary/10 border border-primary/20 bg-black/60 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent" />
          <form onSubmit={handleReply} className="flex flex-col">
            <textarea
              className="w-full bg-transparent border-0 text-white placeholder:text-muted-foreground p-5 min-h-[150px] resize-y focus:ring-0 focus:outline-none"
              placeholder="Draft your signal..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              disabled={replyMutation.isPending}
            />
            <div className="px-5 py-3 border-t border-white/10 bg-black/40 flex justify-between items-center">
              <span className="text-xs text-muted-foreground hidden sm:block">Transmissions are monitored. Keep it clean.</span>
              <Button type="submit" variant="glow" disabled={replyMutation.isPending || !replyContent.trim()} className="gap-2">
                {replyMutation.isPending ? "Transmitting..." : "Transmit"} <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="glass-panel p-8 text-center rounded-xl border-white/10">
          <p className="text-muted-foreground mb-4">You must be authenticated to transmit a signal.</p>
          <Link href="/login"><Button variant="outline">Initialize Login</Button></Link>
        </div>
      )}
    </div>
  );
}

import { db, threadsTable, postsTable, usersTable, subforumsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { User as UserIcon, ShieldAlert, AlertTriangle, Send, Lock, ChevronRight, Pin } from "lucide-react";
import { cn, formatDate, getRoleColor } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { createPostAction } from "@/actions/forum";
import { ReplyForm } from "@/components/forum/ReplyForm";
import { RoleStatusBadge } from "@/components/RoleStatusBadge";
import { redirect } from "next/navigation";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const threadId = parseInt(id);
  const user = await getCurrentUser();

  if (isNaN(threadId)) return notFound();

  // Increment view count
  await db.update(threadsTable).set({ viewCount: sql`${threadsTable.viewCount} + 1` }).where(eq(threadsTable.id, threadId));

  const [thread] = await db
    .select({
      id: threadsTable.id,
      title: threadsTable.title,
      subforumId: threadsTable.subforumId,
      authorId: threadsTable.authorId,
      replyCount: threadsTable.replyCount,
      viewCount: threadsTable.viewCount,
      isPinned: threadsTable.isPinned,
      isLocked: threadsTable.isLocked,
      createdAt: threadsTable.createdAt,
    })
    .from(threadsTable)
    .where(eq(threadsTable.id, threadId))
    .limit(1);

  if (!thread) return notFound();

  // Fetch Subforum for access control
  const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, thread.subforumId)).limit(1);
  if (subforum?.requiresUpgrade) {
    if (!user || (user.role !== "admin" && (!user.upgradeType || (user.upgradeExpiresAt && new Date(user.upgradeExpiresAt) < new Date())))) {
      return redirect(`/f/${subforum.id}`); // Redirect to subforum which handles access denied UI
    }
  }

  const posts = await db
    .select({
      id: postsTable.id,
      content: postsTable.content,
      createdAt: postsTable.createdAt,
      authorId: postsTable.authorId,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      authorRole: usersTable.role,
      authorUpgradeType: usersTable.upgradeType,
      authorPostCount: usersTable.postCount,
      authorJoinedAt: usersTable.createdAt,
    })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.threadId, threadId))
    .orderBy(asc(postsTable.createdAt));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-white transition-colors">Forum</Link>
        <ChevronRight className="w-4 h-4" />
        <Link href={`/f/${thread.subforumId}`} className="hover:text-white transition-colors capitalize">
          {subforum?.name || "Subforum"}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-primary font-medium truncate max-w-[200px]">{thread.title}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0 space-y-8">
          {/* Thread Header */}
          <div className="pb-6 border-b border-white/10 relative">
            <h1 className="text-4xl font-display font-bold text-white mb-3 break-words text-glow leading-tight">
              {thread.title}
            </h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground uppercase tracking-widest font-bold">
              <span className="flex items-center gap-1.5"><Pin className="w-3 h-3" /> {formatDate(thread.createdAt)}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary/30" />
              <span>{thread.viewCount} views</span>
              <span className="w-1.5 h-1.5 rounded-full bg-primary/30" />
              <span>{thread.replyCount} Signals</span>
            </div>
          </div>

          {/* Posts */}
          <div className="space-y-8">
            {posts.map((post: any, idx: number) => (
              <div 
                key={post.id} 
                className="glass-panel rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row relative" 
                id={`post-${post.id}`}
              >
                {post.authorRole === 'admin' && <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 box-glow" />}
                
                {/* User Sidebar */}
                <div className="w-full md:w-60 shrink-0 bg-black/40 border-b md:border-b-0 md:border-r border-white/5 p-8 flex flex-row md:flex-col items-center md:items-stretch gap-6 md:gap-0">
                  <div className="relative group">
                    <div className="w-20 h-20 md:w-32 md:h-32 mx-auto rounded-2xl border-2 border-primary/20 overflow-hidden bg-secondary box-glow group-hover:border-primary/50 transition-all duration-500">
                      {post.authorAvatarUrl ? (
                        <img src={post.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-full h-full p-6 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 md:text-center md:mt-6">
                    <Link href={`/profile/${post.authorId}`} className="text-xl font-bold text-white hover:text-primary transition-colors truncate block mb-2">
                      {post.authorUsername}
                    </Link>
                    <RoleStatusBadge role={post.authorRole || 'user'} upgradeType={post.authorUpgradeType} compact />
                    
                    <div className="hidden md:block mt-8 space-y-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-t border-white/10 pt-6">
                      <div className="flex justify-between items-center">
                        <span>Pulse Count</span>
                        <span className="font-mono text-primary">{post.authorPostCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Sync Year</span>
                        <span className="font-mono text-white">{post.authorJoinedAt ? new Date(post.authorJoinedAt).getFullYear() : "----"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="px-8 py-4 border-b border-white/5 bg-white/[0.03] flex justify-between text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                    <span className="hover:text-white transition-colors cursor-pointer">{formatDate(post.createdAt)}</span>
                    <span className="font-mono opacity-30 tracking-normal">SIGNAL #{idx + 1}</span>
                  </div>
                  <div className="p-8 text-gray-200 leading-relaxed whitespace-pre-wrap flex-1 prose prose-invert max-w-none text-base">
                    {post.content}
                  </div>
                  {post.authorRole === 'admin' && (
                    <div className="px-8 py-3 bg-amber-500/5 border-t border-amber-500/10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500/80">
                      <ShieldAlert className="w-4 h-4" /> Official Scootware Communication
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          {thread.isLocked ? (
            <div className="glass-panel p-12 text-center rounded-2xl border-destructive/20 bg-destructive/5 flex flex-col items-center">
              <AlertTriangle className="w-16 h-16 text-destructive mb-4 opacity-50" />
              <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Signal Terminal Locked</h3>
              <p className="text-muted-foreground max-w-md">The encryption keys for this thread have been revoked. No further transmissions are possible.</p>
            </div>
          ) : user ? (
            <ReplyForm threadId={threadId} />
          ) : (
            <div className="glass-panel p-12 text-center rounded-2xl border-white/10">
              <p className="text-muted-foreground mb-6 font-medium">Authentication required to transmit a signal to this terminal.</p>
              <Link href="/login"><Button variant="glow" size="lg">Initialize Auth</Button></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple internal helper for redirect handling

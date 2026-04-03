import { db, usersTable, threadsTable, postsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { User, Activity, Calendar, ShieldAlert, Upload, Send, MessageSquare } from "lucide-react";
import { cn, formatDate, getRoleColor } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = parseInt(id);
  const currentUser = await getCurrentUser();

  if (isNaN(userId)) return notFound();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return notFound();

  const isOwnProfile = currentUser?.id === user.id;
  const isAdmin = currentUser?.role === "admin";

  // Fetch recent forum activity (posts)
  const recentPosts = await db
    .select({
      id: postsTable.id,
      content: postsTable.content,
      createdAt: postsTable.createdAt,
      threadId: postsTable.threadId,
      threadTitle: threadsTable.title,
    })
    .from(postsTable)
    .leftJoin(threadsTable, eq(postsTable.threadId, threadsTable.id))
    .where(eq(postsTable.authorId, userId))
    .orderBy(desc(postsTable.createdAt))
    .limit(10);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="flex flex-col gap-12">
        
        {/* Profile Header */}
        <div className="glass-panel rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative">
          <div className="h-48 bg-gradient-to-r from-primary/40 via-accent/20 to-primary/40 relative">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-60"></div>
          </div>
          
          <div className="px-10 pb-10 pt-0 flex flex-col md:flex-row items-center md:items-end gap-8 -mt-20 relative z-10 text-center md:text-left">
            <div className="relative group">
              <div className="w-40 h-40 rounded-3xl border-4 border-background bg-secondary/80 backdrop-blur-md overflow-hidden box-glow shadow-2xl flex items-center justify-center">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-20 h-20 text-muted-foreground/50" />
                )}
              </div>
              {isOwnProfile && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-3xl cursor-pointer transition-all duration-300 backdrop-blur-sm border-2 border-primary/50">
                  <Upload className="w-8 h-8 text-white mb-2 animate-bounce" />
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Update Identity</span>
                </div>
              )}
            </div>

            <div className="flex-1 pb-2">
              <h1 className="text-5xl font-display font-black text-white text-glow mb-3 tracking-tighter uppercase">{user.username}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2">
                <div className={cn(
                  "text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border border-white/10 shadow-lg", 
                  getRoleColor(user.role || 'user', user.upgradeType)
                )}>
                  {user.upgradeType || user.role}
                </div>
                {user.isBanned && (
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] px-4 py-1.5 rounded-full border text-destructive bg-destructive/10 border-destructive/30 shadow-lg animate-pulse">
                    Banned
                  </div>
                )}
                <div className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                  <Calendar className="w-3.5 h-3.5 text-primary" /> Established {new Date(user.createdAt).getFullYear()}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 text-center pb-2">
              <div className="glass-panel px-8 py-5 rounded-2xl border-white/10 shadow-xl bg-primary/5">
                <div className="text-3xl font-mono text-white font-black tracking-tighter">{user.postCount}</div>
                <div className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] mt-1">Transmissions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Controls */}
        {isAdmin && !isOwnProfile && (
          <div className="glass-panel p-8 rounded-3xl border border-amber-500/30 bg-amber-500/5 shadow-2xl shadow-amber-500/5">
            <h3 className="text-amber-500 font-black uppercase tracking-[0.2em] flex items-center gap-3 mb-6"><ShieldAlert className="w-6 h-6" /> System Override Active</h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/20 px-8">Edit Subject Data</Button>
              {!user.isBanned ? (
                <Button variant="destructive" className="bg-red-500/20 text-red-500 hover:bg-red-500/40 border border-red-500/50 px-8">Terminate Access (Ban)</Button>
              ) : (
                <Button variant="outline" className="border-green-500/50 text-green-500 hover:bg-green-500/20 px-8">Restore Access</Button>
              )}
            </div>
          </div>
        )}

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Recent transmissions */}
          <div className="lg:col-span-2 space-y-8">
            <h2 className="text-2xl font-display font-black flex items-center gap-4 border-b border-white/10 pb-4 uppercase tracking-[0.1em]">
              <Activity className="w-6 h-6 text-primary" /> Transmission History
            </h2>

            <div className="space-y-4">
              {recentPosts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground italic border border-dashed border-white/10 rounded-3xl opacity-30">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  No confirmed signals on this frequency.
                </div>
              ) : (
                recentPosts.map((post: any) => (
                  <div key={post.id} className="glass-panel p-6 rounded-2xl border border-white/5 flex gap-6 hover:bg-white/[0.04] transition-all group">
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-secondary/50 flex items-center justify-center border border-white/10 group-hover:border-primary/30 transition-colors">
                      <MessageSquare className="w-6 h-6 text-primary/50 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <Link href={`/t/${post.threadId}`} className="font-bold text-white text-lg hover:text-primary transition-colors truncate">
                          {post.threadTitle}
                        </Link>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">{formatDate(post.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed italic">"{post.content}"</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            <h2 className="text-2xl font-display font-black flex items-center gap-4 border-b border-white/10 pb-4 uppercase tracking-[0.1em]">
              <ShieldAlert className="w-6 h-6 text-accent" /> Identity Status
            </h2>
            
            <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
               <div className="space-y-1">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Current Rank</div>
                  <div className={cn("text-xl font-bold uppercase", getRoleColor(user.role || 'user', user.upgradeType).split(' ')[0])}>
                     {user.upgradeType || user.role}
                  </div>
               </div>
               
               <div className="h-px bg-white/5" />
               
               <div className="space-y-1">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Sync Status</div>
                  <div className="text-white font-bold flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                     ONLINE_ENCRYPTED
                  </div>
               </div>

               <div className="h-px bg-white/5" />

               <div className="space-y-4 pt-2">
                  <Button className="w-full bg-secondary hover:bg-white/10 border border-white/10 justify-start h-12 px-6 gap-4">
                     <User className="w-5 h-5 text-primary" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Send Direct Ping</span>
                  </Button>
                  <Button className="w-full bg-secondary hover:bg-white/10 border border-white/10 justify-start h-12 px-6 gap-4">
                     <Activity className="w-5 h-5 text-accent" />
                     <span className="text-[10px] font-black uppercase tracking-widest">Compare Signals</span>
                  </Button>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

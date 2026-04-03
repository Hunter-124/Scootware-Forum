import { db, subforumsTable, threadsTable, usersTable, categoriesTable } from "@workspace/db";
import { eq, desc, sql, asc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare, Lock, Pin, User, ChevronRight, PlusCircle, Zap } from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";
import { Button } from "@/components/ui/button";

export default async function SubforumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subforumId = parseInt(id);
  const user = await getCurrentUser();

  if (isNaN(subforumId)) return notFound();

  const [subforum] = await db.select().from(subforumsTable).where(eq(subforumsTable.id, subforumId)).limit(1);
  if (!subforum) return notFound();

  // Access Control check
  if (subforum.requiresUpgrade) {
    if (!user) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
           <div className="glass-panel p-12 rounded-2xl border-white/10 shadow-2xl">
              <Lock className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
              <h1 className="text-3xl font-display font-bold text-white mb-2">RESTRICTED SECTOR</h1>
              <p className="text-muted-foreground mb-6">You must be logged in and possess an upgraded account to access these signals.</p>
              <div className="flex justify-center gap-4">
                 <Link href="/login"><Button variant="glow">Authenticate</Button></Link>
                 <Link href="/products"><Button variant="outline">View Upgrades</Button></Link>
              </div>
           </div>
        </div>
      );
    }
    
    if (user.role !== "admin" && (!user.upgradeType || (user.upgradeExpiresAt && new Date(user.upgradeExpiresAt) < new Date()))) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-2xl text-center">
           <div className="glass-panel p-12 rounded-2xl border-white/10 shadow-2xl">
              <Zap className="w-16 h-16 text-accent mx-auto mb-4 animate-pulse" />
              <h1 className="text-3xl font-display font-bold text-white mb-2">UPGRADE REQUIRED</h1>
              <p className="text-muted-foreground mb-6">This subforum is reserved for our Premium members. Upgrade your account to gain access.</p>
              <Link href="/products"><Button variant="glow">Upgrade Now</Button></Link>
           </div>
        </div>
      );
    }
  }

  const threads = await db
    .select({
      id: threadsTable.id,
      title: threadsTable.title,
      authorId: threadsTable.authorId,
      authorUsername: usersTable.username,
      authorAvatarUrl: usersTable.avatarUrl,
      replyCount: threadsTable.replyCount,
      viewCount: threadsTable.viewCount,
      isPinned: threadsTable.isPinned,
      isLocked: threadsTable.isLocked,
      createdAt: threadsTable.createdAt,
      lastPostAt: threadsTable.lastPostAt,
    })
    .from(threadsTable)
    .leftJoin(usersTable, eq(threadsTable.authorId, usersTable.id))
    .where(eq(threadsTable.subforumId, subforumId))
    .orderBy(desc(threadsTable.isPinned), desc(threadsTable.lastPostAt));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header / Breadcrumbs */}
      <div className="glass-panel p-6 rounded-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-white transition-colors">Forum</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-primary font-medium">{subforum.name}</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            {subforum.name}
            {subforum.requiresUpgrade && <span className="text-[10px] uppercase bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 tracking-widest align-middle font-bold">Restricted</span>}
          </h1>
          <p className="text-muted-foreground mt-2">{subforum.description}</p>
        </div>
        
        {user && !subforum.isReadOnly && (
          <Link href={`/f/${subforumId}/new`}>
            <Button variant="glow" className="gap-2">
              <PlusCircle className="w-4 h-4" /> Initialize Thread
            </Button>
          </Link>
        )}
      </div>

      {/* Threads List */}
      <div className="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-xl">
        <div className="bg-black/40 px-6 py-4 border-b border-white/5 grid grid-cols-12 gap-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
          <div className="col-span-8 md:col-span-6 lg:col-span-7">Signal Origin</div>
          <div className="hidden md:block col-span-2 text-center">Pulse Statistics</div>
          <div className="col-span-4 md:col-span-4 lg:col-span-3 text-right">Latest Transmission</div>
        </div>

        <div className="divide-y divide-white/5">
          {threads.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground italic flex flex-col items-center">
              <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-lg">No signals detected in this sector.</p>
              <p className="text-sm opacity-50 mt-2">The silence is deafening.</p>
            </div>
          ) : (
            threads.map((thread: any) => (
              <Link 
                key={thread.id} 
                href={`/t/${thread.id}`} 
                className="grid grid-cols-12 gap-4 p-5 hover:bg-white/[0.04] transition-all duration-300 items-center group relative overflow-hidden"
              >
                {thread.isPinned && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent box-glow" />}
                
                <div className="col-span-8 md:col-span-6 lg:col-span-7 flex items-center gap-5">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-secondary/50 border border-white/10 flex items-center justify-center overflow-hidden group-hover:border-primary/50 transition-colors">
                    {thread.authorAvatarUrl ? (
                      <img src={thread.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      {thread.isPinned && <Pin className="w-3.5 h-3.5 text-accent fill-accent animate-pulse" />}
                      {thread.isLocked && <Lock className="w-3.5 h-3.5 text-destructive" />}
                      <h3 className={cn(
                        "text-lg font-bold truncate transition-colors", 
                        thread.isPinned ? "text-accent text-glow-accent" : "text-gray-100 group-hover:text-primary"
                      )}>
                        {thread.title}
                      </h3>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>By <span className="text-primary font-bold">{thread.authorUsername}</span></span>
                      <span className="opacity-30">•</span>
                      <span>{formatShortDate(thread.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="hidden md:flex col-span-2 flex-col items-center justify-center text-xs">
                  <div className="flex items-center gap-1.5"><span className="text-white font-mono font-bold">{thread.replyCount}</span> <span className="text-muted-foreground uppercase text-[10px] tracking-widest">Replies</span></div>
                  <div className="flex items-center gap-1.5 mt-1"><span className="text-white font-mono font-bold">{thread.viewCount}</span> <span className="text-muted-foreground uppercase text-[10px] tracking-widest">Views</span></div>
                </div>
                
                <div className="col-span-4 md:col-span-4 lg:col-span-3 text-right">
                  <div className="text-sm font-medium text-gray-200">{formatShortDate(thread.lastPostAt)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Time Stamped</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

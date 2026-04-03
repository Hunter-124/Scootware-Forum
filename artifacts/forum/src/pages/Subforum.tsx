import React from "react";
import { useRoute, Link } from "wouter";
import { useGetSubforum, useGetThreads } from "@workspace/api-client-react";
import { formatShortDate, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageSquare, Lock, Pin, User, ChevronRight, PlusCircle, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Shoutbox } from "@/components/layout/Shoutbox";

export default function Subforum() {
  const [, params] = useRoute("/forum/:id");
  const subforumId = parseInt(params?.id || "0", 10);
  
  // Fetch subforum details via proper API endpoint
  const { data: subforum, isLoading: subforumLoading } = useGetSubforum(
    subforumId,
    { query: { enabled: !!subforumId } as any }
  );
  
  const productId = subforum?.productId ?? undefined;
  const isConfigSection = /config/i.test(subforum?.name || "");
  const { isAuthenticated, isSubscribed } = useAuth();

  const { data, isLoading, error } = useGetThreads({ subforumId, page: 1 }, {
    query: { enabled: !!subforumId } as any,
    retry: false
  } as any);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="glass-panel p-12 text-center rounded-2xl border-destructive/30">
          <Lock className="w-16 h-16 text-destructive mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-display font-bold text-white mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">{(error as any).error || "You do not have clearance for this sector."}</p>
          <Link href="/store"><Button variant="glow">View Upgrade Options</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 w-full">
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div className="glass-panel p-6 rounded-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link href="/" className="hover:text-white transition-colors">Forum</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-primary font-medium">{subforum?.name || "Loading..."}</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
              {subforum?.name}
              {subforum?.requiresUpgrade && <span className="text-xs uppercase bg-accent/20 text-accent px-2 py-1 rounded border border-accent/30 tracking-widest align-middle">Restricted</span>}
            </h1>
            <p className="text-muted-foreground mt-2">{subforum?.description}</p>
          </div>
          
          {isAuthenticated && (
            !isConfigSection || isSubscribed(productId) ? (
              <Link href={`/forum/${subforumId}/new`}>
                <Button variant="glow" className="gap-2">
                  <PlusCircle className="w-4 h-4" /> Initialize Thread
                </Button>
              </Link>
            ) : (
              <Button variant="outline" disabled className="gap-2" title="Subscribe to contribute">
                <PlusCircle className="w-4 h-4" /> Restricted — Subscribe
              </Button>
            )
          )}

          {isConfigSection && !isSubscribed(productId) && (
            <div className="mt-3 text-sm text-muted-foreground italic">This configuration section is read-only. Subscribe to the product to contribute.</div>
          )}
        </div>

        {/* Threads List */}
        <div className={cn(
          "glass-panel rounded-xl overflow-hidden border border-white/10 shadow-xl",
          subforum?.name === "Feature Showcase" ? "bg-transparent border-none shadow-none" : ""
        )}>
          {subforum?.name !== "Feature Showcase" && (
            <div className="bg-black/40 px-6 py-3 border-b border-white/5 grid grid-cols-12 gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-8 md:col-span-6 lg:col-span-7">Signal Origin</div>
              <div className="hidden md:block col-span-2 text-center">Stats</div>
              <div className="col-span-4 md:col-span-4 lg:col-span-3 text-right">Last Ping</div>
            </div>
          )}

          <div className={cn(
            "divide-y divide-white/5",
            subforum?.name === "Feature Showcase" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 divide-none" : ""
          )}>
            {isLoading ? (
              Array(6).fill(0).map((_, i) => (
                <div key={i} className={cn(
                  "bg-white/5 animate-pulse rounded-xl",
                  subforum?.name === "Feature Showcase" ? "h-64" : "h-20"
                )} />
              ))
            ) : data?.threads.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic flex flex-col items-center col-span-full">
                <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                No signals detected in this sector.
              </div>
            ) : subforum?.name === "Feature Showcase" ? (
              data?.threads.map((thread) => (
                <Link key={thread.id} href={`/thread/${thread.id}`} className="group relative glass-panel rounded-2xl overflow-hidden border border-white/10 hover:border-primary/50 transition-all duration-500 hover:scale-[1.02] flex flex-col">
                  {/* Media Placeholder Grid */}
                  <div className="aspect-video bg-black/60 relative overflow-hidden group-hover:bg-black/40 transition-colors">
                     <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                        <Zap className="w-12 h-12 text-primary" />
                     </div>
                     <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-widest border border-white/10">
                        Showcase Clip
                     </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-secondary border border-white/10 overflow-hidden">
                          {thread.authorAvatarUrl ? <img src={thread.authorAvatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-1 text-muted-foreground" />}
                       </div>
                       <span className="text-xs font-bold text-primary">{thread.authorUsername}</span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-white group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                      {thread.title}
                    </h3>
                    
                    <div className="mt-auto pt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">
                       <span className="flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> {thread.replyCount} Signals</span>
                       <span>{formatShortDate(thread.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              data?.threads.map((thread) => (
                <Link key={thread.id} href={`/thread/${thread.id}`} className="grid grid-cols-12 gap-4 p-4 hover:bg-white/[0.03] transition-colors items-center group">
                  <div className="col-span-8 md:col-span-6 lg:col-span-7 flex items-center gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-secondary border border-white/10 flex items-center justify-center overflow-hidden">
                      {thread.authorAvatarUrl ? (
                        <img src={thread.authorAvatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {thread.isPinned && <Pin className="w-3 h-3 text-accent fill-accent" />}
                        {thread.isLocked && <Lock className="w-3 h-3 text-destructive" />}
                        <h3 className={cn("text-base font-bold truncate transition-colors", thread.isPinned ? "text-accent group-hover:text-accent-foreground" : "text-gray-200 group-hover:text-white")}>
                          {thread.title}
                        </h3>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span>Initiated by <span className="text-primary font-medium">{thread.authorUsername}</span></span>
                        <span>•</span>
                        <span>{formatShortDate(thread.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="hidden md:flex col-span-2 flex-col items-center justify-center text-xs text-muted-foreground">
                    <div><span className="text-white font-mono">{thread.replyCount}</span> replies</div>
                    <div><span className="text-white font-mono">{thread.viewCount}</span> views</div>
                  </div>
                  
                  <div className="col-span-4 md:col-span-4 lg:col-span-3 text-right flex flex-col justify-center">
                    <div className="text-sm text-gray-300 truncate">{formatShortDate(thread.lastPostAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-24">
            <Shoutbox />
          </div>
        </aside>
      )}
    </div>
  );
}

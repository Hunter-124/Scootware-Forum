import React from "react";
import { Link } from "wouter";
import { useGetCategories } from "@workspace/api-client-react";
import { MessageSquare, Users, Zap, ShieldAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  const { data: categories, isLoading } = useGetCategories();

  return (
    <div className="flex flex-col gap-12">
      {/* Hero Section */}
      <section className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-primary/20 min-h-[380px] md:min-h-[460px] flex items-center">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
          alt="Cybernetic grid background" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        
        <div className="relative z-10 p-8 md:p-14 w-full flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Logo block */}
          <div className="flex flex-col items-center shrink-0 md:items-start">
            <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 border-primary/50 shadow-[0_0_40px_rgba(168,85,247,0.4)] bg-black/60 flex items-center justify-center">
              <img 
                src={`${import.meta.env.BASE_URL}images/logo.png`} 
                alt="Scootware Logo" 
                className="w-24 h-24 md:w-32 md:h-32 object-contain"
              />
            </div>
            <span className="mt-3 font-display font-extrabold text-lg md:text-xl tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 uppercase">
              SCOOTWARE
            </span>
          </div>

          {/* Text block */}
          <div className="max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-bold tracking-widest mb-5 uppercase">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> System Online
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-extrabold mb-4 text-glow tracking-tight text-white leading-tight">
              DOMINATE THE <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">GAME.</span>
            </h1>
            <p className="text-lg text-gray-300 mb-8 max-w-lg font-light">
              Squeeze every last frame out of your hardware. Scootware's precision-tuned driver suite is engineered for competitive gaming — maximum performance, zero compromise.
            </p>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              <Link href="/upgrades">
                <Button variant="glow" size="lg" className="font-bold tracking-wide">GET ACCESS <Zap className="ml-2 w-5 h-5" /></Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Forum Categories */}
      <section className="flex flex-col gap-8">
        <div className="flex items-center gap-3 pb-2 border-b border-white/10">
          <Cpu className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-display font-bold">SYSTEM DIRECTORY</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white/5 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {categories?.map((category) => (
              <div key={category.id} className="glass-panel rounded-xl overflow-hidden shadow-lg border border-white/10">
                <div className="bg-black/40 px-6 py-4 border-b border-white/5 flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
                  <h3 className="text-xl font-display font-bold text-white tracking-wide">{category.name}</h3>
                  {category.description && (
                    <span className="text-sm text-muted-foreground ml-2 hidden md:inline-block">— {category.description}</span>
                  )}
                </div>
                
                <div className="divide-y divide-white/5">
                  {category.subforums.map((sub) => (
                    <Link key={sub.id} href={`/forum/${sub.id}`} className="flex flex-col sm:flex-row items-start sm:items-center p-6 hover:bg-white/[0.02] transition-colors group">
                      <div className="flex-1 min-w-0 flex items-center gap-4 mb-4 sm:mb-0">
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex items-center justify-center border transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
                          sub.requiresUpgrade ? "bg-accent/10 border-accent/30 text-accent group-hover:bg-accent/20 group-hover:shadow-[0_0_15px_rgba(217,70,239,0.3)]" : "bg-primary/10 border-primary/30 text-primary group-hover:bg-primary/20 group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                        )}>
                          {sub.requiresUpgrade ? <ShieldAlert className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                        </div>
                        <div>
                          <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                            {sub.name}
                            {sub.requiresUpgrade && <span className="text-[10px] uppercase bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/30 tracking-widest">Restricted</span>}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">{sub.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-8 w-full sm:w-auto sm:pl-4 justify-between sm:justify-end">
                        <div className="flex gap-6 text-sm text-muted-foreground">
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-white font-bold">{sub.threadCount.toLocaleString()}</span>
                            <span className="text-xs uppercase tracking-wider">Threads</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-mono text-white font-bold">{sub.postCount.toLocaleString()}</span>
                            <span className="text-xs uppercase tracking-wider">Posts</span>
                          </div>
                        </div>
                        
                        <div className="w-48 text-right hidden lg:block">
                          {sub.lastPost ? (
                            <div className="text-sm">
                              <div className="truncate text-gray-300 group-hover:text-white transition-colors">{sub.lastPost.threadTitle}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                by <span className="text-primary">{sub.lastPost.username}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">No signals</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {category.subforums.length === 0 && (
                    <div className="p-6 text-center text-muted-foreground italic">Category empty</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

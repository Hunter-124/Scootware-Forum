import React from "react";
import { Link } from "wouter";
import { useGetCategories } from "@workspace/api-client-react";
import { MessageSquare, Users, Zap, ShieldAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRODUCT_ICONS, PRODUCT_IMAGES } from "@/lib/product-assets";
import { useAuth } from "@/hooks/use-auth";

import { Shoutbox } from "@/components/layout/Shoutbox";
import { AdBanner } from "@/components/layout/AdBanner";

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: categories, isLoading } = useGetCategories({
    query: {
      staleTime: 60000,
      retry: false,
    } as any
  });

  const { leftCol, rightCol } = React.useMemo(() => {
    if (!categories) return { leftCol: [], rightCol: [] };

    const find = (id: string, n?: string) => categories.find((c: any) => c.productId === id || c.name === n);
    
    // Strategic split to balance subforum counts (7 vs 7) and eliminate vertical gaps
    const left = [
      find("", "General Discussions"),
      find("SPOOFER"),
      find("BODYCAM"),
      find("DAYZ")
    ].filter(Boolean);

    const right = [
      find("", "Product Support"),
      find("TARKOV"),
      find("RUST")
    ].filter(Boolean);

    return { leftCol: left, rightCol: right };
  }, [categories]);

  const renderCategoryCard = (category: any) => (
    <div key={category.id} className="glass-panel rounded-xl flex flex-col overflow-hidden shadow-lg border border-white/10 transition-all hover:border-primary/30 group/card bg-black/20">
      <div className="relative h-32 overflow-hidden border-b border-white/5">
        <img 
          src={`${import.meta.env.BASE_URL}${PRODUCT_IMAGES[(category as any).productId] || PRODUCT_IMAGES.DEFAULT}`} 
          className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover/card:scale-110" 
          alt={category.name} 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-4 left-6 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-background/60 backdrop-blur-md border border-white/10 text-primary">
            {React.cloneElement((PRODUCT_ICONS[(category as any).productId] || PRODUCT_ICONS.DEFAULT) as React.ReactElement<any>, { className: "w-5 h-5" })}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-display font-bold text-white tracking-wide truncate drop-shadow-lg">
              {category.name.replace(" Discussions", "")}
            </h3>
            {category.description && (
              <p className="text-[10px] uppercase font-bold text-gray-300 truncate tracking-widest opacity-80">{category.description}</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col gap-2 p-3 bg-white/[0.01]">
        {(category as any).subforums
          .filter((sub: any) => !((category as any).productId === "SPOOFER" && sub.name === "Community Configs"))
          .map((sub: any) => {
            return (
              <Link
                key={sub.id}
                href={`/forum/${sub.id}`}
                className="flex items-center p-3 hover:bg-white/[0.04] bg-white/[0.02] border border-white/5 transition-colors group rounded-lg relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-primary/50 transition-colors" />
                <div className={cn(
                  "w-10 h-10 shrink-0 rounded-md flex items-center justify-center border transition-all duration-300 group-hover:scale-110",
                  sub.requiresUpgrade ? "bg-accent/10 border-accent/20 text-accent" : "bg-primary/10 border-primary/20 text-primary"
                )}>
                  {sub.requiresUpgrade ? <ShieldAlert className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                </div>
                
                <div className="ml-4 flex-1 min-w-0">
                  <h4 className="text-base font-bold text-white group-hover:text-primary transition-colors flex items-center gap-2">
                    <span className="truncate">{sub.name}</span>
                    {sub.requiresUpgrade && <span className="text-[9px] uppercase bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/30 tracking-widest shrink-0">Restricted</span>}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub.description}</p>
                </div>
                
                <div className="ml-4 hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex flex-col items-center justify-center min-w-[40px] bg-black/20 rounded px-2 py-1">
                    <span className="text-white font-mono font-bold">{sub.threadCount}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center min-w-[40px] bg-black/20 rounded px-2 py-1">
                    <span className="text-white font-mono font-bold">{sub.postCount}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        {category.subforums.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground italic border border-dashed border-white/10 rounded-lg">No sub-sectors available</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col gap-12">
      {/* Top Row: Conditional layout based on auth */}
      <div className="flex flex-col lg:flex-row gap-8">
        {isAuthenticated ? (
          <>
            {/* Logged in: Larger Shoutbox on left */}
            <div className="flex-1 min-w-0">
              <div className="sticky top-24">
                <Shoutbox />
              </div>
            </div>
            {/* Right sidebar: Ad banner */}
            <aside className="hidden lg:block w-80 shrink-0">
              <div className="sticky top-24">
                <AdBanner className="h-[600px]" />
              </div>
            </aside>
          </>
        ) : (
          <>
            {/* Not logged in: Hero section */}
            <div className="flex-1 min-w-0">
              <section className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-primary/20 min-h-[380px] md:min-h-[460px] flex items-center h-full">
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
                      <Link href="/store">
                        <Button variant="glow" size="lg" className="font-bold tracking-wide">GET ACCESS <Zap className="ml-2 w-5 h-5" /></Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      {/* Forum Content */}
      <section className="flex flex-col gap-8">
        <div className="flex items-center gap-3 pb-2 border-b border-white/10">
          <Cpu className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-display font-bold">SYSTEM DIRECTORY</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-white/5 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left Column (balanced height) */}
            <div className="flex flex-col gap-4 flex-1">
              {leftCol.map(renderCategoryCard)}
            </div>
            
            {/* Right Column (balanced height) */}
            <div className="flex flex-col gap-4 flex-1">
              {rightCol.map(renderCategoryCard)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

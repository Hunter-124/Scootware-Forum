import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User as UserIcon, Shield, Sparkles, MessageSquare, Download, Settings, BookOpen } from "lucide-react";
import { cn, getRoleColor, formatUpgradeDisplay } from "@/lib/utils";
import { Shoutbox } from "./Shoutbox";
import { RoleStatusBadge } from "../RoleStatusBadge";
import { motion, AnimatePresence } from "framer-motion";

function SubscriptionTags({ user, role }: { user: any, role: string }) {
  const [showAll, setShowAll] = useState(false);
  
  // Consolidate unique active subscriptions
  const allTags = React.useMemo(() => {
    if (!user) return [];
    const set = new Set<string>();
    if (user.upgradeType) set.add(user.upgradeType);
    if (user.productAccess && Array.isArray(user.productAccess)) {
      const now = new Date();
      user.productAccess.forEach((p: any) => {
        if (new Date(p.expiresAt) > now) {
          set.add(p.productId);
        }
      });
    }
    return Array.from(set);
  }, [user]);

  const [visibleCount, setVisibleCount] = useState(allTags.length);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const shadowRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current || !shadowRef.current || allTags.length === 0) return;

    const calculateVisibleTags = () => {
      const containerWidth = containerRef.current!.offsetWidth;
      const shadowChildren = Array.from(shadowRef.current!.children) as HTMLElement[];
      const moreTagWidth = 40; // Approx width of "..." tag + gap
      const spacing = 8; // Gap between tags

      let currentWidth = 0;
      let count = 0;

      for (let i = 0; i < shadowChildren.length; i++) {
        const tagWidth = shadowChildren[i].offsetWidth;
        const totalWithThisTag = currentWidth + tagWidth + (count > 0 ? spacing : 0);
        
        // If this is the last tag, we don't need room for "..."
        const isLastTag = i === shadowChildren.length - 1;
        const widthNeeded = isLastTag ? totalWithThisTag : totalWithThisTag + spacing + moreTagWidth;

        if (widthNeeded <= containerWidth) {
          currentWidth = totalWithThisTag;
          count++;
        } else {
          // If we can't fit any more + "...", see if we can fit the very last tag uniquely?
          // No, that's already handled by isLastTag check above.
          break;
        }
      }
      
      // If we only fit part but everything would fit without "...", re-check.
      if (count < shadowChildren.length) {
         let fullWidth = 0;
         shadowChildren.forEach((child, idx) => {
           fullWidth += child.offsetWidth + (idx > 0 ? spacing : 0);
         });
         if (fullWidth <= containerWidth) {
           count = shadowChildren.length;
         }
      }

      setVisibleCount(count);
    };

    const observer = new ResizeObserver(() => {
      calculateVisibleTags();
    });

    observer.observe(containerRef.current);
    calculateVisibleTags(); // Initial calculation

    return () => observer.disconnect();
  }, [allTags]);

  if (allTags.length === 0) return null;

  const visibleTags = allTags.slice(0, visibleCount);
  const remainingTags = allTags.slice(visibleCount);

  return (
    <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden justify-end" ref={containerRef}>
      {/* Hidden measurement container */}
      <div 
        ref={shadowRef} 
        className="absolute invisible pointer-events-none flex items-center gap-2"
        style={{ whiteSpace: 'nowrap' }}
      >
        {allTags.map((tag) => (
          <RoleStatusBadge key={tag} role={role} upgradeType={tag} compact showIcon={false} />
        ))}
      </div>

      {/* Visible tags */}
      {visibleTags.map((tag) => (
        <RoleStatusBadge key={tag} role={role} upgradeType={tag} compact showIcon={false} />
      ))}
      
      {remainingTags.length > 0 && (
        <div 
          className="relative cursor-help shrink-0"
          onMouseEnter={() => setShowAll(true)}
          onMouseLeave={() => setShowAll(false)}
        >
          <div className="px-2 py-1 rounded-md border border-white/10 bg-white/5 text-[11px] font-bold text-muted-foreground hover:text-white transition-colors">
            ...
          </div>
          
          <AnimatePresence>
            {showAll && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full mt-2 right-0 glass-panel border border-white/10 p-2 flex flex-col gap-1.5 z-[100] min-w-[120px] shadow-2xl"
              >
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest px-2 mb-1 border-b border-white/5 pb-1">
                  More Active Subscriptions
                </div>
                {remainingTags.map((tag) => (
                  <RoleStatusBadge key={tag} role={role} upgradeType={tag} compact showIcon={false} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAdmin, invalidateAuth } = useAuth();
  const logout = useLogout();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shoutboxOpen, setShoutboxOpen] = useState(false);

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to log out?");
    if (!confirmed) return;
    await logout.mutateAsync();
    invalidateAuth();
    // Reload the page to ensure auth state is cleared everywhere
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 shrink-0">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-8 h-8 rounded overflow-hidden flex items-center justify-center bg-primary/20 border border-primary/50 group-hover:box-glow transition-all duration-300">
                 <img src={`${import.meta.env.BASE_URL}images/logo.png`} alt="Logo" className="w-6 h-6 object-contain" />
              </div>
              <span className="font-display font-bold text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 group-hover:from-primary group-hover:to-accent transition-all duration-300">
                SCOOTWARE
              </span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              <Link href="/" className="px-4 py-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Forum
              </Link>
              <Link href="/products" className="px-4 py-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> Products
              </Link>
              <Link href="/loader" className="px-4 py-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" /> Loader
              </Link>
              <Link href="/docs/lua" className="px-4 py-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" /> Lua Docs
              </Link>
            </nav>
          </div>

          <div className="flex-1 flex items-center justify-end gap-4 min-w-0 h-full">
            {isAuthenticated && <SubscriptionTags user={user} role={user.role} />}
            
            <div className="flex items-center gap-4 shrink-0">
              {isAuthenticated ? (
                <div className="hidden md:flex items-center gap-4">
                {(isAdmin || (user?.role === 'mod')) && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">
                      <Shield className="w-4 h-4" /> Panel
                    </Button>
                  </Link>
                )}
                
                <Link href={`/profile/${user?.id}`}>
                  <div className="flex items-center gap-3 cursor-pointer group px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2 hidden lg:flex">
                      <span className="text-white font-bold">{user?.username}</span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 shrink-0", getRoleColor(user?.role || "user"))}>
                        {user?.role}
                      </span>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-secondary border-2 border-primary/30 overflow-hidden group-hover:border-primary transition-colors">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-full h-full p-2 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </Link>

                <Link href="/account">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                    <Settings className="w-5 h-5" />
                  </Button>
                </Link>

                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                  <LogOut className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link href="/login">
                  <Button variant="ghost" className="text-muted-foreground hover:text-white">Log in</Button>
                </Link>
                <Link href="/register">
                  <Button variant="glow">Register</Button>
                </Link>
              </div>
            )}

            {/* Mobile Toggles */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShoutboxOpen(!shoutboxOpen)}>
              <MessageSquare className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-white/10 bg-card/95 backdrop-blur-xl overflow-hidden"
            >
              <div className="p-4 flex flex-col gap-3">
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Forum
                </Link>
                <Link href="/products" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" /> Products
                </Link>
                <Link href="/loader" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" /> Loader
                </Link>
                <Link href="/docs/lua" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" /> Lua Documentation
                </Link>
                
                {isAuthenticated ? (
                  <>
                    <div className="h-px bg-white/10 my-2" />
                    <Link href={`/profile/${user?.id}`} onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-3">
                       <UserIcon className="w-5 h-5" /> Profile
                    </Link>
                    <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-3">
                       <Settings className="w-5 h-5" /> Account Settings
                    </Link>
                    {isAdmin && (
                      <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium text-amber-500 flex items-center gap-3">
                        <Shield className="w-5 h-5" /> Admin Panel
                      </Link>
                    )}
                    <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium text-destructive text-left flex items-center gap-3">
                      <LogOut className="w-5 h-5" /> Logout
                    </button>
                  </>
                ) : (
                  <>
                    <div className="h-px bg-white/10 my-2" />
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="secondary" className="w-full">Log in</Button>
                      </Link>
                      <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="glow" className="w-full">Register</Button>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-1 w-full relative">
        {children}
      </main>

      {/* Mobile Floating Shoutbox Drawer */}
      <AnimatePresence>
        {shoutboxOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setShoutboxOpen(false)}
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-sm bg-card border-l border-white/10 z-50 p-4 shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-lg">Live Comms</h3>
                <Button variant="ghost" size="icon" onClick={() => setShoutboxOpen(false)}>✕</Button>
              </div>
              <Shoutbox hideHeader />
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <footer className="border-t border-white/5 py-8 mt-auto glass-panel">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Scootware. Aggressive performance software.</p>
        </div>
      </footer>
    </div>
  );
}

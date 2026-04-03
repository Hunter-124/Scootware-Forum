import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User as UserIcon, Shield, Sparkles, MessageSquare, Download, Settings } from "lucide-react";
import { cn, getRoleColor } from "@/lib/utils";
import { Shoutbox } from "./Shoutbox";
import { motion, AnimatePresence } from "framer-motion";

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
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
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
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="hidden md:flex items-center gap-4">
                {isAdmin && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">
                      <Shield className="w-4 h-4" /> Admin
                    </Button>
                  </Link>
                )}
                
                <Link href={`/profile/${user?.id}`}>
                  <div className="flex items-center gap-3 cursor-pointer group px-2 py-1 rounded-md hover:bg-white/5 transition-colors">
                    <div className="text-right hidden lg:block">
                      <span className="text-white font-bold">{user?.username}</span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10", getRoleColor(user?.role || "user", user?.upgradeType))}>
                        {user?.upgradeType || user?.role}
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

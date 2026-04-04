"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, User as UserIcon, Shield, Sparkles, MessageSquare, Download, X } from "lucide-react";
import { cn, getRoleColor } from "@/lib/utils";
import { RoleStatusBadge } from "@/components/RoleStatusBadge";
import { motion, AnimatePresence } from "framer-motion";
import { logoutAction } from "@/actions/auth";
import { useRouter } from "next/navigation";

interface NavbarProps {
  user: any;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export function Navbar({ user, isAuthenticated, isAdmin }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    const confirmed = window.confirm("Are you sure you want to log out?");
    if (!confirmed) return;
    await logoutAction();
    // Reload the page to ensure auth state is cleared everywhere
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-8 h-8 rounded overflow-hidden flex items-center justify-center bg-primary/20 border border-primary/50 group-hover:box-glow transition-all duration-300">
               <img src="/images/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="font-display font-bold text-xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 group-hover:from-primary group-hover:to-accent transition-all duration-300">
              SCOOTWARE
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link href="/" className="px-4 py-2 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">Forum</Link>
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
                    <div className="text-white font-bold leading-none mb-1">{user?.username}</div>
                    <RoleStatusBadge role={user?.role || "user"} upgradeType={user?.upgradeType} compact />
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
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium text-muted-foreground hover:text-white transition-colors">Forum</Link>
              <Link href="/products" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-2 text-muted-foreground hover:text-white transition-colors">
                <Sparkles className="w-4 h-4 text-accent" /> Products
              </Link>
              <Link href="/loader" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-2 text-muted-foreground hover:text-white transition-colors">
                <Download className="w-4 h-4 text-primary" /> Loader
              </Link>
              
              {isAuthenticated ? (
                <>
                  <div className="h-px bg-white/10 my-2" />
                  <Link href={`/profile/${user?.id}`} onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 rounded-md hover:bg-white/5 font-medium flex items-center gap-3 text-muted-foreground hover:text-white transition-colors">
                     <UserIcon className="w-5 h-5" /> Profile
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
  );
}

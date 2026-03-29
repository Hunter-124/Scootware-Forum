import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "Unknown date";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatShortDate(dateString: string | undefined | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = Math.abs(now.getTime() - date.getTime()) / 3600000;
  
  if (diffHours < 24) {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round(diffHours), 'hour');
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function getRoleColor(role: string, upgradeType?: string | null) {
  if (role === 'admin') return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  if (upgradeType === 'lifetime') return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
  if (upgradeType === 'premium') return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
  if (upgradeType === 'basic') return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
}

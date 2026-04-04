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
  const diffMinutes = Math.abs(now.getTime() - date.getTime()) / 60000;
  
  if (diffMinutes < 1440) {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.round(diffMinutes), 'minute');
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

export function getRoleColor(role: string, upgradeType?: string | null) {
  if (role === 'admin') return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  if (upgradeType?.includes('LIFETIME')) return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
  if (upgradeType?.includes('PREMIUM')) return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
}

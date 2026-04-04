import React, { useRef, useEffect, useState } from "react";
import { useGetShoutboxMessages, usePostShoutboxMessage, useDeleteShoutboxMessage } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Terminal, X, AlertCircle } from "lucide-react";
import { cn, formatShortDate, getRoleColor } from "@/lib/utils";
import { Link } from "wouter";
import { toast } from "sonner";

export function Shoutbox({ hideHeader = false }: { hideHeader?: boolean }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const [message, setMessage] = useState("");
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  
  const { data: messages = [], refetch, isLoading } = useGetShoutboxMessages(
    { limit: 50 },
    { 
      query: { 
        refetchInterval: 500,
        retry: false 
      } as any 
    }
  );

  const postMutation = usePostShoutboxMessage({
    mutation: {
      onSuccess: () => {
        setMessage("");
        setRateLimitError(null);
        setRetryAfter(null);
        refetch();
      },
      onError: (error: any) => {
        // Handle rate limit errors
        if (error?.response?.status === 429) {
          const errorData = error.response?.data;
          setRateLimitError(errorData?.error || "Rate limited");
          setRetryAfter(errorData?.retryAfter || null);
          toast.error(errorData?.error || "Too many messages");
        } else {
          const errorMsg = error?.response?.data?.error || "Failed to send message";
          setRateLimitError(errorMsg);
          toast.error(errorMsg);
        }
      }
    }
  });

  const deleteMutation = useDeleteShoutboxMessage({
    mutation: {
      onSuccess: () => {
        refetch();
      }
    }
  });

  const scrollToBottom = () => {
    if (!messagesContainerRef.current) return;
    // Use scrollTop instead of scrollIntoView to prevent page-level scrolling
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollHeight, scrollTop, clientHeight } = messagesContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    if (isAtBottom) {
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, isAtBottom]);

  // Clear rate limit error after retry window
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      const interval = setInterval(() => {
        setRetryAfter(prev => {
          if (prev === null || prev <= 1) {
            setRateLimitError(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [retryAfter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isAuthenticated) return;
    if (postMutation.isPending) return;
    
    postMutation.mutate({ data: { content: message } });
  };

  // Format message content for display
  const formatMessageContent = (content: string) => {
    // Handle roll command display
    if (content.startsWith("🎲")) {
      return (
        <span className="text-lg font-mono font-bold">
          {content}
        </span>
      );
    }
    return content;
  };

  return (
    <div className="glass-panel rounded-xl border border-white/10 flex flex-col h-[600px] overflow-hidden shadow-2xl shadow-primary/5">
      {!hideHeader && (
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
          <Terminal className="w-5 h-5 text-primary" />
          <h3 className="font-display font-bold tracking-wide">SHOUTBOX</h3>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-auto" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col-reverse" ref={messagesContainerRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm my-auto opacity-50 italic">
            No communications yet. Use /roll to roll dice or /clear (admin only) to clear.
          </div>
        ) : (
          [...messages].reverse().map((msg) => (
            <div key={msg.id} className="text-sm break-words group">
              <div className="flex items-baseline gap-2 mb-0.5">
                <Link href={`/profile/${msg.authorId}`} className={cn("font-bold hover:underline", getRoleColor(msg.authorRole).split(' ')[0])}>
                  {msg.authorUsername}
                </Link>
                <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5 h-4">
                  {formatShortDate(msg.createdAt)}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm("Delete this message?")) {
                          deleteMutation.mutate({ id: msg.id });
                        }
                      }}
                      className="ml-2 p-0.5 hover:text-red-500 transition-colors bg-white/5 rounded"
                      title="Delete message"
                      aria-label="Delete shoutbox message"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              </div>
              <div className="text-gray-300 leading-snug bg-white/5 rounded-r-lg rounded-bl-lg px-3 py-2 inline-block">
                {formatMessageContent(msg.content)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-white/5 bg-black/20 space-y-2">
        {rateLimitError && (
          <div className="flex items-center gap-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-xs">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <div className="flex-1">
              {rateLimitError}
              {retryAfter !== null && retryAfter > 0 && (
                <span className="ml-1 opacity-70">(retry in {retryAfter}s)</span>
              )}
            </div>
          </div>
        )}
        
        {isAuthenticated ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2">
              <Input 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Send message..."
                className="bg-black/40 border-white/10 h-9"
                maxLength={500}
                disabled={postMutation.isPending}
              />
              <Button type="submit" size="icon" className="h-9 w-9 shrink-0" variant="glow" disabled={postMutation.isPending || !message.trim() || rateLimitError !== null}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-2">
            <Link href="/login" className="text-primary hover:underline">Log in</Link> to send.
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useRef, useEffect, useState } from "react";
import { useGetShoutboxMessages, usePostShoutboxMessage } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Terminal } from "lucide-react";
import { cn, formatShortDate, getRoleColor } from "@/lib/utils";
import { Link } from "wouter";

export function Shoutbox({ hideHeader = false }: { hideHeader?: boolean }) {
  const { isAuthenticated } = useAuth();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messages = [], refetch } = useGetShoutboxMessages(
    { limit: 50 },
    { query: { refetchInterval: 10000 } }
  );

  const postMutation = usePostShoutboxMessage({
    mutation: {
      onSuccess: () => {
        setMessage("");
        refetch();
      }
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !isAuthenticated) return;
    postMutation.mutate({ data: { content: message } });
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

      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm my-auto opacity-50 italic">
            No communications yet.
          </div>
        ) : (
          messages.slice().reverse().map((msg) => (
            <div key={msg.id} className="text-sm break-words group">
              <div className="flex items-baseline gap-2 mb-0.5">
                <Link href={`/profile/${msg.authorId}`} className={cn("font-bold hover:underline", getRoleColor(msg.authorRole).split(' ')[0])}>
                  {msg.authorUsername}
                </Link>
                <span className="text-[10px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatShortDate(msg.createdAt)}
                </span>
              </div>
              <div className="text-gray-300 leading-snug bg-white/5 rounded-r-lg rounded-bl-lg px-3 py-2 inline-block">
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-white/5 bg-black/20">
        {isAuthenticated ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Transmit message..."
              className="bg-black/40 border-white/10 h-9"
              maxLength={500}
              disabled={postMutation.isPending}
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" variant="glow" disabled={postMutation.isPending || !message.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <div className="text-center text-xs text-muted-foreground py-2">
            <Link href="/login" className="text-primary hover:underline">Log in</Link> to transmit.
          </div>
        )}
      </div>
    </div>
  );
}

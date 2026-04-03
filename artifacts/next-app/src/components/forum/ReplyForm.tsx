"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPostAction } from "@/actions/forum";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";

export function ReplyForm({ threadId }: { threadId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(createPostAction, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Signal transmitted successfully.");
      formRef.current?.reset();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <div className="glass-panel rounded-3xl p-1 shadow-2xl shadow-primary/10 border border-primary/20 bg-black/60 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent box-glow" />
      <form ref={formRef} action={formAction} className="flex flex-col">
        <input type="hidden" name="threadId" value={threadId} />
        <textarea
          name="content"
          className="w-full bg-transparent border-0 text-white placeholder:text-muted-foreground/50 p-8 min-h-[180px] resize-y focus:ring-0 focus:outline-none text-lg leading-relaxed"
          placeholder="DRAFT YOUR SIGNAL TRANSMISSION..."
          required
          disabled={isPending}
        />
        <div className="px-8 py-5 border-t border-white/5 bg-black/40 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             Encrypted Terminal Active
          </div>
          <Button type="submit" variant="glow" size="lg" disabled={isPending} className="gap-3 w-full sm:w-auto px-10">
            {isPending ? "TRANSMITTING..." : "SEND SIGNAL"} <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

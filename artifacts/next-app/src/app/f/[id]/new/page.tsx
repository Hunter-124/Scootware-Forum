"use client";

import { useActionState, useEffect, use } from "react";
import { createThreadAction } from "@/actions/forum";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, ChevronLeft, Terminal } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function NewThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createThreadAction, null);

  useEffect(() => {
    if (state?.success && state?.threadId) {
      toast.success("Thread initialized and broadcast.");
      router.push(`/t/${state.threadId}`);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Link href={`/f/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-8 group uppercase tracking-widest font-bold">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Return to Sector {id}
      </Link>

      <div className="glass-panel rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary box-glow" />
        
        <div className="p-10 border-b border-white/5 bg-white/[0.02]">
           <div className="flex items-center gap-3 mb-2">
              <Terminal className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-black text-white uppercase tracking-wider">Initialize New Signal</h1>
           </div>
           <p className="text-muted-foreground">Draft a new thread for broadcast across the Scootware network.</p>
        </div>

        <form action={formAction} className="p-10 space-y-8">
          <input type="hidden" name="subforumId" value={id} />
          
          <div className="space-y-3">
            <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Signal Cipher (Title)</Label>
            <Input 
              id="title" 
              name="title" 
              placeholder="ENTER SIGNAL TITLE..." 
              required 
              minLength={3} 
              maxLength={200}
              className="h-14 bg-black/40 border-white/10 text-lg font-bold placeholder:text-muted-foreground/30 focus:border-primary/50 transition-all rounded-xl"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="content" className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground ml-1">Data Payload (Content)</Label>
            <textarea
              id="content"
              name="content"
              required
              minLength={1}
              className="w-full min-h-[350px] bg-black/40 border border-white/10 rounded-2xl p-6 text-white placeholder:text-muted-foreground/30 focus:border-primary/50 focus:outline-none transition-all text-base leading-relaxed"
              placeholder="WRITE YOUR ENCRYPTED MESSAGE HERE..."
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-white/5">
            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
               <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]" />
               Broadcast is Permanent
            </div>
            <Button type="submit" variant="glow" size="lg" disabled={isPending} className="w-full sm:w-auto px-12 h-14 rounded-xl font-black uppercase tracking-widest gap-3">
              {isPending ? "INITIALIZING..." : "START BROADCAST"} <PlusCircle className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

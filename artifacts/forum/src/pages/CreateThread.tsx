import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useCreateThread } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

export default function CreateThread() {
  const [, params] = useRoute("/forum/:id/new");
  const [, setLocation] = useLocation();
  const subforumId = parseInt(params?.id || "0", 10);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createThreadMutation = useCreateThread();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError("Thread title is required");
      return;
    }
    
    if (!content.trim()) {
      setError("Thread content is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createThreadMutation.mutateAsync({
        data: {
          subforumId,
          title: title.trim(),
          content: content.trim(),
        },
      });
      
      // Invalidate threads cache
      queryClient.invalidateQueries({ queryKey: ["getThreads"] } as any);
      
      // Redirect to the new thread
      setLocation(`/thread/${result.id}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create thread. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="glass-panel p-12 text-center rounded-2xl border-destructive/30">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-display font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-6">You must be logged in to create a thread.</p>
          <Button variant="glow" onClick={() => setLocation("/login")}>Initialize Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col gap-8 w-full max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation(`/forum/${subforumId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Forum
        </Button>
        <h1 className="text-3xl font-display font-bold text-white">Initialize Thread</h1>
      </div>

      {/* Form */}
      <div className="glass-panel p-8 rounded-xl border border-white/10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-white mb-2">
              Thread Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
              disabled={isSubmitting}
            />
          </div>

          {/* Content Input */}
          <div>
            <label htmlFor="content" className="block text-sm font-semibold text-white mb-2">
              Thread Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share your thoughts, questions, or updates..."
              rows={10}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setLocation(`/forum/${subforumId}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="glow"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Initializing..." : "Initialize Thread"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

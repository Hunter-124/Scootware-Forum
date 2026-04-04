import React, { useState } from "react";
import { X, Upload, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditPostModalProps {
  isOpen: boolean;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
  postType?: "forum" | "profile";
}

export function EditPostModal({
  isOpen,
  content,
  onContentChange,
  onSave,
  onCancel,
  isSaving = false,
  postType = "forum",
}: EditPostModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-panel rounded-xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 px-6 py-4 border-b border-white/10 bg-black/60 backdrop-blur flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Edit {postType === "forum" ? "Post" : "Message"}</h2>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={postType === "forum" ? "Draft your signal..." : "Leave a message..."}
            className="w-full bg-black/40 border border-white/10 rounded-lg p-4 text-white placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none resize-y min-h-[300px]"
            disabled={isSaving}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/40 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="glow"
            onClick={onSave}
            disabled={isSaving || !content.trim()}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

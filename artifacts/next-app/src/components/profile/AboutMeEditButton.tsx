'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit2, X, Check, Loader2 } from 'lucide-react';

interface AboutMeEditButtonProps {
  initialAboutMe: string;
  userId: number;
}

export function AboutMeEditButton({ initialAboutMe, userId }: AboutMeEditButtonProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [aboutMe, setAboutMe] = useState(initialAboutMe);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}/about-me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ aboutMe }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update about me');
      }

      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setAboutMe(initialAboutMe);
    setIsEditing(false);
    setError(null);
  };

  if (!isEditing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 justify-start h-10 px-4 gap-2 rounded-lg group transition-all duration-300"
      >
        <Edit2 className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">Edit</span>
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={aboutMe}
        onChange={(e) => setAboutMe(e.target.value.slice(0, 2000))}
        placeholder="Tell us about yourself..."
        className="w-full h-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all resize-none"
      />
      
      <div className="text-[10px] text-muted-foreground">
        {aboutMe.length}/2000 characters
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSaving}
          className="bg-white/5 hover:bg-white/10 border border-white/10 gap-2 px-4"
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary/20 hover:bg-primary/30 border border-primary/50 gap-2 px-4"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

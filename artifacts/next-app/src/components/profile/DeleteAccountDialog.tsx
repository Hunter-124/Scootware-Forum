'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteAccountDialogProps {
  userId: number;
  username: string;
  hasPassword: boolean;
}

export function DeleteAccountDialog({ userId, username, hasPassword }: DeleteAccountDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeleteClick = () => {
    if (hasPassword) {
      setShowPasswordDialog(true);
      setIsOpen(true);
    } else {
      // For SSO-only accounts, show confirmation directly
      setIsOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const body: { password?: string } = {};
      if (hasPassword && password) {
        body.password = password;
      }

      const response = await fetch(`/api/users/${userId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete account');
      }

      // Redirect to home page after successful deletion
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setError(null);
    setShowPasswordDialog(false);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        onClick={handleDeleteClick}
        className="w-full bg-destructive/20 hover:bg-destructive/30 border border-destructive/50 text-destructive justify-start h-14 px-6 gap-4 rounded-2xl group transition-all duration-300"
      >
        <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">Delete Account</span>
      </Button>

      {hasPassword ? (
        <Dialog open={showPasswordDialog} onOpenChange={(open) => {
          if (!open) handleCancel();
          setShowPasswordDialog(open);
        }}>
          <DialogContent className="bg-background/95 backdrop-blur-md border border-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Confirm Account Deletion
              </DialogTitle>
              <DialogDescription>
                Please enter your password to confirm account deletion. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isDeleting}
                className="bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground focus:border-destructive/50 focus:bg-white/10"
              />

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={isDeleting}
                className="bg-white/5 hover:bg-white/10 border border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={isDeleting || !password}
                className="bg-destructive/20 hover:bg-destructive/30 border border-destructive/50 text-destructive gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <AlertDialog open={isOpen} onOpenChange={(open) => {
          if (!open) handleCancel();
          setIsOpen(open);
        }}>
          <AlertDialogContent className="bg-background/95 backdrop-blur-md border border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Delete Account
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel className="bg-white/5 hover:bg-white/10 border border-white/10">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive/20 hover:bg-destructive/30 border border-destructive/50 text-destructive gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Account
                  </>
                )}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

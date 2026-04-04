import React, { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetUserProfile, useCreateProfilePost, useUploadAvatar, useGetSiteConfig, useUpdateProfilePost, useUploadProfilePostAttachments, useDeleteProfilePostAttachment } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, getRoleColor, cn } from "@/lib/utils";
import { User, Activity, Calendar, ShieldAlert, Upload, Send, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shoutbox } from "@/components/layout/Shoutbox";
import { ImageCropper } from "@/components/modals/ImageCropper";
import { EditPostModal } from "@/components/modals/EditPostModal";
import { AttachmentsList } from "@/components/AttachmentsList";
import { AttachmentUpload } from "@/components/AttachmentUpload";
import { RoleStatusBadge } from "@/components/RoleStatusBadge";

export default function UserProfile() {
  const [, params] = useRoute("/profile/:id");
  const userId = parseInt(params?.id || "0", 10);
  const { user: currentUser, isAdmin, isAuthenticated } = useAuth();
  
  const { data: profile, isLoading, refetch } = useGetUserProfile(userId, { query: { enabled: !!userId } as any });
  const { data: siteConfig } = useGetSiteConfig();
  const [postContent, setPostContent] = useState("");
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showAttachmentUpload, setShowAttachmentUpload] = useState<{ [key: number]: boolean }>({});
  const [selectedFiles, setSelectedFiles] = useState<{ [key: number]: File[] }>({});

  const postMutation = useCreateProfilePost({
    mutation: { onSuccess: () => { setPostContent(""); refetch(); } }
  });

  const updatePostMutation = useUpdateProfilePost({
    mutation: {
      onSuccess: () => {
        setEditingPostId(null);
        setEditContent("");
        refetch();
      }
    }
  });

  const uploadAttachmentsMutation = useUploadProfilePostAttachments({
    mutation: {
      onSuccess: () => {
        setShowAttachmentUpload({});
        setSelectedFiles({});
        refetch();
      }
    }
  });

  const deleteAttachmentMutation = useDeleteProfilePostAttachment({
    mutation: {
      onSuccess: () => {
        refetch();
      }
    }
  });

  const uploadMutation = useUploadAvatar({
    mutation: { onSuccess: () => { refetch(); } }
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setSelectedImage(reader.result ? reader.result.toString() : null));
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
    uploadMutation.mutate({ userId, data: { avatar: file } });
    setSelectedImage(null);
  };

  if (isLoading) return <div className="container mx-auto px-4 py-8"><div className="animate-pulse h-96 bg-white/5 rounded-2xl" /></div>;
  if (!profile) return <div className="container mx-auto px-4 py-8 text-center p-12 text-destructive">User not found.</div>;

  const { user, recentPosts } = profile;
  const isOwnProfile = currentUser?.id === user.id;

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 w-full">
      <div className="flex-1 min-w-0 space-y-8">
        {/* Profile Header Card */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
          <div className="h-32 bg-gradient-to-r from-primary/30 to-accent/30 relative">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          </div>
          
          <div className="px-8 pb-8 pt-0 flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16 relative z-10 text-center md:text-left">
            
            {/* Avatar Area */}
            <div className="relative group">
              <div className="w-32 h-32 rounded-2xl border-4 border-card bg-secondary overflow-hidden box-glow shadow-xl flex items-center justify-center">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-muted-foreground" />
                )}
              </div>
              {isOwnProfile && (
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-opacity backdrop-blur-sm">
                  <Upload className="w-6 h-6 text-white mb-1" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Upload</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadMutation.isPending} />
                </label>
              )}
            </div>

            <div className="flex-1 pb-2">
              <h1 className="text-3xl font-display font-bold text-white">{user.username}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                <RoleStatusBadge role={user.role} upgradeType={user.upgradeType} />
                {user.isBanned && <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border text-destructive bg-destructive/10 border-destructive/30">Banned</span>}
                <div className="text-muted-foreground text-sm flex items-center gap-1 ml-2">
                  <Calendar className="w-4 h-4" /> Joined {new Date(user.createdAt).getFullYear()}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-4 text-center pb-2">
              <div className="glass-panel px-6 py-3 rounded-xl border-white/5">
                <div className="text-2xl font-mono text-white font-bold">{user.postCount}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Transmissions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Controls Section (Only visible to admins on other users profiles) */}
        {isAdmin && !isOwnProfile && (
          <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
            <h3 className="text-amber-500 font-bold flex items-center gap-2 mb-4"><ShieldAlert className="w-5 h-5" /> Admin Controls Override</h3>
            <div className="flex flex-wrap gap-4">
              <Link href="/admin">
                <Button variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/20">Edit User Details</Button>
              </Link>
            </div>
            <p className="text-xs text-amber-500/70 mt-4 italic">Full management available in the central Admin Panel.</p>
          </div>
        )}

        {/* Profile Wall Grid */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* Wall Posts Area */}
          <div className="space-y-6">
            <h2 className="text-xl font-display font-bold flex items-center gap-2 border-b border-white/10 pb-2">
              <Activity className="w-5 h-5 text-primary" /> Profile Comm-Link
            </h2>

            {/* New Post Box */}
            {currentUser && !user.isBanned && (
              <form 
                className="glass-panel rounded-xl p-4 border border-white/10 flex flex-col gap-3"
                onSubmit={(e) => { e.preventDefault(); postMutation.mutate({ userId, data: { content: postContent } }); }}
              >
                <textarea 
                  className="w-full bg-black/40 rounded-lg p-3 text-sm text-white placeholder:text-muted-foreground border border-white/5 focus:border-primary/50 focus:outline-none resize-none"
                  placeholder={`Leave a message for ${user.username}...`}
                  rows={3}
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" size="sm" disabled={!postContent.trim() || postMutation.isPending} className="gap-2">
                    Post Message <Send className="w-3 h-3" />
                  </Button>
                </div>
              </form>
            )}

            {/* Posts List */}
            <div className="space-y-4">
              {recentPosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground italic border border-dashed border-white/10 rounded-xl">
                  No signals on this frequency.
                </div>
              ) : (
                recentPosts.map(post => (
                  <div key={post.id} className="glass-panel p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 shrink-0 rounded-full bg-secondary overflow-hidden border border-white/10">
                        {post.authorAvatarUrl ? <img src={post.authorAvatarUrl} className="w-full h-full object-cover" /> : <User className="w-full h-full p-2 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1 justify-between">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="font-bold text-white text-sm">{post.authorUsername}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(post.createdAt)}</span>
                            {post.updatedAt && post.createdAt !== post.updatedAt && (
                              <span className="text-xs text-muted-foreground">(edited {formatDate(post.updatedAt)})</span>
                            )}
                          </div>
                          {isAuthenticated && (currentUser?.id === post.authorId || isAdmin) && (
                            <button
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditContent(post.content);
                              }}
                              className="p-1 hover:bg-white/5 rounded transition-colors text-muted-foreground hover:text-white shrink-0"
                              title="Edit post"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-sm text-gray-300">{post.content}</p>
                      </div>
                    </div>

                    {isAuthenticated && (currentUser?.id === post.authorId || isAdmin) && (
                      <div className="pl-14 border-t border-white/5 pt-3">
                        {!showAttachmentUpload[post.id] ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setShowAttachmentUpload({ ...showAttachmentUpload, [post.id]: true })}
                            className="text-xs"
                          >
                            Add Attachments
                          </Button>
                        ) : (
                          <div className="space-y-3">
                            <AttachmentUpload
                              onFilesSelected={(files) => setSelectedFiles({ ...selectedFiles, [post.id]: files })}
                              isUploading={uploadAttachmentsMutation.isPending}
                              maxFiles={5}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowAttachmentUpload({ ...showAttachmentUpload, [post.id]: false })}
                                disabled={uploadAttachmentsMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="glow"
                                onClick={() => {
                                  if (selectedFiles[post.id]?.length > 0) {
                                    uploadAttachmentsMutation.mutate({
                                      userId,
                                      postId: post.id,
                                      files: selectedFiles[post.id],
                                    });
                                  }
                                }}
                                disabled={!selectedFiles[post.id]?.length || uploadAttachmentsMutation.isPending}
                              >
                                Upload Files
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      {isAuthenticated && (
        <aside className="hidden lg:block w-80 shrink-0">
          <div className="sticky top-24">
            <Shoutbox />
          </div>
        </aside>
      )}

      {editingPostId && (
        <EditPostModal
          isOpen={!!editingPostId}
          content={editContent}
          onContentChange={setEditContent}
          onSave={() => {
            updatePostMutation.mutate({
              userId,
              postId: editingPostId,
              data: { content: editContent },
            });
          }}
          onCancel={() => {
            setEditingPostId(null);
            setEditContent("");
          }}
          isSaving={updatePostMutation.isPending}
          postType="profile"
        />
      )}

      {selectedImage && (
        <ImageCropper 
          image={selectedImage} 
          onCropComplete={handleCropComplete} 
          onCancel={() => setSelectedImage(null)} 
        />
      )}
    </div>
  );
}

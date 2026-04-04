import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Update a forum post
export const useUpdatePost = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      postId,
      data,
    }: {
      postId: number;
      data: { content: string };
    }) => {
      const response = await fetch(`/api/forum/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update post");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["getThread"] });
    },
    ...options?.mutation,
  });
};

// Upload attachments to a forum post
export const useUploadPostAttachments = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      postId,
      files,
    }: {
      postId: number;
      files: File[];
    }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      
      const response = await fetch(`/api/forum/posts/${postId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload attachments");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getThread"] });
    },
    ...options?.mutation,
  });
};

// Get attachments for a forum post
export const useGetPostAttachments = (postId: number, options?: any) => {
  return useQuery({
    queryKey: ["getPostAttachments", postId],
    queryFn: async () => {
      const response = await fetch(`/api/forum/posts/${postId}/attachments`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch attachments");
      return response.json();
    },
    enabled: !!postId,
    ...options?.query,
  });
};

// Delete an attachment from a forum post
export const useDeletePostAttachment = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ attachmentId }: { attachmentId: number }) => {
      const response = await fetch(`/api/forum/posts/attachments/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete attachment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getThread"] });
      queryClient.invalidateQueries({ queryKey: ["getPostAttachments"] });
    },
    ...options?.mutation,
  });
};

// Delete a forum post
export const useDeletePost = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ postId }: { postId: number }) => {
      const response = await fetch(`/api/forum/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getThread"] });
    },
    ...options?.mutation,
  });
};

// Delete a forum thread
export const useDeleteThread = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ threadId }: { threadId: number }) => {
      const response = await fetch(`/api/forum/threads/${threadId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete thread");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getThread"] });
      queryClient.invalidateQueries({ queryKey: ["getThreads"] });
      queryClient.invalidateQueries({ queryKey: ["getSubforum"] });
    },
    ...options?.mutation,
  });
};

// Update a profile post
export const useUpdateProfilePost = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      userId,
      postId,
      data,
    }: {
      userId: number;
      postId: number;
      data: { content: string };
    }) => {
      const response = await fetch(`/api/users/${userId}/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getUserProfile"] });
    },
    ...options?.mutation,
  });
};

// Upload attachments to a profile post
export const useUploadProfilePostAttachments = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      userId,
      postId,
      files,
    }: {
      userId: number;
      postId: number;
      files: File[];
    }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      
      const response = await fetch(`/api/users/${userId}/posts/${postId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload attachments");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getUserProfile"] });
    },
    ...options?.mutation,
  });
};

// Get attachments for a profile post
export const useGetProfilePostAttachments = (userId: number, postId: number, options?: any) => {
  return useQuery({
    queryKey: ["getProfilePostAttachments", userId, postId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/posts/${postId}/attachments`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch attachments");
      return response.json();
    },
    enabled: !!userId && !!postId,
    ...options?.query,
  });
};

// Delete an attachment from a profile post
export const useDeleteProfilePostAttachment = (options?: any) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, attachmentId }: { userId: number; attachmentId: number }) => {
      const response = await fetch(`/api/users/${userId}/posts/attachments/${attachmentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete attachment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["getUserProfile"] });
      queryClient.invalidateQueries({ queryKey: ["getProfilePostAttachments"] });
    },
    ...options?.mutation,
  });
};

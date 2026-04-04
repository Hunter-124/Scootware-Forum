# Post Editing and File Sharing Implementation

## Overview
Complete implementation of post editing and file sharing capabilities for the Scootware Forum platform.

## Database Changes

### New Schema Files
- **`lib/db/src/schema/attachments.ts`** - Defines postAttachmentsTable and profilePostAttachmentsTable

### Updated Schema Files
- **`lib/db/src/schema/profile_posts.ts`** - Added updatedAt field
- **`lib/db/src/schema/index.ts`** - Added export for attachments schema

### Database Migrations
- **`lib/db/drizzle/0008_profile_posts_updated.sql`** - Adds updated_at column to profile_posts table
- **`lib/db/drizzle/0009_attachments.sql`** - Creates post_attachments and profile_post_attachments tables with foreign keys

## Backend Implementation

### Forum Routes (`artifacts/api-server/src/routes/forum.ts`)
- **PUT `/forum/posts/:postId`** - Edit forum post content
  - Requires authentication and post ownership (or admin)
  - Updates content and sets updatedAt timestamp
  
- **GET `/forum/posts/:postId/attachments`** - Retrieve attachments for a post
  - Returns list of attachments with metadata
  
- **POST `/forum/posts/:postId/attachments`** - Upload files to post
  - Requires authentication and post ownership (or admin)
  - Accepts up to 5 files, max 10MB each
  - Validates file types (whitelist approach)
  
- **DELETE `/forum/posts/attachments/:attachmentId`** - Remove attachment
  - Requires upload permission, post author permission, or admin

### User Routes (`artifacts/api-server/src/routes/users.ts`)
- **PUT `/users/:userId/posts/:postId`** - Edit profile post content
  - Requires authentication and post ownership (or admin)
  
- **GET `/users/:userId/posts/:postId/attachments`** - Retrieve profile post attachments
  
- **POST `/users/:userId/posts/:postId/attachments`** - Upload files to profile post
  - Same restrictions as forum post uploads
  
- **DELETE `/users/:userId/posts/attachments/:attachmentId`** - Remove profile post attachment

### Upload Middleware (`artifacts/api-server/src/lib/upload.ts`)
- Extended multer configuration with `postAttachmentUpload`
- Supports: PDF, Word, Excel, JSON, XML, images, archives, code files
- File size validation: 10MB max per file
- File count validation: 5 files max per upload
- `savePostAttachment()` function for secure file storage

## Frontend Implementation

### React Query Hooks (`lib/api-client-react/src/post-mutations.ts`)
1. **`useUpdatePost()`** - Edit forum posts
2. **`useUploadPostAttachments()`** - Upload files to forum posts
3. **`useGetPostAttachments()`** - Fetch forum post attachments
4. **`useDeletePostAttachment()`** - Delete forum post attachment
5. **`useUpdateProfilePost()`** - Edit profile posts
6. **`useUploadProfilePostAttachments()`** - Upload files to profile posts
7. **`useGetProfilePostAttachments()`** - Fetch profile post attachments
8. **`useDeleteProfilePostAttachment()`** - Delete profile post attachment

### UI Components

**EditPostModal** (`artifacts/forum/src/components/modals/EditPostModal.tsx`)
- Modal dialog for editing post content
- Works for both forum posts (postType="forum") and profile messages (postType="profile")
- Disabled save button when content is empty or saving in progress
- Cancel button to discard changes

**AttachmentUpload** (`artifacts/forum/src/components/AttachmentUpload.tsx`)
- Drag-and-drop file upload interface
- File input with multiple selection support
- Selected files list with removal capability
- File size and count validation with error messages
- Disabled during upload

**AttachmentsList** (`artifacts/forum/src/components/AttachmentsList.tsx`)
- Display list of post attachments
- Download button for each file
- Delete button (conditional on permissions)
- File size display
- Formatted dates

### Page Integration

**Thread Page** (`artifacts/forum/src/pages/Thread.tsx`)
- Added imports for edit and attachment hooks
- Edit button on each post (visible to author/admin)
- Edit timestamp display for modified posts
- Add Attachments button for post authors/admins
- Upload interface with cancel/save buttons

**Profile Page** (`artifacts/forum/src/pages/Profile.tsx`)
- Added imports for profile post edit hooks
- Edit button on wall posts (visible to author/admin)
- Edit timestamp display
- Add Attachments button for post authors/admins
- Upload interface with proper styling
- EditPostModal integration for profile posts

## Features Implemented

✅ **Post Editing**
- Users can edit their own posts
- Admins can edit any post
- Edit timestamp automatically tracked
- "Edited" label shows with timestamp

✅ **File Sharing/Attachments**
- Upload up to 5 files per post (10MB max per file)
- Supports documents, images, code files, config files
- Drag-and-drop upload interface
- Download attachments
- Delete attachments (with permission checks)
- File size display
- Upload timestamp

✅ **Permissions & Security**
- Edit: Only post author or admins
- Upload: Only post author or admins
- Delete: Uploader, post author, or admin
- File type whitelist validation
- File size limits enforced
- Proper error handling

## Testing Checklist

- [ ] Run migrations: `npm run migrate` in lib/db
- [ ] Build frontend: `npm run build` in artifacts/forum
- [ ] Build backend: `npm run build` in artifacts/api-server
- [ ] Test forum post editing on Thread page
- [ ] Test profile post editing on Profile page
- [ ] Test file uploads (drag-drop and click)
- [ ] Test file downloads
- [ ] Test file deletion
- [ ] Test permission checks (non-authors cannot edit/delete)
- [ ] Verify edit timestamps display correctly
- [ ] Check file type validation
- [ ] Verify file size limits

## Deployment Notes

1. Run database migrations before deploying
2. Ensure `uploads/attachments` directory exists and is writable
3. Configure appropriate file storage permissions
4. Test CORS for file downloads if using CDN
5. Consider file cleanup strategy for deleted posts

## Files Modified/Created

### Created (10 files)
- lib/db/src/schema/attachments.ts
- lib/db/drizzle/0008_profile_posts_updated.sql
- lib/db/drizzle/0009_attachments.sql
- lib/api-client-react/src/post-mutations.ts
- artifacts/forum/src/components/modals/EditPostModal.tsx
- artifacts/forum/src/components/AttachmentsList.tsx
- artifacts/forum/src/components/AttachmentUpload.tsx

### Modified (6 files)
- lib/db/src/schema/profile_posts.ts
- lib/db/src/schema/index.ts
- lib/api-client-react/src/index.ts
- artifacts/api-server/src/routes/forum.ts
- artifacts/api-server/src/routes/users.ts
- artifacts/api-server/src/lib/upload.ts
- artifacts/forum/src/pages/Thread.tsx
- artifacts/forum/src/pages/Profile.tsx

Total: 16 files modified/created

# Loader Upload & Protected Download — Implementation Plan

Status: Draft — saving before any code edits.

Goal
- Add admin UI + backend to upload a Windows `.exe` loader and store it in a protected server folder.
- Record metadata in the database (version, uploader, size, path, uploadedAt).
- Expose a server download endpoint that only authenticated users with an active subscription can use.
- Update OpenAPI, regenerate API client, and add frontend admin & loader UI hooks.

Acceptance criteria
- Admin can upload a single `.exe` via the Admin panel.
- Uploaded file is saved to a protected directory (not publicly served by static middleware).
- A DB record is created with metadata and an `isActive` flag.
- Authenticated users with an active subscription (upgradeType set and not expired) can download the latest active loader via the Loader page.
- Non-subscribed or anonymous users receive a 401/403 when attempting to download.

High-level steps

1) DB schema
- Add a `loaders` table in `lib/db/src/schema/` (Drizzle):
  - id (pk, serial)
  - filename (text) — server filename
  - originalName (text) — original uploaded filename
  - path (text) — relative path on server (for bookkeeping)
  - version (text) nullable
  - uploadedBy (int) fk -> users.id nullable
  - size (int)
  - releaseNotes (text) nullable
  - isActive (boolean) default true
  - createdAt (timestamp)

Notes: put this schema in `lib/db/src/schema/loaders.ts` and export a `loadersTable` symbol.

2) Backend helpers
- Create `artifacts/api-server/src/lib/loaderUpload.ts`:
  - multer diskStorage to `protected_uploads/loader` (directory created with fs.mkdirSync)
  - accept only `.exe` and limit size (50MB safe default)
  - export `loaderUpload` middleware and `LOADERS_DIR` constant.

3) Backend routes
- Admin upload route (admin-only): `POST /api/admin/loader`
  - middleware: `requireAdmin`, `loaderUpload.single('loader')`
  - body fields: `version` (string), `releaseNotes` (string, optional), `isActive` (bool optional)
  - store file metadata into `loaders` table (uploadedBy = req.user.id)
  - return created loader metadata

- Public/gated download route(s):
  - `GET /api/loader/latest` — returns metadata for latest active loader (id, version, size, originalName)
  - `GET /api/loader/:id/download` — streams the binary with `res.download` after checks
    - requireAuth middleware
    - verify subscription: user.upgradeType exists and (upgradeExpiresAt is null or > now)
    - if allowed, `res.download(pathToFile, originalName)` so browsers prompt save with original filename

- Alternative: `GET /api/loader/download/latest` that resolves and streams the latest.

Security & deployment notes
- Save binaries outside the public `uploads` static route. Example: `protected_uploads/loader` in project root.
- Do NOT serve `protected_uploads` with express.static. Only `res.download` via guarded endpoint.
- Validate file extension strictly; do not accept other executables (.dll etc.).
- Ensure path used to `res.download` is constructed from DB record and not from user input to avoid path traversal.

4) OpenAPI / Client
- Add endpoints and schemas to `lib/api-spec/openapi.yaml` under `admin` and `products/loader` or `loader` sections:
  - `POST /admin/loader` (multipart/form-data)
  - `GET /loader/latest`
  - `GET /loader/{id}/download`
- Run `pnpm run generate` to update `lib/api-client-react` (optional but recommended to follow repo practices).

5) Frontend — Admin UI
- Add an Admin panel section (new card or tab) in `artifacts/forum/src/pages/Admin.tsx` (or a small new component referenced from the Admin tab):
  - file input for `.exe`, version text input, release notes textarea, `Upload` button
  - submit as `multipart/form-data` to `/api/admin/loader` with `credentials: 'include'`
  - show upload result and refresh loader list
- Optionally list previously uploaded loaders with ability to set `isActive` or delete.

6) Frontend — Loader page
- Update `artifacts/forum/src/pages/Loader.tsx` to request `/api/loader/latest` when user clicks Download and then navigate to `/api/loader/{id}/download` or fetch the binary and trigger a download.
- Gate UI: keep existing gated UI (it already checks `user?.upgradeType`) but ensure backend verifies subscription server-side.

7) Minimal tests & smoke checks (developer)
- Upload a small fake `.exe` (or renamed small file) locally to verify saving & DB insert.
- Try download as a subscribed user and as anon/unsubscribed to confirm 200 vs 403.

Files expected to change (suggested)
- lib/db/src/schema/loaders.ts (new)
- lib/api-spec/openapi.yaml (update)
- artifacts/api-server/src/lib/loaderUpload.ts (new)
- artifacts/api-server/src/routes/admin.ts (add upload handler)
- artifacts/api-server/src/routes/loader.ts (new public/gated route(s))
- artifacts/forum/src/pages/Admin.tsx (admin upload UI)
- artifacts/forum/src/pages/Loader.tsx (update download flow)

Rollback plan
- To disable public access quickly: set `isActive=false` for the loader row in DB or remove the file on disk and mark inactive.

Next step (after you confirm)
- I'll implement the backend pieces first (lib helper + routes + DB schema), then add the frontend pieces. If you prefer, I can implement OpenAPI changes first so client generation is straightforward.



Prepared by: GitHub Copilot
Date: 2026-03-30

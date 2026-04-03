---
name: Architecture
description: Comprehensive guide to the Scootware Forum codebase architecture, including frontend-backend interaction, data flow, and development patterns.
---

# Scootware Forum Architecture

This document details the architectural patterns, program flow, and best practices for the Scootware Forum codebase. Adhering to these rules is critical for maintaining type safety and system integrity.

## Core Structure (Monorepo)

The project is a monorepo managed by `pnpm`.

- `artifacts/forum`: Frontend application (Vite + React).
- `artifacts/api-server`: Backend application (Express).
- `lib/api-spec`: The **Source of Truth** for the entire API.
- `lib/db`: Database schemas (Drizzle) and connection logic.
- `lib/api-client-react`: Generated hooks for the frontend.
- `lib/api-zod`: Shared Zod schemas for validation.

## Data Flow & Synchronization (OpenAPI-First)

This project follows an **API-First** development model.

1.  **Define**: All API endpoints, request bodies, and response shapes MUST be defined in [openapi.yaml](file:///c:/Users/nigga/Downloads/Scootware-Forum/Scootware-Forum/lib/api-spec/openapi.yaml).
2.  **Generate**: Running `pnpm run generate` (via Orval) updates `@workspace/api-client-react`.
3.  **Consume**: The frontend [forum](file:///c:/Users/nigga/Downloads/Scootware-Forum/Scootware-Forum/artifacts/forum) consumes these generated React Query hooks.
    - *Example*: `useGetThreads` or `useLogin`.

> [!IMPORTANT]
> **NEVER** manually write fetch calls or types for API responses. Always update the OpenAPI spec and regenerate the client.

## Backend Architecture (Express + Drizzle)

The [api-server](file:///c:/Users/nigga/Downloads/Scootware-Forum/Scootware-Forum/artifacts/api-server) is a modular Express app.

- **Initialization**: [app.ts](file:///c:/Users/nigga/Downloads/Scootware-Forum/Scootware-Forum/artifacts/api-server/src/app.ts) handles middleware (CORS, Pino, Sessions, Passport).
- **Routing**: Routes are organized by feature in `src/routes/`.
- **Database**:
    - **Development**: Fallbacks to **PGlite** (in-memory) if local Postgres isn't available.
    - **Production**: Connects to Postgres via `DATABASE_URL`.
    - **ORM**: Drizzle. Schemas are modularized in `lib/db/src/schema/`.

## Frontend Architecture (Vite + Wouter)

The [forum](file:///c:/Users/nigga/Downloads/Scootware-Forum/Scootware-Forum/artifacts/forum) uses a component-based architecture.

- **Routing**: Managed by `wouter` in [App.tsx](file:///c:/Users/nigga/Downloads/Scootware-Forum/Scootware-Forum/artifacts/forum/src/App.tsx).
- **State**: React Query handles all server-state. Local UI state is handled via standard React hooks.
- **UI System**: Tailwind CSS with Radix UI (Shadcn patterns). Components are in `src/components/`.

## Best Practices & Rules

### 1. Database Modifications
- When adding a table or column, edit the relevant file in `lib/db/src/schema/`.
- Ensure relations are correctly defined using Drizzle's `relations` API.

### 2. Authentication
- Use the `isAuthenticated` and `isAdmin` middlewares in the backend.
- Use the `user` object from the generated `useGetMe` hook in the frontend to gate UI elements.

### 3. Error Handling
- Backend errors must return an `ErrorResponse` as defined in OpenAPI.
- Frontend should use the `toast` component to notify users of failures via React Query's `onError`.

### 4. Deployment
- The `live-deployment` folder contains scripts for patching or full deployments.
- `ecosystem.config.cjs` manages the PM2 process for the backend.

## Critical File Map

- **API Spec**: `lib/api-spec/openapi.yaml`
- **DB Schema**: `lib/db/src/schema/`
- **Backend Routes**: `artifacts/api-server/src/routes/`
- **Frontend App**: `artifacts/forum/src/App.tsx`
- **Navigation Layout**: `artifacts/forum/src/components/layout/AppLayout.tsx`

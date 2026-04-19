import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { db, hwidResetRequestsTable, usersTable, loaderEventsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { HwidRequestsTab } from "./HwidRequestsTab";
import { LoaderEventsTab } from "./LoaderEventsTab";
import { AdminTabs } from "./AdminTabs";

export const metadata = { title: "Admin Panel — Scootware" };

const PAGE_SIZE = 25;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  const { tab = "hwid", page: pageStr = "1" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr) || 1);

  // ── HWID requests ────────────────────────────────────────────────────────
  const requests = await db
    .select({
      id: hwidResetRequestsTable.id,
      userId: hwidResetRequestsTable.userId,
      status: hwidResetRequestsTable.status,
      oldHwid: hwidResetRequestsTable.oldHwid,
      oldHwidDetails: hwidResetRequestsTable.oldHwidDetails,
      oldHwidLocations: hwidResetRequestsTable.oldHwidLocations,
      newHwid: hwidResetRequestsTable.newHwid,
      newHwidDetails: hwidResetRequestsTable.newHwidDetails,
      requestIp: hwidResetRequestsTable.requestIp,
      requestLocation: hwidResetRequestsTable.requestLocation,
      requestedAt: hwidResetRequestsTable.requestedAt,
      resolvedAt: hwidResetRequestsTable.resolvedAt,
      username: usersTable.username,
      email: usersTable.email,
    })
    .from(hwidResetRequestsTable)
    .leftJoin(usersTable, eq(hwidResetRequestsTable.userId, usersTable.id))
    .orderBy(desc(hwidResetRequestsTable.requestedAt));

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  // ── Loader detection events ───────────────────────────────────────────────
  const [{ total: loaderEventCount }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(loaderEventsTable as any);

  const loaderEventsPage = tab === "detections" ? page : 1;

  const loaderEvents = await db
    .select({
      id: (loaderEventsTable as any).id,
      userId: (loaderEventsTable as any).userId,
      hwid: (loaderEventsTable as any).hwid,
      ip: (loaderEventsTable as any).ip,
      userAgent: (loaderEventsTable as any).userAgent,
      eventType: (loaderEventsTable as any).eventType,
      vmDetected: (loaderEventsTable as any).vmDetected,
      debuggerDetected: (loaderEventsTable as any).debuggerDetected,
      details: (loaderEventsTable as any).details,
      productId: (loaderEventsTable as any).productId,
      loaderVersion: (loaderEventsTable as any).loaderVersion,
      createdAt: (loaderEventsTable as any).createdAt,
      username: usersTable.username,
    })
    .from(loaderEventsTable as any)
    .leftJoin(usersTable, eq((loaderEventsTable as any).userId, usersTable.id))
    .orderBy(desc((loaderEventsTable as any).createdAt))
    .limit(PAGE_SIZE)
    .offset((loaderEventsPage - 1) * PAGE_SIZE);

  const loaderEventsData = {
    events: loaderEvents.map((e: any) => ({
      ...e,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    })),
    total: loaderEventCount,
    page: loaderEventsPage,
    totalPages: Math.ceil(loaderEventCount / PAGE_SIZE),
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display tracking-wider text-glow">ADMIN PANEL</h1>
          <p className="text-sm text-muted-foreground">Logged in as {user.username}</p>
        </div>
      </div>

      {/* Tab navigation + tab bodies (client component handles active state) */}
      <AdminTabs
        activeTab={tab}
        pendingHwidCount={pendingCount}
        detectionCount={loaderEventCount}
        hwidContent={
          <HwidRequestsTab
            initialRequests={requests.map((r) => ({
              ...r,
              requestedAt: r.requestedAt?.toISOString?.() ?? String(r.requestedAt),
              resolvedAt: r.resolvedAt?.toISOString?.() ?? null,
              oldHwidDetails: r.oldHwidDetails as any,
              oldHwidLocations: r.oldHwidLocations as any,
              newHwidDetails: r.newHwidDetails as any,
              requestLocation: r.requestLocation as any,
            }))}
          />
        }
        detectionsContent={<LoaderEventsTab initialData={loaderEventsData} />}
      />
    </div>
  );
}

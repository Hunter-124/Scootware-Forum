import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  hwidResetRequestsTable,
  usersTable,
  loginEventsTable,
} from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  if (user.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
  next();
}

// Free IP geolocation using ip-api.com (no key required, 45 req/min limit).
// Returns null on failure — non-fatal.
async function geolocate(ip: string): Promise<{ city: string; country: string; lat: number; lon: number } | null> {
  // Skip private / loopback IPs
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { city: "Local", country: "Local", lat: 0, lon: 0 };
  }
  try {
    const cleanIp = ip.includes(",") ? ip.split(",")[0].trim() : ip;
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,city,country,lat,lon`);
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (data.status !== "success") return null;
    return { city: data.city ?? "Unknown", country: data.country ?? "Unknown", lat: data.lat ?? 0, lon: data.lon ?? 0 };
  } catch {
    return null;
  }
}

// ── POST /api/hwid-reset  (authenticated user submits request) ───────────────

const submitSchema = z.object({
  newHwid: z.string().regex(/^[0-9a-f]{64}$/, "Invalid HWID format"),
  newHwidDetails: z.object({
    cpu: z.string().max(256),
    gpu: z.string().max(256),
    ramGb: z.number().int().min(0).max(4096),
  }),
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = req.user as any;

  const parse = submitSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
    return;
  }
  const { newHwid, newHwidDetails } = parse.data;

  try {
    // Block duplicate pending requests
    const [existing] = await db
      .select({ id: hwidResetRequestsTable.id })
      .from(hwidResetRequestsTable)
      .where(and(
        eq(hwidResetRequestsTable.userId, user.id),
        eq(hwidResetRequestsTable.status, "pending")
      ))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "You already have a pending HWID reset request." });
      return;
    }

    // Fetch the user's currently bound HWID
    const [userRecord] = await db
      .select({ hwid: usersTable.hwid })
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    const oldHwid = userRecord?.hwid ?? null;

    // Collect login-event locations for the old HWID binding (last 10 IPs)
    const loginEvents = await db
      .select({ ip: loginEventsTable.ip, createdAt: loginEventsTable.createdAt })
      .from(loginEventsTable)
      .where(eq(loginEventsTable.userId, user.id))
      .orderBy(desc(loginEventsTable.createdAt))
      .limit(10);

    // Geolocate each unique IP
    const seenIps = new Set<string>();
    const oldLocations: any[] = [];
    for (const ev of loginEvents) {
      if (!ev.ip || seenIps.has(ev.ip)) continue;
      seenIps.add(ev.ip);
      const geo = await geolocate(ev.ip);
      oldLocations.push({
        ip: ev.ip,
        city: geo?.city ?? "Unknown",
        country: geo?.country ?? "Unknown",
        lat: geo?.lat ?? 0,
        lon: geo?.lon ?? 0,
        seenAt: ev.createdAt,
      });
    }

    // Geolocate the new request's IP
    const requestIp =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
      req.ip ??
      "";
    const requestGeo = await geolocate(requestIp);
    const requestLocation = {
      city: requestGeo?.city ?? "Unknown",
      country: requestGeo?.country ?? "Unknown",
      lat: requestGeo?.lat ?? 0,
      lon: requestGeo?.lon ?? 0,
    };

    await db.insert(hwidResetRequestsTable).values({
      userId: user.id,
      oldHwid,
      oldHwidDetails: null, // Server doesn't have the old machine's human-readable details;
                             // they are stored when a user previously submitted a request or
                             // can be populated by future instrumentation.
      oldHwidLocations: oldLocations,
      newHwid,
      newHwidDetails,
      requestIp,
      requestLocation,
      status: "pending",
    });

    res.status(201).json({ message: "HWID reset request submitted. An admin will review it shortly." });
  } catch (err) {
    req.log.error({ err }, "Submit HWID reset request error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/hwid-reset  (admin: list requests) ──────────────────────────────

router.get("/", requireAdmin, async (req: Request, res: Response) => {
  const status = (req.query.status as string) || "pending";
  const validStatuses = ["pending", "approved", "denied", "all"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: "Invalid status filter" });
    return;
  }

  try {
    const whereClause = status === "all"
      ? undefined
      : eq(hwidResetRequestsTable.status, status as any);

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
      .where(whereClause)
      .orderBy(desc(hwidResetRequestsTable.requestedAt));

    res.json(requests);
  } catch (err) {
    req.log.error({ err }, "List HWID reset requests error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/hwid-reset/:id/approve  (admin) ───────────────────────────────

router.patch("/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid request ID" }); return; }

  const admin = req.user as any;

  try {
    const [request] = await db
      .select()
      .from(hwidResetRequestsTable)
      .where(eq(hwidResetRequestsTable.id, id))
      .limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "pending") {
      res.status(400).json({ error: `Request is already ${request.status}` });
      return;
    }

    // Update the user's bound HWID to the new one
    await db
      .update(usersTable)
      .set({ hwid: request.newHwid })
      .where(eq(usersTable.id, request.userId));

    // Mark the request as approved
    await db
      .update(hwidResetRequestsTable)
      .set({ status: "approved", resolvedAt: new Date(), resolvedBy: admin.id })
      .where(eq(hwidResetRequestsTable.id, id));

    req.log?.info({ adminId: admin.id, requestId: id, userId: request.userId }, "HWID reset approved");
    res.json({ message: "HWID reset approved and applied." });
  } catch (err) {
    req.log.error({ err }, "Approve HWID reset error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PATCH /api/hwid-reset/:id/deny  (admin) ──────────────────────────────────

router.patch("/:id/deny", requireAdmin, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid request ID" }); return; }

  const admin = req.user as any;

  try {
    const [request] = await db
      .select({ id: hwidResetRequestsTable.id, status: hwidResetRequestsTable.status })
      .from(hwidResetRequestsTable)
      .where(eq(hwidResetRequestsTable.id, id))
      .limit(1);

    if (!request) { res.status(404).json({ error: "Request not found" }); return; }
    if (request.status !== "pending") {
      res.status(400).json({ error: `Request is already ${request.status}` });
      return;
    }

    await db
      .update(hwidResetRequestsTable)
      .set({ status: "denied", resolvedAt: new Date(), resolvedBy: admin.id })
      .where(eq(hwidResetRequestsTable.id, id));

    req.log?.info({ adminId: admin.id, requestId: id }, "HWID reset denied");
    res.json({ message: "HWID reset denied." });
  } catch (err) {
    req.log.error({ err }, "Deny HWID reset error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

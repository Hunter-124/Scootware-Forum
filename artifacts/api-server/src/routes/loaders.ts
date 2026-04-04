import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  loaderVersionsTable,
  productAccessTable,
} from "@workspace/db";
import { eq, desc, gt, and } from "drizzle-orm";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { loaderUpload, saveLoaderFile } from "../lib/upload.js";

const router: IRouter = Router();

const LOADERS_DIR = path.resolve("uploads/loaders");

// Middleware: Check if user has ANY active product subscription
async function requireActiveSubscription(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const now = new Date();
    const activeProducts = await db
      .select()
      .from(productAccessTable)
      .where(and(
        eq(productAccessTable.userId, user.id),
        gt(productAccessTable.expiresAt, now)
      ))
      .limit(1);

    if (activeProducts.length === 0) {
      res.status(403).json({ error: "Active subscription required" });
      return;
    }

    (req as any).userSubscription = activeProducts[0];
    next();
  } catch (err) {
    req.log.error({ err }, "Subscription check error");
    res.status(500).json({ error: "Internal server error" });
  }
}

// Middleware: Check admin role
function requireAdmin(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// GET /api/loaders/latest - Get latest active loader version info
router.get("/latest", async (req: Request, res: Response) => {
  try {
    const [latest] = await db
      .select()
      .from(loaderVersionsTable)
      .where(eq(loaderVersionsTable.isActive, true))
      .orderBy(desc(loaderVersionsTable.releaseDate))
      .limit(1);

    if (!latest) {
      res.status(404).json({ error: "No loader version available" });
      return;
    }

    res.json({
      id: latest.id,
      version: latest.version,
      fileSize: latest.fileSize,
      changelog: latest.changelog,
      releaseDate: latest.releaseDate,
    });
  } catch (err) {
    req.log.error({ err }, "Get latest loader error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/loaders/versions - Get all loader versions (admin only)
router.get("/versions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const versions = await db
      .select()
      .from(loaderVersionsTable)
      .orderBy(desc(loaderVersionsTable.releaseDate));

    res.json(
      versions.map((v: any) => ({
        id: v.id,
        version: v.version,
        fileName: v.fileName,
        fileSize: v.fileSize,
        changelog: v.changelog,
        releaseDate: v.releaseDate,
        isActive: v.isActive,
        createdBy: v.createdBy,
        createdAt: v.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Get loader versions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/loaders/:versionId/download - Download loader (requires subscription)
router.get("/:versionId/download", requireActiveSubscription, async (req: Request, res: Response) => {
  const versionId = parseInt(Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId);
  if (isNaN(versionId)) {
    res.status(400).json({ error: "Invalid version ID" });
    return;
  }

  try {
    const version = await db
      .select()
      .from(loaderVersionsTable)
      .where(eq(loaderVersionsTable.id, versionId))
      .limit(1);

    if (version.length === 0) {
      res.status(404).json({ error: "Loader version not found" });
      return;
    }

    const loaderPath = path.join(LOADERS_DIR, version[0].fileName);
    if (!fs.existsSync(loaderPath)) {
      res.status(404).json({ error: "Loader file not found on server" });
      return;
    }

    res.download(loaderPath, `ScootwareHub_v${version[0].version}.exe`);
  } catch (err) {
    req.log.error({ err }, "Download loader error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/loaders/upload - Upload new loader version (admin only)
const uploadLoaderSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in format X.Y.Z"),
  changelog: z.string().max(2000).optional().transform(val => val && val.trim().length > 0 ? val : undefined),
  isActive: z.coerce.boolean().default(true),
});

router.post(
  "/upload",
  requireAdmin,
  loaderUpload.single("file"),
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      req.log.warn("No file provided in upload request");
      res.status(400).json({ error: "No file provided" });
      return;
    }

    req.log.info({ 
      filename: file.originalname, 
      mimetype: file.mimetype, 
      size: file.buffer.length 
    }, "File received for upload");

    const parse = uploadLoaderSchema.safeParse(req.body);
    if (!parse.success) {
      const errorMsg = parse.error.issues[0]?.message || "Validation error";
      req.log.warn({ errors: parse.error.issues }, `Upload validation failed: ${errorMsg}`);
      res.status(400).json({ error: errorMsg });
      return;
    }

    try {
      const { version, changelog, isActive } = parse.data;
      const currentUser = req.user as any;

      req.log.info({ version, userId: currentUser?.id }, "Processing loader upload");

      // Check if version already exists
      const existingVersion = await db
        .select()
        .from(loaderVersionsTable)
        .where(eq(loaderVersionsTable.version, version))
        .limit(1);

      if (existingVersion.length > 0) {
        req.log.warn({ version }, `Version already exists`);
        res.status(400).json({ error: `Version ${version} already exists` });
        return;
      }

      // Save loader file
      req.log.info({ version, fileName: file.originalname }, "Saving loader file to disk");
      const fileName = await saveLoaderFile(file.buffer, version, file.originalname);
      req.log.info({ version, fileName, savedFileName: fileName }, "Loader file saved successfully");

      // If this is being set as active, deactivate all others
      if (isActive) {
        req.log.info({ version }, "Deactivating previous versions");
        await db.update(loaderVersionsTable).set({ isActive: false });
      }

      // Insert version record
      req.log.info({ version, fileName }, "Inserting version record into database");
      const [newVersion] = await db
        .insert(loaderVersionsTable)
        .values({
          version,
          fileName,
          filePath: path.join(LOADERS_DIR, fileName),
          fileSize: file.buffer.length,
          changelog: changelog || null,
          isActive,
          createdBy: currentUser.id,
        })
        .returning();

      req.log.info({ id: newVersion.id, version }, "Loader uploaded successfully");

      res.status(201).json({
        id: newVersion.id,
        version: newVersion.version,
        fileName: newVersion.fileName,
        fileSize: newVersion.fileSize,
        changelog: newVersion.changelog,
        releaseDate: newVersion.releaseDate,
        isActive: newVersion.isActive,
      });
    } catch (err) {
      req.log.error({ err, stack: (err as any).stack }, "Upload loader error");
      
      // Ensure we always return JSON, even on unexpected errors
      const errorMessage = err instanceof Error ? err.message : "Internal server error";
      
      // In development, show actual error message; in production, generic message
      const responseError = process.env.NODE_ENV === "development" 
        ? errorMessage 
        : "Failed to upload loader. Please try again or contact support.";
      
      res.status(500).json({ 
        error: responseError,
        ...(process.env.NODE_ENV === "development" && { details: errorMessage })
      });
    }
  }
);

// PATCH /api/loaders/:versionId/activate - Set loader version as active (admin only)
router.patch("/:versionId/activate", requireAdmin, async (req: Request, res: Response) => {
  const versionId = parseInt(Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId);
  if (isNaN(versionId)) {
    res.status(400).json({ error: "Invalid version ID" });
    return;
  }

  try {
    const version = await db
      .select()
      .from(loaderVersionsTable)
      .where(eq(loaderVersionsTable.id, versionId))
      .limit(1);

    if (version.length === 0) {
      res.status(404).json({ error: "Loader version not found" });
      return;
    }

    // Deactivate all others
    await db.update(loaderVersionsTable).set({ isActive: false });

    // Activate this one
    const [updated] = await db
      .update(loaderVersionsTable)
      .set({ isActive: true })
      .where(eq(loaderVersionsTable.id, versionId))
      .returning();

    res.json({
      id: updated.id,
      version: updated.version,
      isActive: updated.isActive,
      releaseDate: updated.releaseDate,
    });
  } catch (err) {
    req.log.error({ err }, "Activate loader error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/loaders/:versionId - Delete loader version (admin only)
router.delete("/:versionId", requireAdmin, async (req: Request, res: Response) => {
  const versionId = parseInt(Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId);
  if (isNaN(versionId)) {
    res.status(400).json({ error: "Invalid version ID" });
    return;
  }

  try {
    const version = await db
      .select()
      .from(loaderVersionsTable)
      .where(eq(loaderVersionsTable.id, versionId))
      .limit(1);

    if (version.length === 0) {
      res.status(404).json({ error: "Loader version not found" });
      return;
    }

    // Delete file from disk
    const loaderPath = path.join(LOADERS_DIR, version[0].fileName);
    if (fs.existsSync(loaderPath)) {
      fs.unlinkSync(loaderPath);
    }

    // Delete from database
    await db.delete(loaderVersionsTable).where(eq(loaderVersionsTable.id, versionId));

    res.json({ message: `Loader version ${version[0].version} deleted` });
  } catch (err) {
    req.log.error({ err }, "Delete loader error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

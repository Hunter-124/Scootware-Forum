import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  productAssetsTable,
  productAccessTable,
} from "@workspace/db";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { productAssetUpload, saveProductAssetFile } from "../lib/upload.js";
import { getPESizeOfImage } from "../lib/pe-parser.js";

const router: IRouter = Router();

const PRODUCT_ASSETS_DIR = path.resolve("uploads/product_assets");

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

// Middleware: Check if user has active product subscription
async function requireProductSubscription(req: Request, res: Response, next: any) {
  const user = req.user as any;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const productId = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  if (!productId) {
    res.status(400).json({ error: "Product ID is required" });
    return;
  }

  try {
    const now = new Date();
    const activeProducts = await db
      .select()
      .from(productAccessTable)
      .where(and(
        eq(productAccessTable.userId, user.id),
        eq(productAccessTable.productId, productId),
        gt(productAccessTable.expiresAt, now)
      ))
      .limit(1);

    if (activeProducts.length === 0 && user.role !== "admin") {
      res.status(403).json({ error: "Active subscription required for this product" });
      return;
    }

    next();
  } catch (err) {
    req.log.error({ err }, "Subscription check error");
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/products/:productId/assets - List all assets for a product (admin only)
router.get("/:productId/assets", requireAdmin, async (req: Request, res: Response) => {
  const productId = req.params.productId;
  try {
    const assets = await db
      .select()
      .from(productAssetsTable)
      .where(eq(productAssetsTable.productId, productId))
      .orderBy(desc(productAssetsTable.createdAt));

    res.json(assets);
  } catch (err) {
    req.log.error({ err }, "Get product assets error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/products/:productId/assets - Upload new product asset (admin only)
const uploadAssetSchema = z.object({
  version: z.string().default("1.0.0"),
  assetType: z.enum(["primary_exe", "dll", "driver", "config", "other"]).default("primary_exe"),
  allocationSize: z.coerce.number().optional(),
  isActive: z.coerce.boolean().default(true),
});

router.post(
  "/:productId/assets",
  requireAdmin,
  productAssetUpload.single("file"),
  async (req: Request, res: Response) => {
    const productId = req.params.productId;
    const file = req.file;
    
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const parse = uploadAssetSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.issues[0]?.message || "Validation error" });
      return;
    }

    try {
      const { version, assetType, allocationSize, isActive } = parse.data;
      const currentUser = req.user as any;

      // Automatically calculate allocation size from PE headers if it's an EXE/DLL and not provided
      const autoAllocationSize = getPESizeOfImage(file.buffer);
      const finalAllocationSize = allocationSize || autoAllocationSize || file.buffer.length;

      // Save file to disk
      const fileName = await saveProductAssetFile(file.buffer, productId, assetType, file.originalname, version);

      // Extract raw file name for DB storage
      const [newAsset] = await db
        .insert(productAssetsTable)
        .values({
          productId,
          assetType,
          fileName,
          filePath: path.join(PRODUCT_ASSETS_DIR, fileName),
          fileSize: file.buffer.length,
          allocationSize: finalAllocationSize,
          version,
          isActive,
          createdBy: currentUser.id,
        })
        .returning();

      res.status(201).json(newAsset);
    } catch (err) {
      req.log.error({ err }, "Upload product asset error");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// DELETE /api/products/:productId/assets/:assetId - Delete asset (admin only)
router.delete("/:productId/assets/:assetId", requireAdmin, async (req: Request, res: Response) => {
  const assetId = parseInt(req.params.assetId);
  if (isNaN(assetId)) {
    res.status(400).json({ error: "Invalid asset ID" });
    return;
  }

  try {
    const asset = await db
      .select()
      .from(productAssetsTable)
      .where(eq(productAssetsTable.id, assetId))
      .limit(1);

    if (asset.length === 0) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    // Delete file from disk
    const assetPath = path.join(PRODUCT_ASSETS_DIR, asset[0].fileName);
    if (fs.existsSync(assetPath)) {
      fs.unlinkSync(assetPath);
    }

    // Delete from DB
    await db.delete(productAssetsTable).where(eq(productAssetsTable.id, assetId));

    res.json({ message: "Asset deleted successfully" });
  } catch (err) {
    req.log.error({ err }, "Delete product asset error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/products/:productId/assets/manifest - Get manifest of active assets
router.get("/:productId/assets/manifest", requireProductSubscription, async (req: Request, res: Response) => {
  const productId = req.params.productId;
  try {
    const assets = await db
      .select({
        id: productAssetsTable.id,
        assetType: productAssetsTable.assetType,
        version: productAssetsTable.version,
        fileSize: productAssetsTable.fileSize,
        allocationSize: productAssetsTable.allocationSize,
        fileName: productAssetsTable.fileName
      })
      .from(productAssetsTable)
      .where(and(
        eq(productAssetsTable.productId, productId),
        eq(productAssetsTable.isActive, true)
      ));

    res.json(assets);
  } catch (err) {
    req.log.error({ err }, "Get asset manifest error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/products/:productId/assets/stream - Convenience route for loader to get latest asset by type
router.get("/:productId/assets/stream", requireProductSubscription, async (req: Request, res: Response) => {
  const productId = req.params.productId;
  const assetType = req.query.type as string || "primary_exe";

  try {
    // Find the latest active asset for this product and type
    // We use a case-insensitive match for productId just in case
    const asset = await db
      .select()
      .from(productAssetsTable)
      .where(and(
        sql`lower(${productAssetsTable.productId}) = lower(${productId})`,
        eq(productAssetsTable.assetType, assetType),
        eq(productAssetsTable.isActive, true)
      ))
      .orderBy(desc(productAssetsTable.id))
      .limit(1);

    if (asset.length === 0) {
      res.status(404).json({ error: `No active asset of type '${assetType}' found for product '${productId}'` });
      return;
    }

    const assetPath = path.join(PRODUCT_ASSETS_DIR, asset[0].fileName);
    if (!fs.existsSync(assetPath)) {
      res.status(404).json({ error: "Asset file not found on server" });
      return;
    }

    // Stream the binary data
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${asset[0].fileName}"`);
    res.setHeader('Content-Length', asset[0].fileSize);
    res.setHeader('X-Allocation-Size', asset[0].allocationSize || asset[0].fileSize);
    
    const stream = fs.createReadStream(assetPath);
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "Convenience stream asset error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

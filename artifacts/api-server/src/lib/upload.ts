import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { logger } from "./logger";

const AVATARS_DIR = path.resolve("uploads/avatars");
const LOADERS_DIR = path.resolve("uploads/loaders");
const ATTACHMENTS_DIR = path.resolve("uploads/attachments");
const PRODUCT_ASSETS_DIR = path.resolve("uploads/product_assets");
fs.mkdirSync(AVATARS_DIR, { recursive: true });
fs.mkdirSync(LOADERS_DIR, { recursive: true });
fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
fs.mkdirSync(PRODUCT_ASSETS_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const ALLOWED_LOADER_MIME = new Set(["application/x-msdownload", "application/octet-stream"]);
const MAX_LOADER_SIZE = 500 * 1024 * 1024; // 500MB for loader executable (admin only)

// Allowed attachment types - only images, .cfg, and .lua files
const ALLOWED_ATTACHMENT_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "text/plain", // For .cfg and .lua files
]);

// Allowed file extensions for attachments (case-insensitive)
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", // Images
  ".cfg", // Config files
  ".lua", // Lua script files
]);

// Image file extensions
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const MAX_ATTACHMENT_SIZE_IMAGE = 10 * 1024 * 1024; // 10MB for images
const MAX_ATTACHMENT_SIZE_TEXT = 2 * 1024 * 1024; // 2MB for .cfg and .lua files

const storage = multer.memoryStorage();

export const avatarUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    }
  },
});

export const loaderUpload = multer({
  storage,
  limits: {
    fileSize: MAX_LOADER_SIZE,
    files: 1,
    fields: 10,
  },
  fileFilter: (_req, file, cb) => {
    const isExeFile = file.originalname.toLowerCase().endsWith('.exe');
    const isSupportedMime = ALLOWED_LOADER_MIME.has(file.mimetype);
    const isBinaryMime = file.mimetype === 'application/octet-stream' || file.mimetype === 'application/x-msdownload';
    
    // Accept if it's an .exe file, regardless of MIME type (browsers often misreport .exe MIME types)
    // OR accept if MIME type is explicitly allowed
    if (isExeFile || isSupportedMime) {
      logger.info({ 
        filename: file.originalname, 
        mimetype: file.mimetype, 
        isExeFile, 
        isSupportedMime 
      }, "Loader file accepted");
      cb(null, true);
    } else {
      const error = new Error(`File "${file.originalname}" (MIME: ${file.mimetype}) is not an .exe file. Please upload a .exe file.`);
      logger.warn({ 
        filename: file.originalname, 
        mimetype: file.mimetype,
        isExeFile,
        isSupportedMime 
      }, "Loader file rejected");
      cb(error);
    }
  },
});

export const productAssetUpload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB maximum for product assets
    files: 1,
    fields: 10,
  },
});


export const postAttachmentUpload = multer({
  storage,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_IMAGE, // Allow up to 10MB (validated per file type below)
    files: 5, // Allow up to 5 files per post
    fields: 10,
  },
  fileFilter: (_req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const isMimeAllowed = ALLOWED_ATTACHMENT_MIME.has(file.mimetype);
    const isExtensionAllowed = ALLOWED_ATTACHMENT_EXTENSIONS.has(fileExt);
    const isImage = IMAGE_EXTENSIONS.has(fileExt) || file.mimetype.startsWith("image/");

    // Enforce file size limits per type
    if (isImage) {
      // Images can be up to 10MB
      if (file.size > MAX_ATTACHMENT_SIZE_IMAGE) {
        return cb(new Error(`Image file is too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum is 10MB.`));
      }
    } else {
      // Non-image files (.cfg, .lua) limited to 2MB
      if (file.size > MAX_ATTACHMENT_SIZE_TEXT) {
        return cb(new Error(`File is too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum is 2MB for non-image files.`));
      }
    }

    // Accept if both MIME type is allowed OR file extension is allowed
    // This handles cases where .cfg and .lua files might be detected as text/plain
    if (isMimeAllowed && isExtensionAllowed) {
      cb(null, true);
    } else if (file.mimetype.startsWith("image/") && isExtensionAllowed) {
      // Also accept any image MIME type with valid image extension
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Only images (.jpg, .png, .gif, .webp) up to 10MB, or .cfg/.lua files up to 2MB are supported.`));
    }
  },
});

export async function processAndSaveAvatar(buffer: Buffer, userId: number): Promise<string> {
  const filename = `avatar_${userId}_${Date.now()}.webp`;
  const outputPath = path.join(AVATARS_DIR, filename);

  // Use sharp to resize and re-encode — prevents EXIF exploits and buffer overflows
  await sharp(buffer)
    .resize(256, 256, { fit: "cover", position: "center" })
    .webp({ quality: 85 })
    .toFile(outputPath);

  logger.info({ userId, filename }, "Avatar processed and saved");
  return `/uploads/avatars/${filename}`;
}

export async function saveLoaderFile(buffer: Buffer, version: string, originalName: string): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("File buffer is empty");
  }

  const filename = `ScootwareHub_${version}_${Date.now()}.exe`;
  const outputPath = path.join(LOADERS_DIR, filename);

  try {
    // Ensure directory exists
    if (!fs.existsSync(LOADERS_DIR)) {
      fs.mkdirSync(LOADERS_DIR, { recursive: true });
      logger.info({ dir: LOADERS_DIR }, "Created loaders directory");
    }

    // Save binary file directly
    fs.writeFileSync(outputPath, buffer);

    logger.info({ version, filename, size: buffer.length, path: outputPath }, "Loader file saved successfully");
    return filename;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ version, filename, error: errorMsg, stack: (err as any)?.stack }, "Failed to save loader file");
    throw new Error(`Failed to save loader file: ${errorMsg}`);
  }
}

export async function savePostAttachment(buffer: Buffer, originalFilename: string): Promise<{ filename: string; filePath: string }> {
  // Sanitize filename and add timestamp for uniqueness
  const ext = path.extname(originalFilename);
  const name = path.basename(originalFilename, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `${name}_${Date.now()}${ext}`;
  const outputPath = path.join(ATTACHMENTS_DIR, filename);

  fs.writeFileSync(outputPath, buffer);

  logger.info({ originalFilename, filename, size: buffer.length }, "Post attachment saved");
  return {
    filename,
    filePath: `/uploads/attachments/${filename}`,
  };
}

export async function saveProductAssetFile(buffer: Buffer, productId: string, assetType: string, originalName: string, version: string): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error("File buffer is empty");
  }

  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `Asset_${productId}_${assetType}_${version}_${Date.now()}${ext}`;
  const outputPath = path.join(PRODUCT_ASSETS_DIR, filename);

  try {
    if (!fs.existsSync(PRODUCT_ASSETS_DIR)) {
      fs.mkdirSync(PRODUCT_ASSETS_DIR, { recursive: true });
    }
    fs.writeFileSync(outputPath, buffer);
    logger.info({ productId, assetType, filename, size: buffer.length, path: outputPath }, "Product asset file saved successfully");
    return filename;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ productId, filename, error: errorMsg }, "Failed to save product asset file");
    throw new Error(`Failed to save product asset file: ${errorMsg}`);
  }
}


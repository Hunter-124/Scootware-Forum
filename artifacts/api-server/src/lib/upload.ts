import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { logger } from "./logger";

const AVATARS_DIR = path.resolve("uploads/avatars");
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

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

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import multer from 'multer';

const DEFAULT_TMP_DIR = os.tmpdir();

export function createDiskUpload(options: {
  fileSizeBytes: number;
  fileFilter?: Parameters<typeof multer>[0]['fileFilter'];
}): multer.Multer {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DEFAULT_TMP_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      const name = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      cb(null, name);
    },
  });

  return multer({
    storage,
    limits: { fileSize: options.fileSizeBytes },
    fileFilter: options.fileFilter,
  });
}

export async function readUploadBuffer(file: Express.Multer.File): Promise<Buffer> {
  if (file.buffer) {
    return file.buffer;
  }
  if (file.path) {
    return await fs.readFile(file.path);
  }
  throw new Error('Uploaded file has no buffer or path');
}

export async function cleanupUploadFile(file?: Express.Multer.File | null): Promise<void> {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch {
    // Ignore cleanup errors (file may already be removed).
  }
}

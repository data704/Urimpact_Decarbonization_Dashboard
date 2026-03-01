import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { config } from '../config/index.js';
import { sanitizeFileName, getFileExtension } from '../utils/helpers.js';

// Ensure upload directory exists
const uploadDir = config.upload.uploadDir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueId = uuidv4();
    const extension = getFileExtension(file.originalname);
    const sanitizedName = sanitizeFileName(
      path.basename(file.originalname, `.${extension}`)
    );
    const filename = `${sanitizedName}-${uniqueId}.${extension}`;
    cb(null, filename);
  },
});

// File filter function
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const extension = getFileExtension(file.originalname).toLowerCase();
  const allowedTypes = config.upload.allowedFileTypes;

  if (allowedTypes.includes(extension)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      )
    );
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1, // Single file upload
  },
});

// Multiple files upload (for batch uploads)
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 10, // Max 10 files at once
  },
});

// Memory storage for OCR processing (when we don't need to save locally)
const memoryStorage = multer.memoryStorage();

export const uploadToMemory = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
  },
});

/**
 * Delete a file from uploads directory
 */
export async function deleteUploadedFile(filename: string): Promise<void> {
  const filePath = path.join(uploadDir, filename);
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    // File might not exist, ignore error
    console.error(`Failed to delete file: ${filePath}`, error);
  }
}

/**
 * Get full path to uploaded file
 */
export function getUploadedFilePath(filename: string): string {
  return path.join(uploadDir, filename);
}

/**
 * Check if uploaded file exists
 */
export async function uploadedFileExists(filename: string): Promise<boolean> {
  const filePath = path.join(uploadDir, filename);
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

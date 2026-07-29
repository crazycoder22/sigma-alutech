// Image storage abstraction.
// - Production (Vercel): @vercel/blob, activated by BLOB_READ_WRITE_TOKEN.
// - Dev/tests: files under public/uploads, served statically by Next.
import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export class UploadError extends Error {}

export function validateUpload(contentType: string, sizeBytes: number): string {
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    throw new UploadError(
      `Unsupported image type "${contentType}". Use JPG, PNG, WebP, AVIF, or SVG.`
    );
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `File is ${(sizeBytes / 1024 / 1024).toFixed(1)} MB — the limit is 8 MB. Please resize/compress it.`
    );
  }
  return ext;
}

export function uploadKey(folder: string, originalName: string, ext: string): string {
  const base = originalName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'image';
  const stamp = crypto.randomBytes(4).toString('hex');
  return `${folder}/${base}-${stamp}${ext}`;
}

function usingBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Store an uploaded image and return its public URL.
 * `folder` is a logical prefix like "products" or "projects".
 */
export async function saveImage(
  file: { name: string; type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> },
  folder: string
): Promise<string> {
  const ext = validateUpload(file.type, file.size);
  const key = uploadKey(folder, file.name, ext);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (usingBlob()) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${key}`, bytes, {
      access: 'public',
      contentType: file.type,
    });
    return blob.url;
  }

  const target = path.join(process.cwd(), 'public', 'uploads', key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return `/uploads/${key}`;
}

/**
 * Store a generated document (payslip PDFs) and return its URL.
 * Same drivers as images; the caller supplies the exact filename because
 * it is what the employee sees in WhatsApp.
 */
export async function saveDocument(
  bytes: Buffer,
  folder: string,
  filename: string,
  contentType = 'application/pdf'
): Promise<string> {
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '');
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${safeFolder}/${safeName}`;

  if (usingBlob()) {
    const { put } = await import('@vercel/blob');
    // A payslip is somebody's salary. Blob "public" means readable by
    // anyone holding the URL, so the URL has to be the secret: a random
    // suffix makes it unguessable, where documents/payslips/2026-06/
    // payslip-2026-06-<name>.pdf could be typed by anyone who knew a name.
    // Callers delete the previous object when they replace one.
    const blob = await put(`documents/${key}`, bytes, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
    });
    return blob.url;
  }

  const target = path.join(process.cwd(), 'public', 'uploads', 'documents', key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return `/uploads/documents/${key}`;
}

/**
 * Best-effort delete of a previously stored file (either driver).
 *
 * Also the way a payslip URL is revoked: the old object must go, or the
 * superseded link keeps working.
 */
export async function deleteStored(url: string): Promise<void> {
  try {
    if (url.startsWith('/uploads/')) {
      const rel = url.replace(/^\/+/, '');
      // Guard against path traversal before touching the filesystem.
      const target = path.join(process.cwd(), 'public', rel);
      if (!target.startsWith(path.join(process.cwd(), 'public', 'uploads'))) return;
      await unlink(target);
    } else if (url.includes('.blob.vercel-storage.com') && usingBlob()) {
      const { del } = await import('@vercel/blob');
      await del(url);
    }
    // Other URLs (legacy /images/... paths) are shared assets; never delete.
  } catch {
    // Deletion is best-effort; a dangling file is not an error for the caller.
  }
}

/** Kept for the image call sites. */
export const deleteImage = deleteStored;

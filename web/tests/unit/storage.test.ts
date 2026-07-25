import { describe, it, expect } from 'vitest';
import { validateUpload, uploadKey, UploadError, MAX_UPLOAD_BYTES } from '@/lib/storage';

describe('validateUpload', () => {
  it('accepts supported image types and returns the extension', () => {
    expect(validateUpload('image/jpeg', 1000)).toBe('.jpg');
    expect(validateUpload('image/png', 1000)).toBe('.png');
    expect(validateUpload('image/webp', 1000)).toBe('.webp');
    expect(validateUpload('image/svg+xml', 1000)).toBe('.svg');
  });

  it('rejects unsupported types', () => {
    expect(() => validateUpload('application/pdf', 1000)).toThrow(UploadError);
    expect(() => validateUpload('video/mp4', 1000)).toThrow(UploadError);
    expect(() => validateUpload('text/html', 1000)).toThrow(UploadError);
  });

  it('rejects files over the size limit', () => {
    expect(() => validateUpload('image/jpeg', MAX_UPLOAD_BYTES + 1)).toThrow(UploadError);
    expect(validateUpload('image/jpeg', MAX_UPLOAD_BYTES)).toBe('.jpg');
  });
});

describe('uploadKey', () => {
  it('slugifies the original name and appends a random suffix', () => {
    const key = uploadKey('products', 'My Fancy Window (1).JPG', '.jpg');
    expect(key).toMatch(/^products\/my-fancy-window-1-[0-9a-f]{8}\.jpg$/);
  });

  it('falls back to "image" for unusable names', () => {
    const key = uploadKey('projects', '###.png', '.png');
    expect(key).toMatch(/^projects\/image-[0-9a-f]{8}\.png$/);
  });

  it('generates unique keys for identical files', () => {
    expect(uploadKey('p', 'a.jpg', '.jpg')).not.toBe(uploadKey('p', 'a.jpg', '.jpg'));
  });
});

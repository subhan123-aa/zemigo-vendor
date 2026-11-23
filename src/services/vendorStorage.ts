import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firebaseStorage } from '@/lib/firebase';

export type VendorStorageFolder = 'products' | 'vendors';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (matches storage.rules)
const MAX_FALLBACK_DATA_URL_LENGTH = 720_000;
const STORAGE_UPLOAD_TIMEOUT_MS = 5000;
const ALLOWED_IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i;

/**
 * Compresses an image file in the browser into a compact JPEG Data URL (< ~80 KB)
 * so product/logo images still persist cleanly in Firestore when the Firebase Storage
 * bucket has not been provisioned yet on the Firebase Spark plan.
 */
async function compressImageToDataUrl(
  file: File,
  maxDimension = 640,
  quality = 0.78
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error(
      'Firebase Storage upload failed: Storage bucket is unreachable or not provisioned.'
    );
  }

  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let width = img.naturalWidth || img.width || 400;
        let height = img.naturalHeight || img.height || 400;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * maxDimension) / width));
            width = maxDimension;
          } else {
            width = Math.max(1, Math.round((width * maxDimension) / height));
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Firebase Storage upload failed: Unable to process image.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (err) {
        reject(
          err instanceof Error
            ? err
            : new Error('Firebase Storage upload failed while processing image.')
        );
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          'Firebase Storage error: Selected file could not be decoded as a valid image.'
        )
      );
    };

    img.src = objectUrl;
  });
}

function formatStorageError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const rawMsg =
    err instanceof Error ? err.message : String(err || 'Unknown Storage error');

  if (code === 'storage/unauthorized') {
    return 'Firebase Storage permission denied: You can only upload valid images (< 5 MB) to your own vendor account folder.';
  }
  if (code === 'storage/quota-exceeded') {
    return 'Firebase Storage quota exceeded for this project.';
  }
  if (code === 'storage/invalid-argument') {
    return `Firebase Storage invalid file: ${rawMsg}`;
  }
  return `Firebase Storage upload failed (${code || 'network/bucket error'}): ${rawMsg}`;
}

/**
 * Uploads an image/asset strictly inside the authenticated vendor's isolated Storage namespace:
 * `zemigo/{folder}/{vendorId}/{timestamp}_{safeName}`
 *
 * Includes:
 * - Strict client-side validation matching `storage.rules` (`image/*` and `< 5 MB`).
 * - A 5-second timeout guard so an unprovisioned Storage bucket (404 / CORS) never
 *   leaves the submit button stuck in "Saving Product..." for 10 minutes.
 * - Automatic compressed Data URL fallback when the Firebase Storage bucket is not
 *   yet provisioned on the project, while surfacing explicit Storage authorization errors.
 */
export async function uploadVendorAsset(
  vendorId: string,
  folder: VendorStorageFolder,
  file: File
): Promise<string> {
  const cleanVendorId = vendorId.trim();
  if (!cleanVendorId) {
    throw new Error(
      'Firebase Storage error: Vendor authentication is required before uploading files.'
    );
  }
  if (!firebaseStorage) {
    throw new Error(
      'Firebase Storage error: Storage is not configured. Check VITE_FIREBASE_* keys in .env.'
    );
  }

  const hasValidMime = Boolean(file.type && file.type.startsWith('image/'));
  const hasValidExt = ALLOWED_IMAGE_EXT_RE.test(file.name || '');
  if ((file.type && !file.type.startsWith('image/')) || (!file.type && !hasValidExt)) {
    throw new Error(
      'Firebase Storage error: Only image files (PNG, JPG, WEBP) are allowed.'
    );
  }
  if (!hasValidMime && !hasValidExt) {
    throw new Error(
      'Firebase Storage error: Only image files (PNG, JPG, WEBP) are allowed.'
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(
      'Firebase Storage error: Image size must be under 5 MB.'
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `zemigo/${folder}/${cleanVendorId}/${Date.now()}_${safeName}`;
  const storageRef = ref(firebaseStorage, objectPath);

  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    const uploadPromise = (async () => {
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg',
      });
      return getDownloadURL(snapshot.ref);
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            'Firebase Storage upload timed out (Storage bucket may not be provisioned yet).'
          )
        );
      }, STORAGE_UPLOAD_TIMEOUT_MS);
    });

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';

    // Never bypass explicit security rule rejections
    if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
      throw new Error(formatStorageError(err));
    }

    // If the Storage bucket is unprovisioned (HTTP 404 / CORS / retry-limit / timeout),
    // fall back to a compact compressed Data URL so product creation does not hang or fail.
    try {
      let dataUrl = await compressImageToDataUrl(file);
      if (dataUrl.length > MAX_FALLBACK_DATA_URL_LENGTH) {
        dataUrl = await compressImageToDataUrl(file, 480, 0.62);
      }
      if (dataUrl.length > MAX_FALLBACK_DATA_URL_LENGTH) {
        throw new Error(
          'Compressed image still exceeds Firestore document size limit (720 KB). Please select a smaller image.'
        );
      }
      return dataUrl;
    } catch (fallbackErr) {
      if (
        fallbackErr instanceof Error &&
        fallbackErr.message.includes('Firestore document size limit')
      ) {
        throw fallbackErr;
      }
      throw new Error(formatStorageError(err));
    }
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

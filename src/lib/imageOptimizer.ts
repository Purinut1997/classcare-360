/**
 * Unified client-side WebP image conversion and smart resizing utility.
 * Converts uploaded images into crisp, lightweight `.webp` files to save storage space
 * while preserving readability for avatars, slips, QR codes, school logos, documents, and field photos.
 */

export interface WebpOptimizeOptions {
  /** Maximum length (px) of the longest edge. Never upscales smaller images. */
  maxEdge: number;
  /** WebP quality between 0 and 1. */
  quality: number;
  /** Crop to a crisp 1:1 square (ideal for student portraits / avatars). */
  squareCrop?: boolean;
  /** Preserve alpha channel (e.g., transparent school logos). Defaults to false (white backdrop). */
  preserveTransparency?: boolean;
  /** Optional fallback basename when input file has no valid stem. */
  fallbackName?: string;
}

export interface WebpOptimizeResult {
  file: File;
  originalBytes: number;
  optimizedBytes: number;
  savedPercent: number;
  wasConverted: boolean;
}

export const IMAGE_WEBP_PRESETS = {
  /** Student ID / profile portrait (512x512 square .webp ~25-45 KB) */
  student_avatar: {
    maxEdge: 512,
    quality: 0.85,
    squareCrop: true,
    preserveTransparency: false,
    fallbackName: 'student-avatar',
  },
  /** Compact circular thumbnail (192x192 square .webp ~6-12 KB) */
  avatar_thumb: {
    maxEdge: 192,
    quality: 0.80,
    squareCrop: true,
    preserveTransparency: false,
    fallbackName: 'student-avatar-thumb',
  },
  /** Medical certificates, leave notes, OMR / score sheets (sharp text up to 1600px) */
  document_scan: {
    maxEdge: 1600,
    quality: 0.86,
    squareCrop: false,
    preserveTransparency: false,
    fallbackName: 'document-scan',
  },
  /** Scannable PromptPay / bank QR codes: ultra-sharp edges, compact WebP size */
  payment_qr: {
    maxEdge: 900,
    quality: 0.92,
    preserveTransparency: false,
    fallbackName: 'payment-qr',
  },
  /** Bank transfer slips: crisp text, ref numbers & QR readability with high compression */
  payment_slip: {
    maxEdge: 1440,
    quality: 0.84,
    preserveTransparency: false,
    fallbackName: 'payment-slip',
  },
  /** Home visit photos, behavior evidence & daily brief attachments */
  photo: {
    maxEdge: 1440,
    quality: 0.82,
    preserveTransparency: false,
    fallbackName: 'photo',
  },
  /** School logos & emblems for A4 reports */
  logo: {
    maxEdge: 560,
    quality: 0.86,
    preserveTransparency: true,
    fallbackName: 'school-logo',
  },
} as const satisfies Record<string, WebpOptimizeOptions>;

export function formatFileBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function toWebpFileName(originalName: string, fallbackName = 'image'): string {
  const stem = originalName
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9ก-๙._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${stem || fallbackName}.webp`;
}

function isConvertibleImage(file: File): boolean {
  if (!file) return false;
  if (file.type === 'image/svg+xml') return false;
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|bmp|avif|heic|heif|gif)$/i.test(file.name);
}

interface DecodedCanvasResult {
  canvas: HTMLCanvasElement;
  naturalLongestEdge: number;
}

function drawSourceIntoCanvas(
  source: CanvasImageSource,
  naturalW: number,
  naturalH: number,
  options: WebpOptimizeOptions,
): DecodedCanvasResult | null {
  if (!naturalW || !naturalH) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const naturalLongestEdge = Math.max(naturalW, naturalH);

  if (options.squareCrop) {
    const side = Math.min(naturalW, naturalH);
    const outEdge = Math.max(1, Math.min(options.maxEdge, side));
    const sx = Math.max(0, Math.round((naturalW - side) / 2));
    // Slight upper bias (25%) keeps student faces centered in portrait photos
    const sy = Math.max(0, Math.round((naturalH - side) * 0.25));

    canvas.width = outEdge;
    canvas.height = outEdge;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (!options.preserveTransparency) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outEdge, outEdge);
    }

    ctx.drawImage(source, sx, sy, side, side, 0, 0, outEdge, outEdge);
    return { canvas, naturalLongestEdge };
  }

  const scale = naturalLongestEdge > options.maxEdge ? options.maxEdge / naturalLongestEdge : 1;
  const width = Math.max(1, Math.round(naturalW * scale));
  const height = Math.max(1, Math.round(naturalH * scale));

  canvas.width = width;
  canvas.height = height;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (!options.preserveTransparency) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, naturalLongestEdge };
}

async function decodeImageToCanvas(
  file: File,
  options: WebpOptimizeOptions,
): Promise<DecodedCanvasResult | null> {
  // Prefer createImageBitmap with EXIF orientation support (prevents sideways mobile photos)
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const result = drawSourceIntoCanvas(bitmap, bitmap.width, bitmap.height, options);
      if (result) return result;
    } catch {
      // Fallback to HTMLImageElement below
    } finally {
      bitmap?.close();
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
      el.src = objectUrl;
    });

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    return drawSourceIntoCanvas(img, naturalW, naturalH, options);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Converts any raster image File to a resized, sharp `.webp` File and reports compression stats.
 * Non-image files (such as PDFs or JSON backups) are returned unchanged.
 */
export async function convertImageToWebpWithStats(
  file: File,
  options: WebpOptimizeOptions = IMAGE_WEBP_PRESETS.photo,
): Promise<WebpOptimizeResult> {
  const originalBytes = file.size || 0;
  if (!isConvertibleImage(file)) {
    return {
      file,
      optimizedBytes: originalBytes,
      originalBytes,
      savedPercent: 0,
      wasConverted: false,
    };
  }

  try {
    const decoded = await decodeImageToCanvas(file, options);
    if (!decoded) {
      return {
        file,
        optimizedBytes: originalBytes,
        originalBytes,
        savedPercent: 0,
        wasConverted: false,
      };
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      decoded.canvas.toBlob((result) => resolve(result), 'image/webp', options.quality);
    });

    if (!blob || blob.size === 0) {
      return {
        file,
        optimizedBytes: originalBytes,
        originalBytes,
        savedPercent: 0,
        wasConverted: false,
      };
    }

    // Smart size guard: avoid re-encoding already compact WebP images unless cropped/downscaled
    if (
      file.type === 'image/webp' &&
      !options.squareCrop &&
      decoded.naturalLongestEdge <= options.maxEdge &&
      blob.size >= originalBytes
    ) {
      return {
        file,
        optimizedBytes: originalBytes,
        originalBytes,
        savedPercent: 0,
        wasConverted: false,
      };
    }

    const encodedType = blob.type === 'image/webp' ? 'image/webp' : blob.type || 'image/webp';
    const nextName = encodedType === 'image/webp'
      ? toWebpFileName(file.name, options.fallbackName)
      : file.name;

    const nextFile = new File([blob], nextName, {
      lastModified: Date.now(),
      type: encodedType,
    });

    const savedPercent =
      originalBytes > 0
        ? Math.max(0, Math.round(((originalBytes - nextFile.size) / originalBytes) * 100))
        : 0;

    return {
      file: nextFile,
      optimizedBytes: nextFile.size,
      originalBytes,
      savedPercent,
      wasConverted: true,
    };
  } catch {
    return {
      file,
      optimizedBytes: originalBytes,
      originalBytes,
      savedPercent: 0,
      wasConverted: false,
    };
  }
}

/**
 * Converts any raster image File to a resized, sharp `.webp` File.
 * Non-image files (such as PDFs) are returned unchanged.
 */
export async function convertImageToWebp(
  file: File,
  options: WebpOptimizeOptions = IMAGE_WEBP_PRESETS.photo,
): Promise<File> {
  const result = await convertImageToWebpWithStats(file, options);
  return result.file;
}

/**
 * Converts an image File to a resized WebP data URL (for embedded logos/settings).
 */
export async function convertImageToWebpDataUrl(
  file: File,
  options: WebpOptimizeOptions = IMAGE_WEBP_PRESETS.logo,
): Promise<string> {
  const decoded = await decodeImageToCanvas(file, options);
  if (!decoded) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  const webpDataUrl = decoded.canvas.toDataURL('image/webp', options.quality);
  if (webpDataUrl.startsWith('data:image/webp')) {
    return webpDataUrl;
  }
  return decoded.canvas.toDataURL('image/png');
}

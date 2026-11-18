/**
 * Unified client-side WebP image conversion and smart resizing utility.
 * Converts uploaded images into crisp, lightweight .webp files to save storage space
 * while preserving readability for slips, QR codes, school logos, and field photos.
 */

export interface WebpOptimizeOptions {
  /** Maximum length (px) of the longest edge. Never upscales smaller images. */
  maxEdge: number;
  /** WebP quality between 0 and 1. */
  quality: number;
  /** Preserve alpha channel (e.g., transparent school logos). Defaults to false (white backdrop). */
  preserveTransparency?: boolean;
  /** Optional fallback basename when input file has no valid stem. */
  fallbackName?: string;
}

export const IMAGE_WEBP_PRESETS = {
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
  /** Home visit photos & daily brief attachments */
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

async function decodeImageToCanvas(
  file: File,
  options: WebpOptimizeOptions,
): Promise<HTMLCanvasElement | null> {
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
    if (!naturalW || !naturalH) return null;

    const longestEdge = Math.max(naturalW, naturalH);
    const scale = longestEdge > options.maxEdge ? options.maxEdge / longestEdge : 1;
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (!options.preserveTransparency) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
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
  if (!isConvertibleImage(file)) {
    return file;
  }

  try {
    const canvas = await decodeImageToCanvas(file, options);
    if (!canvas) return file;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/webp', options.quality);
    });

    if (!blob || blob.size === 0) {
      return file;
    }

    // Verify browser actually encoded WebP (modern Chrome/Safari/Firefox/Edge all support it)
    const encodedType = blob.type === 'image/webp' ? 'image/webp' : blob.type || 'image/webp';
    const nextName = encodedType === 'image/webp'
      ? toWebpFileName(file.name, options.fallbackName)
      : file.name;

    return new File([blob], nextName, {
      lastModified: Date.now(),
      type: encodedType,
    });
  } catch {
    return file;
  }
}

/**
 * Converts an image File to a resized WebP data URL (for embedded logos/settings).
 */
export async function convertImageToWebpDataUrl(
  file: File,
  options: WebpOptimizeOptions = IMAGE_WEBP_PRESETS.logo,
): Promise<string> {
  const canvas = await decodeImageToCanvas(file, options);
  if (!canvas) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  const webpDataUrl = canvas.toDataURL('image/webp', options.quality);
  if (webpDataUrl.startsWith('data:image/webp')) {
    return webpDataUrl;
  }
  return canvas.toDataURL('image/png');
}

export const MEDIA_BUCKET = 'quizomat-media';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml'
];

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg'
};

/**
 * Validates that an image URL is safe to render in <img src>.
 * Blocks javascript: and other unsafe schemes.
 */
export function isValidImageUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(s)) return true;
  return false;
}

export function sanitizeExt(mimeType, fileName = '') {
  if (EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType];
  const m = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  if (m && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(m[1])) {
    return m[1] === 'jpeg' ? 'jpg' : m[1];
  }
  return 'webp';
}

export function buildStoragePath(userId, mimeType, fileName = '', randomId) {
  const ext = sanitizeExt(mimeType, fileName);
  const id =
    randomId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10));
  return `${userId}/${id}.${ext}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses raster images (PNG/JPEG/WebP) in the browser to keep uploads fast and crisp.
 * Leaves SVG and GIF untouched.
 */
export async function compressImageFile(file, maxDim = 1280, quality = 0.84) {
  if (!file) throw new Error('Keine Bilddatei ausgewählt.');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Das Bild ist größer als 5 MB. Bitte wähle eine kleinere Datei.');
  }
  const type = file.type || '';
  if (type && !ALLOWED_MIME_TYPES.includes(type)) {
    throw new Error('Nicht unterstütztes Bildformat (erlaubt: PNG, JPG, WebP, GIF, SVG).');
  }
  if (
    type === 'image/svg+xml' ||
    type === 'image/gif' ||
    typeof document === 'undefined' ||
    typeof createImageBitmap !== 'function'
  ) {
    return { blob: file, mimeType: type || 'image/png' };
  }

  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    if (typeof bmp.close === 'function') bmp.close();

    const targetMime = type === 'image/png' ? 'image/webp' : type;
    const outBlob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), targetMime, quality)
    );
    if (outBlob && outBlob.size < file.size) {
      return { blob: outBlob, mimeType: outBlob.type || targetMime };
    }
    return { blob: file, mimeType: type };
  } catch {
    return { blob: file, mimeType: type || 'image/png' };
  }
}

/**
 * Uploads a question image to Supabase Storage if authenticated,
 * otherwise stores a compressed Data URL locally for offline use.
 */
export async function uploadQuestionImage(supabase, userId, file) {
  if (supabase && userId) {
    const { blob, mimeType } = await compressImageFile(file, 1400, 0.85);
    const path = buildStoragePath(userId, mimeType, file.name);
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '31536000'
    });
    if (error) throw new Error('Bild-Upload fehlgeschlagen: ' + error.message);
    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, storagePath: path, localOnly: false };
  }

  const { blob } = await compressImageFile(file, 960, 0.76);
  const dataUrl = await blobToDataUrl(blob);
  return { url: dataUrl, storagePath: '', localOnly: true };
}

export async function deleteQuestionImage(supabase, storagePath) {
  if (!supabase || !storagePath) return;
  try {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
  } catch {
    // Non-fatal cleanup
  }
}

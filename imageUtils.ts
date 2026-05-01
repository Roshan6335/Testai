/**
 * Compresses a base64 image or File object to a target size and dimension.
 * 
 * Handles transparency preservation for PNG/WebP and skips GIF compression
 * to preserve animation frames.
 */
export async function compressImage(
  input: string | File,
  maxWidth = 1024,
  quality = 0.7
): Promise<{ url: string; size: number }> {
  return new Promise((resolve, reject) => {
    // Skip compression for GIF files — canvas destroys animation frames
    if (input instanceof File && input.type === 'image/gif') {
      fileToBase64(input).then(url => {
        resolve({ url, size: input.size });
      }).catch(reject);
      return;
    }
    if (typeof input === 'string' && input.startsWith('data:image/gif')) {
      resolve({ url: input, size: Math.floor(input.length * 0.75) });
      return;
    }

    let src: string;
    let hasAlpha = false;

    if (input instanceof File) {
      // Check if the file type supports transparency
      hasAlpha = input.type === 'image/png' || input.type === 'image/webp';
      src = URL.createObjectURL(input);
    } else {
      hasAlpha = input.startsWith('data:image/png') || input.startsWith('data:image/webp');
      src = input;
    }

    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Failed to get canvas 2D context"));
        return;
      }

      if (hasAlpha) {
        // Preserve transparency: use PNG output format
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/png');
        if (input instanceof File) URL.revokeObjectURL(src);
        const size = Math.floor(compressedUrl.length * 0.75);
        resolve({ url: compressedUrl, size });
      } else {
        // No transparency: safe to use JPEG for better compression
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const compressedUrl = canvas.toDataURL('image/jpeg', quality);
        if (input instanceof File) URL.revokeObjectURL(src);
        const size = Math.floor(compressedUrl.length * 0.75);
        resolve({ url: compressedUrl, size });
      }
    };
    img.onerror = () => {
      if (input instanceof File) URL.revokeObjectURL(src);
      reject(new Error("Failed to load image for compression"));
    };
  });
}

/**
 * Converts a File object to a base64 string.
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

/**
 * Converts a base64 string back to a File object if needed.
 */
export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Compresses a base64 image or File object to a target size and dimension.
 */
export async function compressImage(
  input: string | File,
  maxWidth = 1024,
  quality = 0.7
): Promise<{ url: string; size: number }> {
  return new Promise((resolve, reject) => {
    let src: string;
    if (input instanceof File) {
      src = URL.createObjectURL(input);
    } else {
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
      ctx?.drawImage(img, 0, 0, width, height);
      
      const compressedUrl = canvas.toDataURL('image/jpeg', quality);
      // Clean up if we created the object URL
      if (input instanceof File) URL.revokeObjectURL(src);
      
      // Estimate size: (length * 0.75)
      const size = Math.floor(compressedUrl.length * 0.75);
      
      resolve({ url: compressedUrl, size });
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

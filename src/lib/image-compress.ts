import imageCompression from 'browser-image-compression';

export async function compressImage(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<File> {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: file.type === 'image/png' ? 'image/png' : 'image/webp',
    initialQuality: 0.8,
    onProgress: onProgress
      ? (progress: number) => {
          onProgress(Math.max(0, Math.min(100, Math.round(progress))));
        }
      : undefined,
  };

  try {
    return await imageCompression(file, options);
  } catch {
    onProgress?.(100);
    return file;
  }
}

export async function generateThumbnail(dataUrl: string, maxWidth = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png', 0.8));
    };
    img.onerror = () => reject(new Error('Error loading image'));
    img.src = dataUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

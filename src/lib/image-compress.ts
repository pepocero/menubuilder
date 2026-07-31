import imageCompression from 'browser-image-compression';

export type ImageCompressProfile = 'default' | 'mobile';

const PROFILE_OPTIONS: Record<
  ImageCompressProfile,
  {
    maxSizeMB: number;
    maxWidthOrHeight: number;
    initialQuality: number;
  }
> = {
  // Editor clásico / impresión en pantalla grande
  default: {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    initialQuality: 0.8,
  },
  // Cartas móviles: ~3x DPR en ~430css ≈ 1290px; 1400 deja margen sin sobredimensionar
  mobile: {
    maxSizeMB: 0.4,
    maxWidthOrHeight: 1400,
    initialQuality: 0.82,
  },
};

export async function compressImage(
  file: File,
  onProgress?: (percent: number) => void,
  profile: ImageCompressProfile = 'default',
): Promise<File> {
  const preset = PROFILE_OPTIONS[profile];
  const options = {
    maxSizeMB: preset.maxSizeMB,
    maxWidthOrHeight: preset.maxWidthOrHeight,
    useWebWorker: true,
    // WebP: buena nitidez a menor peso; alpha OK (fondos/sección).
    // En default conservamos PNG si el original lo es (plantillas/transparencias del lienzo).
    fileType:
      profile === 'mobile'
        ? 'image/webp'
        : file.type === 'image/png'
          ? 'image/png'
          : 'image/webp',
    initialQuality: preset.initialQuality,
    onProgress: onProgress
      ? (progress: number) => {
          onProgress(Math.max(0, Math.min(100, Math.round(progress))));
        }
      : undefined,
  };

  try {
    const compressed = await imageCompression(file, options);
    // Si no reduce, devolver original (evita subir basura peor)
    if (compressed.size >= file.size && file.type === compressed.type) {
      onProgress?.(100);
      return file;
    }
    return compressed;
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

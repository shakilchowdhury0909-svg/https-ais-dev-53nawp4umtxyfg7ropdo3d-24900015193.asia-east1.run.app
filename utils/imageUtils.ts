export async function fetchImageAsBase64(url: string): Promise<{ base64: string, mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const [prefix, base64] = dataUrl.split(',');
      const mimeType = prefix.match(/:(.*?);/)?.[1] || 'image/jpeg';
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // The result is a data URL like "data:image/png;base64,iVBORw0KGgo...", we need only the base64 part.
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error('Failed to read file as base64 string.'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

export function rotateImage(imageUrl: string, rotation: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      const { width, height } = img;
      const rads = (rotation * Math.PI) / 180;

      // For 90 or 270 degrees, swap width and height
      if (rotation === 90 || rotation === 270) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rads);
      ctx.drawImage(img, -width / 2, -height / 2);

      // We use 'image/png' to preserve transparency, if any.
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = (error) => reject(error);
    img.src = imageUrl;
  });
}

export function applyFiltersToCanvas(
  imageUrl: string,
  brightness: number,
  contrast: number,
  saturation: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // FIX: Corrected the Image constructor call from `new new Image()` to `new Image()`.
    const img = new Image();
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous'; // Essential for loading images from other origins without tainting the canvas
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context for applying filters'));
      }

      canvas.width = img.width;
      canvas.height = img.height;

      // Apply filters to the canvas context before drawing the image
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      // Get the data URL of the filtered image
      const dataUrl = canvas.toDataURL('image/png'); // Use PNG to preserve quality/transparency
      resolve(dataUrl);
    };
    img.onerror = (error) => reject(error);
    img.src = imageUrl;
  });
}
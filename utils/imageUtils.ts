export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export function rotateImage(imageUrl: string, degrees: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageUrl);
        return;
      }

      const rad = (degrees * Math.PI) / 180;
      const isPerpendicular = Math.abs(degrees % 180) === 90;
      canvas.width = isPerpendicular ? img.height : img.width;
      canvas.height = isPerpendicular ? img.width : img.height;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => reject(e);
  });
}

export function applyFiltersToCanvas(
  canvas: HTMLCanvasElement,
  filters: { brightness: number; contrast: number; saturation: number }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`;
}

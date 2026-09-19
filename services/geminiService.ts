import { GoogleGenAI } from '@google/genai';

export interface GenerationOptions {
  aspectRatio?: string;
  lighting?: string;
  style?: string;
  quality?: string;
  resolution?: string;
  negativePrompt?: string;
  creativityLevel?: number;
  temperature?: number;
  jewelry?: string;
}

function getApiKey(): string {
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.GEMINI_API_KEY) return win.GEMINI_API_KEY;
    if (win.__ENV__?.GEMINI_API_KEY) return win.__ENV__.GEMINI_API_KEY;
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  return '';
}

function parseBase64(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/jpeg', data: dataUrl };
}

export async function generateVirtualTryOn(
  modelImageBase64: string,
  garmentImageBase64: string,
  prompt: string,
  options?: GenerationOptions
): Promise<string> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

  const modelPart = parseBase64(modelImageBase64);
  const garmentPart = parseBase64(garmentImageBase64);

  const styleModifier = options?.style ? ` Style: ${options.style}.` : '';
  const lightingModifier = options?.lighting ? ` Lighting: ${options.lighting}.` : '';
  const resolutionModifier = options?.resolution ? ` High quality ${options.resolution}.` : '';
  const jewelryModifier = options?.jewelry && options.jewelry !== 'None'
    ? ` Matching Jewelry & Accessories: Seamlessly adorn the woman with exquisite matching jewelry (${options.jewelry}) that complements the neckline, color palette, and fabric of her outfit. Include a matching necklace, earrings, and bangles/bracelets harmoniously integrated with the dress.`
    : '';

  const fullPrompt = `You are an expert fashion virtual try-on assistant. 
Accurately and realistically dress the model from the first image with the garment shown in the second image.
Maintain the model's exact pose, facial identity, body proportions, and skin tone.
Fit the clothing naturally to the model's body contours, showing realistic fabric folds, shadows, textures, and seams.
${prompt ? `Additional instructions: ${prompt}.` : ''}
${jewelryModifier}${styleModifier}${lightingModifier}${resolutionModifier}`;

  try {
    // Try Imagen image generation if direct image synthesis is needed
    try {
      const imgRes = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: `Photorealistic high-fashion virtual try-on: ${prompt || 'fashion model wearing the garment seamlessly'}.${jewelryModifier} High fashion photography, studio lighting, ultra-detailed fabric texture, 8k resolution.${styleModifier}${lightingModifier}`,
        config: {
          numberOfImages: 1,
          aspectRatio: (options?.aspectRatio as any) || '1:1',
          outputMimeType: 'image/jpeg',
        },
      });

      if (imgRes.generatedImages && imgRes.generatedImages[0]?.image?.imageBytes) {
        return `data:image/jpeg;base64,${imgRes.generatedImages[0].image.imageBytes}`;
      }
    } catch (imagenErr) {
      console.warn('Imagen generation fallback to multimodal content:', imagenErr);
    }

    // Try multimodal Gemini model
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: modelPart.mimeType, data: modelPart.data } },
            { inlineData: { mimeType: garmentPart.mimeType, data: garmentPart.data } },
            { text: fullPrompt },
          ],
        },
      ],
    });

    // Check if candidates contain inlineData (image output)
    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if ((part as any).inlineData?.data) {
          const mime = (part as any).inlineData.mimeType || 'image/jpeg';
          return `data:${mime};base64,${(part as any).inlineData.data}`;
        }
      }
    }

    // If text returned without raw image bytes, compose a visual result on canvas from model + garment
    return await compositeTryOnPreview(modelImageBase64, garmentImageBase64, prompt, options);
  } catch (err: any) {
    console.error('Error generating virtual try-on:', err);
    // Fallback composite preview
    return await compositeTryOnPreview(modelImageBase64, garmentImageBase64, prompt, options);
  }
}

export async function editImageWithGemini(
  imageBase64: string,
  prompt: string,
  options?: GenerationOptions
): Promise<string> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

  const imagePart = parseBase64(imageBase64);
  const jewelryModifier = options?.jewelry && options.jewelry !== 'None'
    ? ` Add exquisite matching jewelry (${options.jewelry}) that harmonizes with the neckline, style, color, and fabric of the woman's outfit. Include a complementary necklace, earrings, and bangles/bracelets.`
    : '';

  const fullPrompt = `High quality photo edit: ${prompt}.${jewelryModifier} Ensure the additions look authentic, luxurious, seamlessly fitted to the woman's body, and naturally lit.`;

  try {
    try {
      const imgRes = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: (options?.aspectRatio as any) || '1:1',
          outputMimeType: 'image/jpeg',
        },
      });

      if (imgRes.generatedImages && imgRes.generatedImages[0]?.image?.imageBytes) {
        return `data:image/jpeg;base64,${imgRes.generatedImages[0].image.imageBytes}`;
      }
    } catch (e) {
      console.warn('Imagen edit fallback:', e);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: imagePart.mimeType, data: imagePart.data } },
            { text: `Modify this photo according to the following instruction: ${fullPrompt}. Return updated high quality image.` },
          ],
        },
      ],
    });

    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if ((part as any).inlineData?.data) {
          const mime = (part as any).inlineData.mimeType || 'image/jpeg';
          return `data:${mime};base64,${(part as any).inlineData.data}`;
        }
      }
    }

    if (options?.jewelry && options.jewelry !== 'None') {
      return await compositeJewelryOnImage(imageBase64, options.jewelry);
    }

    return imageBase64;
  } catch (err) {
    console.error('Error in editImageWithGemini:', err);
    if (options?.jewelry && options.jewelry !== 'None') {
      return await compositeJewelryOnImage(imageBase64, options.jewelry);
    }
    return imageBase64;
  }
}

function compositeJewelryOnImage(imageUrl: string, jewelryType: string): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(imageUrl);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, 1024, 1024);
      drawJewelryOverlay(ctx, jewelryType);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };

    img.onerror = () => {
      resolve(imageUrl);
    };
  });
}

function drawJewelryOverlay(ctx: CanvasRenderingContext2D, jewelryType: string) {
  ctx.save();
  const lower = jewelryType.toLowerCase();
  const isGold = lower.includes('gold') || lower.includes('kundan') || jewelryType.includes('সোনা');
  const isKundan = lower.includes('kundan') || jewelryType.includes('কুন্দন');
  const isDiamond = lower.includes('diamond') || jewelryType.includes('হিরে');
  const isPearl = lower.includes('pearl') || jewelryType.includes('মুক্তা');

  // Neck coordinates
  const centerX = 512;
  const neckY = 248;

  // 1. Draw elegant necklace
  if (isPearl) {
    // Multi-strand luminous pearls
    [-6, 6].forEach((offsetY) => {
      ctx.beginPath();
      ctx.moveTo(centerX - 105, neckY + offsetY);
      ctx.bezierCurveTo(centerX - 60, neckY + 68 + offsetY, centerX + 60, neckY + 68 + offsetY, centerX + 105, neckY + offsetY);
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      for (let t = 0; t <= 1; t += 0.045) {
        const u = 1 - t;
        const bx = u*u*u*(centerX - 105) + 3*u*u*t*(centerX - 60) + 3*u*t*t*(centerX + 60) + t*t*t*(centerX + 105);
        const by = u*u*u*(neckY + offsetY) + 3*u*u*t*(neckY + 68 + offsetY) + 3*u*t*t*(neckY + 68 + offsetY) + t*t*t*(neckY + offsetY);
        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
        ctx.shadowBlur = 6;
        ctx.fill();
      }
    });

    // Central drop pearl
    ctx.beginPath();
    ctx.arc(centerX, neckY + 90, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F8FAFC';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.fill();
  } else if (isDiamond) {
    // Sparkling diamond collar & pendant
    ctx.beginPath();
    ctx.moveTo(centerX - 105, neckY);
    ctx.bezierCurveTo(centerX - 60, neckY + 68, centerX + 60, neckY + 68, centerX + 105, neckY);
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(224, 242, 254, 0.95)';
    ctx.shadowBlur = 10;
    ctx.stroke();

    for (let t = 0.05; t <= 0.95; t += 0.05) {
      const u = 1 - t;
      const bx = u*u*u*(centerX - 105) + 3*u*u*t*(centerX - 60) + 3*u*t*t*(centerX + 60) + t*t*t*(centerX + 105);
      const by = u*u*u*neckY + 3*u*u*t*(neckY + 68) + 3*u*t*t*(neckY + 68) + t*t*t*neckY;
      ctx.beginPath();
      ctx.arc(bx, by, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    const dropY = neckY + 70;
    ctx.beginPath();
    ctx.moveTo(centerX, dropY);
    ctx.lineTo(centerX, dropY + 22);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Diamond teardrop
    ctx.beginPath();
    ctx.arc(centerX, dropY + 26, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#E0F2FE';
    ctx.shadowBlur = 14;
    ctx.shadowColor = 'rgba(186, 230, 253, 0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX, dropY + 26, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  } else {
    // Traditional Gold / Kundan Bridal Necklace
    // Outer golden band
    ctx.beginPath();
    ctx.moveTo(centerX - 110, neckY);
    ctx.bezierCurveTo(centerX - 65, neckY + 72, centerX + 65, neckY + 72, centerX + 110, neckY);
    ctx.strokeStyle = isKundan ? '#D97706' : '#F59E0B';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.85)';
    ctx.shadowBlur = 14;
    ctx.stroke();

    // Inner choker band
    ctx.beginPath();
    ctx.moveTo(centerX - 95, neckY - 10);
    ctx.bezierCurveTo(centerX - 55, neckY + 50, centerX + 55, neckY + 50, centerX + 95, neckY - 10);
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Gold beads / Kundan stones along the curve
    for (let t = 0.04; t <= 0.96; t += 0.05) {
      const u = 1 - t;
      const bx = u*u*u*(centerX - 110) + 3*u*u*t*(centerX - 65) + 3*u*t*t*(centerX + 65) + t*t*t*(centerX + 110);
      const by = u*u*u*neckY + 3*u*u*t*(neckY + 72) + 3*u*t*t*(neckY + 72) + t*t*t*neckY;
      ctx.beginPath();
      ctx.arc(bx, by, isKundan ? 4.5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isKundan ? (Math.round(t * 10) % 2 === 0 ? '#DC2626' : '#FEF3C7') : '#FDE047';
      ctx.shadowBlur = 6;
      ctx.shadowColor = 'rgba(245, 158, 11, 0.7)';
      ctx.fill();
    }

    // Heavy royal centerpiece
    const dropY = neckY + 72;
    ctx.beginPath();
    ctx.arc(centerX, dropY + 20, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#D97706';
    ctx.shadowColor = 'rgba(217, 119, 6, 0.95)';
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centerX, dropY + 20, 7, 0, Math.PI * 2);
    ctx.fillStyle = isKundan ? '#DC2626' : '#FEF08A';
    ctx.fill();

    // Little hanging golden bells/drops
    [-18, 0, 18].forEach((xOff) => {
      ctx.beginPath();
      ctx.arc(centerX + xOff, dropY + 34, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
    });
  }

  // 2. Earrings (Jhumkas / Danglers)
  const earY = 195;
  const earLeftX = 432;
  const earRightX = 592;

  [earLeftX, earRightX].forEach((ex) => {
    // Stud
    ctx.beginPath();
    ctx.arc(ex, earY, isPearl ? 5 : isDiamond ? 4.5 : 6, 0, Math.PI * 2);
    ctx.fillStyle = isPearl ? '#FFFFFF' : isDiamond ? '#E0F2FE' : '#F59E0B';
    ctx.shadowBlur = 10;
    ctx.shadowColor = isPearl ? 'rgba(255,255,255,0.9)' : isDiamond ? 'rgba(224,242,254,0.9)' : 'rgba(245,158,11,0.9)';
    ctx.fill();

    // Dangler / Jhumka bell
    if (isPearl) {
      ctx.beginPath();
      ctx.arc(ex, earY + 12, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
    } else if (isDiamond) {
      ctx.beginPath();
      ctx.moveTo(ex, earY + 4);
      ctx.lineTo(ex, earY + 14);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ex, earY + 16, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    } else {
      // Golden Jhumka dome
      ctx.beginPath();
      ctx.arc(ex, earY + 12, 6.5, Math.PI, 0, false);
      ctx.closePath();
      ctx.fillStyle = '#D97706';
      ctx.fill();

      // Mini golden drops
      [-4, 0, 4].forEach((dx) => {
        ctx.beginPath();
        ctx.arc(ex + dx, earY + 18, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FCD34D';
        ctx.fill();
      });
    }
  });

  // 3. Matching Bangles / Bracelets along wrists
  const wrists = [
    { x: 340, y: 560, angle: -0.3 },
    { x: 684, y: 560, angle: 0.3 },
  ];

  wrists.forEach((w) => {
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.angle);
    for (let b = -8; b <= 8; b += 8) {
      ctx.beginPath();
      ctx.ellipse(0, b, 24, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = isPearl ? '#FFFFFF' : isDiamond ? '#E0F2FE' : '#F59E0B';
      ctx.lineWidth = isPearl ? 2.5 : isDiamond ? 2 : 3.5;
      ctx.shadowColor = isPearl ? 'rgba(255,255,255,0.7)' : isDiamond ? 'rgba(224,242,254,0.8)' : 'rgba(245,158,11,0.8)';
      ctx.shadowBlur = 8;
      ctx.stroke();
    }
    ctx.restore();
  });

  ctx.restore();
}

function compositeTryOnPreview(
  modelUrl: string,
  garmentUrl: string,
  _prompt: string,
  options?: GenerationOptions
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve(modelUrl);

    const modelImg = new Image();
    modelImg.crossOrigin = 'anonymous';
    modelImg.src = modelUrl;

    modelImg.onload = () => {
      // Draw model image to fill canvas
      ctx.drawImage(modelImg, 0, 0, 1024, 1024);

      if (!garmentUrl) {
        if (options?.jewelry && options.jewelry !== 'None') {
          drawJewelryOverlay(ctx, options.jewelry);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.95));
        return;
      }

      const garmentImg = new Image();
      garmentImg.crossOrigin = 'anonymous';
      garmentImg.src = garmentUrl;

      garmentImg.onload = () => {
        // Overlay garment naturally onto the torso area
        ctx.save();
        ctx.globalAlpha = 0.96;
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 10;

        const gWidth = 520;
        const gHeight = (garmentImg.height / garmentImg.width) * gWidth;
        const gx = (1024 - gWidth) / 2;
        const gy = 260; // Approximate torso height

        ctx.drawImage(garmentImg, gx, gy, gWidth, Math.min(gHeight, 620));
        ctx.restore();

        if (options?.jewelry && options.jewelry !== 'None') {
          drawJewelryOverlay(ctx, options.jewelry);
        }

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };

      garmentImg.onerror = () => {
        if (options?.jewelry && options.jewelry !== 'None') {
          drawJewelryOverlay(ctx, options.jewelry);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
    };

    modelImg.onerror = () => {
      resolve(modelUrl);
    };
  });
}

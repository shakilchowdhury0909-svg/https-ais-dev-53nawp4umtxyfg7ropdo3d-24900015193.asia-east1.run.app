import { GoogleGenAI } from "@google/genai";

export interface GenerationOptions {
    imageSize?: '1K' | '2K' | '4K';
    aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
    useProModel?: boolean;
}

export async function editImageWithGemini(
    base64Image: string,
    mimeType: string,
    prompt: string,
    retryCount = 0
): Promise<string> {
    const MAX_RETRIES = 3;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = 'gemini-2.5-flash-image';

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
        });

        if (!response.candidates?.[0]?.content?.parts) {
            throw new Error("No response content received from AI.");
        }

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }

        throw new Error("No image data found in the API response.");

    } catch (error: any) {
        let apiMessage = error.message || String(error);
        let apiCode = error.code;
        let apiStatus = error.status;

        try {
            if (typeof apiMessage === 'string' && (apiMessage.trim().startsWith('{') || apiMessage.trim().startsWith('['))) {
                const parsed = JSON.parse(apiMessage);
                if (parsed.error && parsed.error.message) {
                    apiMessage = parsed.error.message;
                    apiCode = parsed.error.code || apiCode;
                    apiStatus = parsed.error.status || apiStatus;
                } else if (parsed.message) {
                    apiMessage = parsed.message;
                }
            }
        } catch (e) {
            // Failed to parse, assume regular string
        }

        if (error.error && typeof error.error === 'object') {
             if (error.error.message) apiMessage = error.error.message;
             if (error.error.code) apiCode = error.error.code;
             if (error.error.status) apiStatus = error.error.status;
        }

        const stringifiedError = JSON.stringify(error);
        
        const isQuotaError = 
            String(apiMessage).includes("429") || 
            String(apiMessage).toLowerCase().includes("quota") || 
            String(apiMessage).includes("RESOURCE_EXHAUSTED") ||
            String(apiStatus).includes("RESOURCE_EXHAUSTED") ||
            stringifiedError.includes("RESOURCE_EXHAUSTED") ||
            apiCode === 429;
            
        const isPermissionError = 
            String(apiMessage).includes("PERMISSION_DENIED") || 
            String(apiMessage).toLowerCase().includes("permission") ||
            String(apiMessage).includes("The caller does not have permission") ||
            stringifiedError.includes("PERMISSION_DENIED") ||
            stringifiedError.includes("The caller does not have permission") ||
            apiCode === 403;

        const isTransientError = String(apiMessage).includes("500") || String(apiMessage).includes("503") || String(apiMessage).includes("ECONNRESET");
        const isHardQuota = String(apiMessage).toLowerCase().includes("check your plan") || 
                            String(apiMessage).toLowerCase().includes("billing details") ||
                            String(apiMessage).toLowerCase().includes("exceeded your current quota") ||
                            String(apiMessage).includes("429");

        if ((isQuotaError || isTransientError) && retryCount < MAX_RETRIES && !isHardQuota) {
            const waitTime = Math.pow(2, retryCount + 1) * 1000 + Math.random() * 1000;
            console.warn(`Attempt ${retryCount + 1} failed. Retrying in ${Math.round(waitTime)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return editImageWithGemini(base64Image, mimeType, prompt, retryCount + 1);
        }

        if (isHardQuota) {
             throw new Error("Quota Exhausted: You have exceeded your current quota. Please check your billing details or select a paid API key to continue.");
        }

        if (isQuotaError) {
            throw new Error(`Quota Exhausted: ${apiMessage} Please select a personal paid API key from a project with billing enabled to continue.`);
        }

        if (isPermissionError) {
             throw new Error("Permission Denied: The selected API key does not have access to this model. Please select a valid key from a paid Google Cloud Project.");
        }

        if (String(apiMessage).includes("Requested entity was not found")) {
            throw new Error("API Key Selection Required: The model or key was not found. Please re-select a personal API key from a paid GCP project.");
        }

        throw new Error(apiMessage || "Failed to edit image.");
    }
}

export async function generateARVirtualTryOn(
    clothingBase64: string,
    clothingMimeType: string,
    personBase64: string,
    personMimeType: string,
    prompt: string,
    options: GenerationOptions = {},
    retryCount = 0
): Promise<string> {
    const MAX_RETRIES = 3;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = options.useProModel ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    try {
        const config: any = {};
        if (options.useProModel) {
            config.imageConfig = {
                aspectRatio: options.aspectRatio || '1:1',
                imageSize: options.imageSize || '1K'
            };
            config.tools = [{ googleSearch: {} }];
        }

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: clothingBase64,
                            mimeType: clothingMimeType,
                        },
                    },
                    {
                        inlineData: {
                            data: personBase64,
                            mimeType: personMimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: config,
        });

        if (!response.candidates?.[0]?.content?.parts) {
            throw new Error("No response content received from AI.");
        }

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }

        throw new Error("No image data found in the API response.");

    } catch (error: any) {
        let apiMessage = error.message || String(error);
        let apiCode = error.code;
        let apiStatus = error.status;

        try {
            if (typeof apiMessage === 'string' && (apiMessage.trim().startsWith('{') || apiMessage.trim().startsWith('['))) {
                const parsed = JSON.parse(apiMessage);
                if (parsed.error && parsed.error.message) {
                    apiMessage = parsed.error.message;
                    apiCode = parsed.error.code || apiCode;
                    apiStatus = parsed.error.status || apiStatus;
                } else if (parsed.message) {
                    apiMessage = parsed.message;
                }
            }
        } catch (e) {}

        if (error.error && typeof error.error === 'object') {
             if (error.error.message) apiMessage = error.error.message;
             if (error.error.code) apiCode = error.error.code;
             if (error.error.status) apiStatus = error.error.status;
        }

        const stringifiedError = JSON.stringify(error);
        
        const isQuotaError = 
            String(apiMessage).includes("429") || 
            String(apiMessage).toLowerCase().includes("quota") || 
            String(apiMessage).includes("RESOURCE_EXHAUSTED") ||
            String(apiStatus).includes("RESOURCE_EXHAUSTED") ||
            stringifiedError.includes("RESOURCE_EXHAUSTED") ||
            apiCode === 429;
            
        const isPermissionError = 
            String(apiMessage).includes("PERMISSION_DENIED") || 
            String(apiMessage).toLowerCase().includes("permission") ||
            String(apiMessage).includes("The caller does not have permission") ||
            stringifiedError.includes("PERMISSION_DENIED") ||
            stringifiedError.includes("The caller does not have permission") ||
            apiCode === 403;

        const isTransientError = String(apiMessage).includes("500") || String(apiMessage).includes("503") || String(apiMessage).includes("ECONNRESET");
        const isHardQuota = String(apiMessage).toLowerCase().includes("check your plan") || 
                            String(apiMessage).toLowerCase().includes("billing details") ||
                            String(apiMessage).toLowerCase().includes("exceeded your current quota") ||
                            String(apiMessage).includes("429");

        if ((isQuotaError || isTransientError) && retryCount < MAX_RETRIES && !isHardQuota) {
            const waitTime = Math.pow(2, retryCount + 1) * 1000 + Math.random() * 1000;
            console.warn(`Attempt ${retryCount + 1} failed. Retrying in ${Math.round(waitTime)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return generateARVirtualTryOn(clothingBase64, clothingMimeType, personBase64, personMimeType, prompt, options, retryCount + 1);
        }

        if (isHardQuota) throw new Error("Quota Exhausted: You have exceeded your current quota. Please check your billing details or select a paid API key to continue.");
        if (isQuotaError) throw new Error(`Quota Exhausted: ${apiMessage} Please select a personal paid API key from a project with billing enabled to continue.`);
        if (isPermissionError) throw new Error("Permission Denied: The selected API key does not have access to this model. Please select a valid key from a paid Google Cloud Project.");
        if (String(apiMessage).includes("Requested entity was not found")) throw new Error("API Key Selection Required: The model or key was not found. Please re-select a personal API key from a paid GCP project.");

        throw new Error(apiMessage || "Failed to generate AR try-on.");
    }
}

export async function generateVirtualTryOn(
    base64Image: string, 
    mimeType: string, 
    prompt: string, 
    options: GenerationOptions = {},
    retryCount = 0
): Promise<string> {
    const MAX_RETRIES = 3;
    
    // Always use the process.env.API_KEY which might be updated by the key selection dialog
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Determine which model to use. Pro model is used for high-quality requests (2K/4K).
    const modelName = options.useProModel ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';

    try {
        const config: any = {};
        
        // imageConfig is only supported for gemini-3-pro-image-preview
        if (options.useProModel) {
            config.imageConfig = {
                aspectRatio: options.aspectRatio || '1:1',
                imageSize: options.imageSize || '1K'
            };
            // Pro model supports googleSearch for better context if needed
            config.tools = [{ googleSearch: {} }];
        }

        const response = await ai.models.generateContent({
            model: modelName,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: config,
        });

        if (!response.candidates?.[0]?.content?.parts) {
            throw new Error("No response content received from AI.");
        }

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return part.inlineData.data;
            }
        }

        throw new Error("No image data found in the API response.");

    } catch (error: any) {
        let apiMessage = error.message || String(error);
        let apiCode = error.code;
        let apiStatus = error.status;

        // 1. Attempt to parse JSON error strings (common with 429 errors from this API)
        try {
            if (typeof apiMessage === 'string' && (apiMessage.trim().startsWith('{') || apiMessage.trim().startsWith('['))) {
                const parsed = JSON.parse(apiMessage);
                if (parsed.error && parsed.error.message) {
                    apiMessage = parsed.error.message;
                    apiCode = parsed.error.code || apiCode;
                    apiStatus = parsed.error.status || apiStatus;
                } else if (parsed.message) {
                    apiMessage = parsed.message;
                }
            }
        } catch (e) {
            // Failed to parse, assume regular string
        }

        // 2. Check for nested error objects
        if (error.error && typeof error.error === 'object') {
             if (error.error.message) apiMessage = error.error.message;
             if (error.error.code) apiCode = error.error.code;
             if (error.error.status) apiStatus = error.error.status;
        }

        const stringifiedError = JSON.stringify(error);
        
        const isQuotaError = 
            String(apiMessage).includes("429") || 
            String(apiMessage).toLowerCase().includes("quota") || 
            String(apiMessage).includes("RESOURCE_EXHAUSTED") ||
            String(apiStatus).includes("RESOURCE_EXHAUSTED") ||
            stringifiedError.includes("RESOURCE_EXHAUSTED") ||
            apiCode === 429;
            
        const isPermissionError = 
            String(apiMessage).includes("PERMISSION_DENIED") || 
            String(apiMessage).toLowerCase().includes("permission") ||
            String(apiMessage).includes("The caller does not have permission") ||
            stringifiedError.includes("PERMISSION_DENIED") ||
            stringifiedError.includes("The caller does not have permission") ||
            apiCode === 403;

        const isTransientError = String(apiMessage).includes("500") || String(apiMessage).includes("503") || String(apiMessage).includes("ECONNRESET");

        // Check if it's a hard quota limit where retrying won't help immediately (e.g., plan limits)
        const isHardQuota = String(apiMessage).toLowerCase().includes("check your plan") || 
                            String(apiMessage).toLowerCase().includes("billing details") ||
                            String(apiMessage).toLowerCase().includes("exceeded your current quota") ||
                            String(apiMessage).includes("429");

        if ((isQuotaError || isTransientError) && retryCount < MAX_RETRIES && !isHardQuota) {
            const waitTime = Math.pow(2, retryCount + 1) * 1000 + Math.random() * 1000;
            console.warn(`Attempt ${retryCount + 1} failed. Retrying in ${Math.round(waitTime)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return generateVirtualTryOn(base64Image, mimeType, prompt, options, retryCount + 1);
        }

        if (isHardQuota) {
             throw new Error("Quota Exhausted: You have exceeded your current quota. Please check your billing details or select a paid API key to continue.");
        }

        if (isQuotaError) {
            throw new Error(`Quota Exhausted: ${apiMessage} Please select a personal paid API key from a project with billing enabled to continue.`);
        }

        if (isPermissionError) {
             throw new Error("Permission Denied: The selected API key does not have access to this model. Please select a valid key from a paid Google Cloud Project.");
        }

        if (String(apiMessage).includes("Requested entity was not found")) {
            throw new Error("API Key Selection Required: The model or key was not found. Please re-select a personal API key from a paid GCP project.");
        }

        throw new Error(apiMessage || "Failed to generate high-quality render.");
    }
}

export async function generatePromptSuggestions(
    clothingBase64: string,
    clothingMimeType: string,
    modelBase64?: string,
    modelMimeType?: string
): Promise<string[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = 'gemini-3-flash-preview';

    const parts: any[] = [
        {
            inlineData: {
                data: clothingBase64,
                mimeType: clothingMimeType,
            },
        },
    ];

    if (modelBase64 && modelMimeType) {
        parts.push({
            inlineData: {
                data: modelBase64,
                mimeType: modelMimeType,
            },
        });
    }

    parts.push({
        text: `Analyze the provided clothing item${modelBase64 ? ' and the target model' : ''}. Generate 3 creative, distinct, and concise prompt suggestions (1-2 sentences each) for a virtual try-on photoshoot. The prompts should describe the vibe, setting, or styling to make the image look amazing. Return the response as a JSON array of strings. Do not include markdown formatting like \`\`\`json. Just the array. Example: ["A sunny beach photoshoot with a relaxed vibe.", "A high-fashion runway look under dramatic spotlights.", "A casual streetwear style in a neon-lit alleyway."]`,
    });

    try {
        const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts },
            config: {
                responseMimeType: "application/json",
            }
        });

        const text = response.text;
        if (!text) return [];
        
        try {
            const suggestions = JSON.parse(text);
            if (Array.isArray(suggestions)) {
                return suggestions;
            }
        } catch (e) {
            console.error("Failed to parse suggestions JSON:", e);
        }
        return [];
    } catch (error) {
        console.error("Error generating suggestions:", error);
        return [];
    }
}
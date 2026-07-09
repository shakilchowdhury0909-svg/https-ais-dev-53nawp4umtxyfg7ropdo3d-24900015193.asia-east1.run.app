import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { Loader } from './components/Loader';
import { SparklesIcon, DownloadIcon, SaveIcon, ZoomInIcon, ZoomOutIcon, ResetZoomIcon, TrashIcon, UndoIcon, RedoIcon, RotateIcon, ShareIcon, TwitterIcon, FacebookIcon, LinkIcon } from './components/icons';
import { generateVirtualTryOn, editImageWithGemini, GenerationOptions } from './services/geminiService';
import { fileToBase64, rotateImage, applyFiltersToCanvas } from './utils/imageUtils';

const SESSION_KEY = 'virtualTryOnSession';
const PRESETS_KEY = 'virtualTryOnPresets';

type QualityPreset = 'Standard' | 'High' | 'Ultra (Pro)';
type BackgroundStyle = 'Studio' | 'Outdoor' | 'Solid Color' | 'Beach' | 'Cityscape' | 'Abstract' | 'Forest' | 'Desert' | 'Night City';
type ModelGender = 'Female' | 'Male';
type ModelPose = 'Standing' | 'Sitting' | 'Walking' | 'Dynamic' | 'Relaxed';
type CameraAngle = 'Front View' | 'Side View' | 'Back View' | 'Three-Quarter View' | 'Close-up';
type ModelAge = 'Teen' | 'Young Adult' | 'Adult' | 'Senior';

type Ethnicity = 'Asian' | 'Black' | 'Hispanic' | 'White' | 'Middle Eastern' | 'South Asian' | 'Mixed';
type HairColor = 'Black' | 'Brown' | 'Blonde' | 'Red' | 'Gray' | 'White' | 'Dyed';
type EyeColor = 'Brown' | 'Blue' | 'Green' | 'Hazel' | 'Gray';

type Resolution = '1K (Standard)' | '2K (Premium)' | '4K (Ultra)';
type DetailLevel = 'Standard' | 'Fine' | 'Intricate';
type FabricTexture = 'Cotton' | 'Silk' | 'Denim' | 'Leather' | 'Wool' | 'Linen' | 'Velvet';
type ModelBodyType = 'Slim' | 'Average' | 'Plus-size' | 'Athletic' | 'Curvy' | 'Petite';

interface UserPreset {
  id: string;
  name: string;
  settings: {
    quality: QualityPreset;
    backgroundStyle: BackgroundStyle;
    gender: ModelGender;
    modelPose: ModelPose;
    cameraAngle: CameraAngle;
    modelAge: ModelAge;
    ethnicity: Ethnicity;
    hairColor: HairColor;
    eyeColor: EyeColor;
    resolution: Resolution;
    detailLevel: DetailLevel;
    fabricTexture: FabricTexture;
    modelBodyType: ModelBodyType;
    modelHeight: number;
  };
}

interface AppSnapshot {
  smartPrompt: string;
  quality: QualityPreset;
  backgroundStyle: BackgroundStyle;
  gender: ModelGender;
  modelPose: ModelPose;
  cameraAngle: CameraAngle;
  modelAge: ModelAge;
  ethnicity: Ethnicity;
  hairColor: HairColor;
  eyeColor: EyeColor;
  resolution: Resolution;
  detailLevel: DetailLevel;
  fabricTexture: FabricTexture;
  modelBodyType: ModelBodyType;
  modelHeight: number;
  generatedImageUrl: string | null;
  brightness: number;
  contrast: number;
  saturation: number;
  mode: 'try-on' | 'editor';
}

const DEFAULT_PRESETS: UserPreset[] = [
  {
    id: 'default-silk',
    name: 'Silk Elegance',
    settings: { quality: 'High', backgroundStyle: 'Studio', gender: 'Female', modelPose: 'Standing', cameraAngle: 'Front View', modelAge: 'Young Adult', ethnicity: 'South Asian', hairColor: 'Black', eyeColor: 'Brown', resolution: '1K (Standard)', detailLevel: 'Intricate', fabricTexture: 'Silk', modelBodyType: 'Slim', modelHeight: 68 }
  },
  {
    id: 'default-denim',
    name: 'Denim Casual',
    settings: { quality: 'High', backgroundStyle: 'Cityscape', gender: 'Female', modelPose: 'Walking', cameraAngle: 'Three-Quarter View', modelAge: 'Young Adult', ethnicity: 'White', hairColor: 'Blonde', eyeColor: 'Blue', resolution: '1K (Standard)', detailLevel: 'Standard', fabricTexture: 'Denim', modelBodyType: 'Average', modelHeight: 66 }
  },
  {
    id: 'default-leather',
    name: 'Leather Edge',
    settings: { quality: 'High', backgroundStyle: 'Night City', gender: 'Female', modelPose: 'Dynamic', cameraAngle: 'Side View', modelAge: 'Adult', ethnicity: 'Black', hairColor: 'Black', eyeColor: 'Brown', resolution: '1K (Standard)', detailLevel: 'Fine', fabricTexture: 'Leather', modelBodyType: 'Athletic', modelHeight: 69 }
  },
  {
    id: 'default-cotton',
    name: 'Cotton Basic',
    settings: { quality: 'High', backgroundStyle: 'Outdoor', gender: 'Male', modelPose: 'Relaxed', cameraAngle: 'Front View', modelAge: 'Young Adult', ethnicity: 'Hispanic', hairColor: 'Brown', eyeColor: 'Hazel', resolution: '1K (Standard)', detailLevel: 'Standard', fabricTexture: 'Cotton', modelBodyType: 'Average', modelHeight: 70 }
  },
  {
    id: 'default-wool',
    name: 'Wool Warmth',
    settings: { quality: 'High', backgroundStyle: 'Forest', gender: 'Female', modelPose: 'Sitting', cameraAngle: 'Three-Quarter View', modelAge: 'Adult', ethnicity: 'Asian', hairColor: 'Black', eyeColor: 'Brown', resolution: '1K (Standard)', detailLevel: 'Fine', fabricTexture: 'Wool', modelBodyType: 'Average', modelHeight: 65 }
  },
  {
    id: 'default-linen',
    name: 'Linen Breeze',
    settings: { quality: 'High', backgroundStyle: 'Beach', gender: 'Female', modelPose: 'Standing', cameraAngle: 'Front View', modelAge: 'Young Adult', ethnicity: 'White', hairColor: 'Red', eyeColor: 'Green', resolution: '1K (Standard)', detailLevel: 'Standard', fabricTexture: 'Linen', modelBodyType: 'Petite', modelHeight: 64 }
  },
  {
    id: 'default-velvet',
    name: 'Velvet Glamour',
    settings: { quality: 'High', backgroundStyle: 'Abstract', gender: 'Female', modelPose: 'Standing', cameraAngle: 'Close-up', modelAge: 'Adult', ethnicity: 'Middle Eastern', hairColor: 'Black', eyeColor: 'Brown', resolution: '1K (Standard)', detailLevel: 'Intricate', fabricTexture: 'Velvet', modelBodyType: 'Curvy', modelHeight: 67 }
  }
];

const PillButton: React.FC<{ label: string, active: boolean, onClick: () => void, colorClass?: string }> = ({ label, active, onClick, colorClass = 'bg-purple-600 border-purple-400' }) => (
  <button 
    onClick={onClick} 
    className={`px-3 py-1.5 text-[9px] font-black rounded-full uppercase tracking-widest transition-all duration-300 border ${
      active 
        ? `${colorClass} text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]` 
        : 'bg-gray-800/30 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
    }`}
  >
    {label}
  </button>
);

const formatHeight = (inches: number) => {
  const ft = Math.floor(inches / 12);
  const inRemaining = inches % 12;
  return `${ft}'${inRemaining}"`;
};

declare global {
  interface Window {
    aistudio?: {
      openSelectKey: () => Promise<void>;
      hasSelectedApiKey: () => Promise<boolean>;
    };
  }
}

const ShareModal = ({ isOpen, onClose, imageUrl }: { isOpen: boolean, onClose: () => void, imageUrl: string }) => {
  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied to clipboard!');
  };

  const shareText = "Check out this virtual try-on I created!";
  const shareUrl = window.location.href;

  const handleTwitterShare = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
  };

  const handleNativeShare = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], `ai-fashion-${Date.now()}.png`, { type: 'image/png' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My AI Fashion Design',
          text: shareText,
          files: [file]
        });
      } else {
        alert('Native sharing not supported on this device.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0e101a] border border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          ✕
        </button>
        <h3 className="text-lg font-black text-white mb-6 uppercase tracking-widest text-center">Share Design</h3>
        
        <div className="flex flex-col gap-3">
          <button onClick={handleTwitterShare} className="py-3 px-4 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <TwitterIcon className="w-5 h-5" /> Share to Twitter
          </button>
          <button onClick={handleFacebookShare} className="py-3 px-4 bg-[#4267B2] hover:bg-[#365899] text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <FacebookIcon className="w-5 h-5" /> Share to Facebook
          </button>
          <button onClick={handleCopyLink} className="py-3 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <LinkIcon className="w-5 h-5" /> Copy Link
          </button>
          {navigator.share && (
            <button onClick={handleNativeShare} className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
              <ShareIcon className="w-5 h-5" /> More Options...
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  
  const [mode, setMode] = useState<'try-on' | 'editor'>('try-on');

  const [smartPrompt, setSmartPrompt] = useState<string>('একটি নতুন নারী চরিত্র তৈরি করুন যার শারীরিক গঠন এবং ত্বকের রঙ এই পোশাকটির সাথে মানানসই। পোশাকটি যেন তার শরীরের সাথে সুন্দরভাবে ফিট হয় এবং পুরো ছবিটি যেন একটি সামঞ্জস্যপূর্ণ রূপ পায়।');
  
  const [quality, setQuality] = useState<QualityPreset>('High');
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>('Studio');
  const [gender, setGender] = useState<ModelGender>('Female');
  const [modelPose, setModelPose] = useState<ModelPose>('Standing');
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>('Front View');
  const [modelAge, setModelAge] = useState<ModelAge>('Young Adult');
  
  const [ethnicity, setEthnicity] = useState<Ethnicity>('South Asian');
  const [hairColor, setHairColor] = useState<HairColor>('Black');
  const [eyeColor, setEyeColor] = useState<EyeColor>('Brown');

  const [resolution, setResolution] = useState<Resolution>('1K (Standard)');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('Fine');
  const [fabricTexture, setFabricTexture] = useState<FabricTexture>('Silk');
  const [modelBodyType, setModelBodyType] = useState<ModelBodyType>('Average');
  const [modelHeight, setModelHeight] = useState<number>(66); // 5'6" default

  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);

  const [hasUserApiKey, setHasUserApiKey] = useState<boolean>(false);
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [showPresetInput, setShowPresetInput] = useState(false);

  // History states
  const [past, setPast] = useState<AppSnapshot[]>([]);
  const [future, setFuture] = useState<AppSnapshot[]>([]);

  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonSliderPos, setComparisonSliderPos] = useState(50);
  const isDraggingSlider = useRef(false);

  const getSnapshot = useCallback((): AppSnapshot => ({
    smartPrompt, quality, backgroundStyle, gender, modelPose, cameraAngle,
    modelAge, ethnicity, hairColor, eyeColor, resolution, detailLevel,
    fabricTexture, modelBodyType, modelHeight, generatedImageUrl, brightness, contrast, saturation, mode
  }), [
    smartPrompt, quality, backgroundStyle, gender, modelPose, cameraAngle,
    modelAge, ethnicity, hairColor, eyeColor, resolution, detailLevel,
    fabricTexture, modelBodyType, modelHeight, generatedImageUrl, brightness, contrast, saturation, mode
  ]);

  const saveToHistory = useCallback(() => {
    setPast(prev => [...prev, getSnapshot()]);
    setFuture([]); // Clear future on new action
  }, [getSnapshot]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = getSnapshot();
    
    setFuture(prev => [current, ...prev]);
    setPast(prev => prev.slice(0, -1));
    applySnapshot(previous);
  }, [past, getSnapshot]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const current = getSnapshot();

    setPast(prev => [...prev, current]);
    setFuture(prev => prev.slice(1));
    applySnapshot(next);
  }, [future, getSnapshot]);

  const applySnapshot = (s: AppSnapshot) => {
    setSmartPrompt(s.smartPrompt);
    setQuality(s.quality);
    setBackgroundStyle(s.backgroundStyle);
    setGender(s.gender);
    setModelPose(s.modelPose);
    setCameraAngle(s.cameraAngle);
    setModelAge(s.modelAge);
    setEthnicity(s.ethnicity);
    setHairColor(s.hairColor);
    setEyeColor(s.eyeColor);
    setResolution(s.resolution);
    setDetailLevel(s.detailLevel);
    setFabricTexture(s.fabricTexture);
    setModelBodyType(s.modelBodyType);
    setModelHeight(s.modelHeight);
    setGeneratedImageUrl(s.generatedImageUrl);
    setBrightness(s.brightness);
    setContrast(s.contrast);
    setSaturation(s.saturation);
    if (s.mode) setMode(s.mode);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasUserApiKey(hasKey);
      }
    };
    checkKey();

    const savedPresets = localStorage.getItem(PRESETS_KEY);
    if (savedPresets) {
      setPresets(JSON.parse(savedPresets));
    } else {
      setPresets(DEFAULT_PRESETS);
    }

    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
        try {
            const parsed = JSON.parse(savedSession);
            
            // Restore settings independently of image presence to ensure user preferences persist
            if (parsed.resolution) setResolution(parsed.resolution);
            if (parsed.quality) setQuality(parsed.quality);
            if (parsed.smartPrompt) setSmartPrompt(parsed.smartPrompt);
            if (parsed.backgroundStyle) setBackgroundStyle(parsed.backgroundStyle);
            if (parsed.gender) setGender(parsed.gender);
            if (parsed.modelPose) setModelPose(parsed.modelPose);
            if (parsed.cameraAngle) setCameraAngle(parsed.cameraAngle);
            if (parsed.modelAge) setModelAge(parsed.modelAge);
            if (parsed.ethnicity) setEthnicity(parsed.ethnicity);
            if (parsed.hairColor) setHairColor(parsed.hairColor);
            if (parsed.eyeColor) setEyeColor(parsed.eyeColor);
            if (parsed.detailLevel) setDetailLevel(parsed.detailLevel);
            if (parsed.fabricTexture) setFabricTexture(parsed.fabricTexture);
            if (parsed.modelBodyType) setModelBodyType(parsed.modelBodyType);
            if (parsed.modelHeight) setModelHeight(parsed.modelHeight);
            
            if (parsed.brightness !== undefined) setBrightness(parsed.brightness);
            if (parsed.contrast !== undefined) setContrast(parsed.contrast);
            if (parsed.saturation !== undefined) setSaturation(parsed.saturation);
            
            if (parsed.mode) setMode(parsed.mode);

            if (parsed.originalImageUrl) {
                setOriginalImageUrl(parsed.originalImageUrl);
                setRotation(parsed.rotation || 0);
                
                fetch(parsed.originalImageUrl)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], 'saved-image.png', { type: blob.type });
                        setOriginalImageFile(file);
                    });
            }
            if (parsed.generatedImageUrl) {
                setGeneratedImageUrl(parsed.generatedImageUrl);
            }
        } catch (e) {
            console.error("Failed to parse saved session:", e);
        }
    }
  }, []);

  // Save session to localStorage whenever state changes
  useEffect(() => {
    const sessionData = {
      originalImageUrl,
      rotation,
      smartPrompt,
      quality,
      backgroundStyle,
      gender,
      modelPose,
      cameraAngle,
      modelAge,
      ethnicity,
      hairColor,
      eyeColor,
      resolution,
      detailLevel,
      fabricTexture,
      modelBodyType,
      modelHeight,
      generatedImageUrl,
      brightness,
      contrast,
      saturation,
      mode
    };
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } catch (e) {
        const errorMsg = (e as any).message || String(e);
        const isQuotaExceeded = 
            (e instanceof DOMException && (
                e.code === 22 || 
                e.name === 'QuotaExceededError' || 
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
            )) || 
            errorMsg.toLowerCase().includes("quota");

        if (isQuotaExceeded) {
            try {
                // Omit the base64 strings to save space
                const { originalImageUrl, generatedImageUrl, ...settingsOnly } = sessionData;
                localStorage.setItem(SESSION_KEY, JSON.stringify(settingsOnly));
                console.warn("Session saved without images due to local storage quota limits.");
            } catch (retryError) {
                console.error("Failed to save even settings to local storage", retryError);
            }
        } else {
            console.error("Failed to save session to local storage", e);
        }
    }
  }, [
    originalImageUrl, rotation, smartPrompt, quality, backgroundStyle, 
    gender, modelPose, cameraAngle, modelAge, ethnicity, hairColor, 
    eyeColor, resolution, detailLevel, fabricTexture, modelBodyType, 
    modelHeight, generatedImageUrl, brightness, contrast, saturation, mode
  ]);

  const handleSelectApiKey = useCallback(async () => {
    if (window.aistudio?.openSelectKey) {
        await window.aistudio.openSelectKey();
        setHasUserApiKey(true);
        setError(null);
    }
  }, []);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: UserPreset = {
      id: Date.now().toString(),
      name: newPresetName,
      settings: {
        quality, backgroundStyle, gender, modelPose, cameraAngle, modelAge,
        ethnicity, hairColor, eyeColor,
        resolution, detailLevel, fabricTexture, modelBodyType, modelHeight
      }
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
    setNewPresetName('');
    setShowPresetInput(false);
  };

  const applyPresetWithHistory = (preset: UserPreset) => {
    saveToHistory();
    const s = preset.settings;
    setQuality(s.quality);
    setBackgroundStyle(s.backgroundStyle);
    setGender(s.gender);
    setModelPose(s.modelPose);
    setCameraAngle(s.cameraAngle);
    setModelAge(s.modelAge);
    setEthnicity(s.ethnicity);
    setHairColor(s.hairColor);
    setEyeColor(s.eyeColor);
    setResolution(s.resolution);
    setDetailLevel(s.detailLevel);
    setFabricTexture(s.fabricTexture);
    setModelBodyType(s.modelBodyType);
    setModelHeight(s.modelHeight);
  };

  const deletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(updated));
  };

  const handleZoomReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleImageUpload = (file: File) => {
    setOriginalImageFile(file);
    setGeneratedImageUrl(null);
    setError(null);
    setRotation(0);
    handleZoomReset();
    const reader = new FileReader();
    reader.onloadend = () => setOriginalImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageRemove = () => {
    setOriginalImageFile(null);
    setOriginalImageUrl(null);
    setGeneratedImageUrl(null);
    setError(null);
    setRotation(0);
    handleZoomReset();
    localStorage.removeItem(SESSION_KEY);
  };

  const handleGenerate = useCallback(async () => {
    if (!originalImageFile || !originalImageUrl) {
      setError("Please upload an image first.");
      return;
    }

    const isUltra = resolution === '4K (Ultra)' || resolution === '2K (Premium)' || quality === 'Ultra (Pro)';
    if (isUltra && !hasUserApiKey && mode === 'try-on') {
        setError("Ultra Quality or High Resolution rendering requires selecting your own paid API key.");
        if (window.aistudio?.openSelectKey) {
            await window.aistudio.openSelectKey();
            setHasUserApiKey(true);
            setError(null);
        }
        return;
    }

    saveToHistory();
    setIsLoading(true);
    setGeneratedImageUrl(null);
    setError(null);
    handleZoomReset();

    try {
      let base64Image: string;
      let mimeType: string;

      if (rotation !== 0) {
        base64Image = await rotateImage(originalImageUrl, rotation);
        mimeType = 'image/png';
      } else {
        base64Image = await fileToBase64(originalImageFile);
        mimeType = originalImageFile.type;
      }
      
      let newImageBase64: string;

      if (mode === 'editor') {
        // EDITOR MODE LOGIC
        newImageBase64 = await editImageWithGemini(base64Image, mimeType, smartPrompt);
      } else {
        // TRY-ON MODE LOGIC
        const genderStr = gender === 'Female' ? "fashion model" : "male model";
        const heightStr = formatHeight(modelHeight);
        const modelDescription = `${modelAge} ${ethnicity} ${modelBodyType.toLowerCase()} ${genderStr}, height ${heightStr}, with ${hairColor.toLowerCase()} hair and ${eyeColor.toLowerCase()} eyes`;

        let angleInstruction = `Perspective: ${cameraAngle.toLowerCase()}`;
        if (cameraAngle === 'Close-up') {
            angleInstruction = "Composition: Extreme close-up shot focusing on the high-definition texture, weave, and intricate details of the fabric.";
        }

        const finalPrompt = `Ultra-realistic 8k fashion editorial photography. 
        Professional studio lighting with soft shadows. 
        Instruction: ${smartPrompt}. 
        Apply the clothing garment from the reference image onto a ${modelDescription}. 
        Ensure the model's appearance, including hairstyle, skin tone, and facial features, complements the style and color of the dress. Use color theory to match the skin tone with the garment.
        ${angleInstruction}. 
        Pose: ${modelPose.toLowerCase()} and natural. 
        Background: High-end ${backgroundStyle} aesthetic. 
        Details: Intricate ${fabricTexture} material rendering, lifelike skin textures, and sharp focus. 
        Quality: ${detailLevel} precision, ${resolution} clarity. 
        The result must be a flawless, professional fashion render.`;

        const options: GenerationOptions = {
            useProModel: isUltra,
            imageSize: resolution.includes('4K') ? '4K' : resolution.includes('2K') ? '2K' : '1K',
            aspectRatio: '1:1'
        };

        newImageBase64 = await generateVirtualTryOn(base64Image, mimeType, finalPrompt, options);
      }
      
      setGeneratedImageUrl(`data:image/png;base64,${newImageBase64}`);
    } catch (err: any) {
        const isKeyError = err.message?.includes("Permission Denied") || 
                           err.message?.includes("API Key Selection Required") ||
                           err.message?.includes("API Key Error") ||
                           err.message?.includes("Quota Exhausted") ||
                           err.message?.includes("RESOURCE_EXHAUSTED") ||
                           err.message?.includes("exceeded your current quota") ||
                           err.message?.includes("Requested entity was not found");
                           
        if (isKeyError) {
             setHasUserApiKey(false);
             if (window.aistudio?.openSelectKey) {
                 await window.aistudio.openSelectKey();
                 setHasUserApiKey(true);
                 setError("Key updated. Please try generating again.");
                 return;
             } else {
                 if (err.message?.includes("Quota")) {
                      setError("Quota exceeded. Please click 'Set API Key' in the top right to use your own key.");
                      return;
                 }
                 if (err.message?.includes("Permission Denied")) {
                      setError("Permission denied. Please click 'Set API Key' and select a project with access to this model.");
                      return;
                 }
             }
        }
        setError(err.message || "An error occurred during generation.");
    } finally {
      setIsLoading(false);
    }
  }, [
    originalImageFile, originalImageUrl, rotation, quality, backgroundStyle, 
    gender, modelPose, cameraAngle, modelAge, ethnicity, hairColor, eyeColor, 
    resolution, detailLevel, fabricTexture, modelBodyType, modelHeight, smartPrompt,
    hasUserApiKey, handleZoomReset, saveToHistory, mode
  ]);

  const handleDownload = async () => {
    if (!generatedImageUrl) return;
    try {
      const dataUrl = await applyFiltersToCanvas(generatedImageUrl, brightness, contrast, saturation);
      
      const timestamp = Date.now();
      const baseFilename = `ai-fashion-${resolution.toLowerCase().replace(/ /g, '-')}-${timestamp}`;
      
      // Download Image
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${baseFilename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Download Metadata JSON
      const metadata = getSnapshot();
      const { generatedImageUrl: _discard, ...settingsOnly } = metadata;
      
      const jsonStr = JSON.stringify(settingsOnly, null, 2);
      const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
      const jsonUrl = URL.createObjectURL(jsonBlob);
      
      const jsonLink = document.createElement('a');
      jsonLink.href = jsonUrl;
      jsonLink.download = `${baseFilename}-metadata.json`;
      document.body.appendChild(jsonLink);
      jsonLink.click();
      document.body.removeChild(jsonLink);
      URL.revokeObjectURL(jsonUrl);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to save image:', err);
        alert('Failed to save image.');
      }
    }
  };

  const handleShare = () => {
    if (!generatedImageUrl) return;
    setIsShareModalOpen(true);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!generatedImageUrl || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY * 0.002;
    const nextScale = Math.min(Math.max(scale + delta, 1), 5);
    if (nextScale === scale) return;
    const scaleRatio = nextScale / scale;
    const newX = mouseX - (mouseX - position.x) * scaleRatio;
    const newY = mouseY - (mouseY - position.y) * scaleRatio;
    setScale(nextScale);
    setPosition({ x: newX, y: newY });
  }, [scale, position, generatedImageUrl]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    startDragPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [scale, position]);

  const handleMouseUp = useCallback(() => { 
    isDragging.current = false; 
    isDraggingSlider.current = false;
  }, []);

  const handleSliderMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    isDraggingSlider.current = true;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingSlider.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      setComparisonSliderPos((x / rect.width) * 100);
      return;
    }
    if (!isDragging.current) return;
    setPosition({ x: e.clientX - startDragPos.current.x, y: e.clientY - startDragPos.current.y });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDraggingSlider.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
      setComparisonSliderPos((x / rect.width) * 100);
    }
  }, []);

  const handleParamClick = (setter: any, value: any) => {
    saveToHistory();
    setter(value);
  };

  const handleFilterInteractionStart = () => {
    saveToHistory();
  };
  
  const isProMode = resolution.includes('Ultra') || resolution.includes('2K') || quality === 'Ultra (Pro)';

  return (
    <div className="min-h-screen bg-[#05060b] text-gray-200 font-sans pb-20 selection:bg-indigo-500/30">
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} imageUrl={generatedImageUrl || ''} />
      <div className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-10 relative">
          <div className="absolute left-0 top-0 hidden lg:flex gap-2">
            <button 
              onClick={undo} 
              disabled={past.length === 0}
              className="p-3 bg-gray-800/30 border border-gray-700 rounded-2xl hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-gray-400 group"
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon className="w-5 h-5 group-active:-rotate-45 transition-transform" />
            </button>
            <button 
              onClick={redo} 
              disabled={future.length === 0}
              className="p-3 bg-gray-800/30 border border-gray-700 rounded-2xl hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-gray-400 group"
              title="Redo (Ctrl+Shift+Z)"
            >
              <RedoIcon className="w-5 h-5 group-active:rotate-45 transition-transform" />
            </button>
          </div>

          <button 
            onClick={handleSelectApiKey}
            className={`absolute right-0 top-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${
              hasUserApiKey 
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20' 
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {hasUserApiKey ? 'API Key Active' : 'Set API Key'}
          </button>
          
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full bg-indigo-500/10 border border-indigo-500/20">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
             <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">High-Quality Render Engine</span>
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-tighter leading-tight">
            VIRTUAL STUDIO
          </h1>
          <p className="mt-2 text-[10px] uppercase tracking-[0.6em] text-gray-500 font-black opacity-60">
            AI-POWERED FASHION PHOTOGRAPHY
          </p>
        </header>

        <main className="flex flex-col items-center gap-10">
          {/* Mode Switcher */}
          <div className="flex bg-gray-900/50 p-1 rounded-2xl border border-gray-800 mb-6">
             <button 
                onClick={() => setMode('try-on')}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'try-on' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-500 hover:text-gray-300'}`}
             >
                Virtual Try-On
             </button>
             <button 
                onClick={() => setMode('editor')}
                className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'editor' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-gray-500 hover:text-gray-300'}`}
             >
                <SparklesIcon className="w-4 h-4" />
                Magic Editor
             </button>
          </div>

          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl">
            <div className="flex flex-col items-center">
              <h2 className="text-[10px] font-black mb-6 text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" /> Reference Image
              </h2>
              <ImageUploader onImageUpload={handleImageUpload} onImageRemove={handleImageRemove} onImageRotate={() => setRotation(r => (r + 90) % 360)} imageUrl={originalImageUrl} rotation={rotation} />
            </div>
            
            <div className="flex flex-col items-center">
              <h2 className="text-[10px] font-black mb-6 text-gray-500 uppercase tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" /> HD Rendered Preview
              </h2>
              <div 
                ref={containerRef}
                className="w-full aspect-square bg-[#08090f] rounded-[3.5rem] flex items-center justify-center border border-gray-800/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden select-none"
                onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchMove={handleTouchMove} onTouchEnd={handleMouseUp} onTouchCancel={handleMouseUp}
                style={{ cursor: scale > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'default' }}
              >
                {isLoading && (
                    <div className="flex flex-col items-center gap-6">
                        <Loader />
                        <div className="flex flex-col items-center gap-1">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] animate-pulse">
                                {mode === 'editor' ? 'Editing Image' : `Generating ${resolution}`}
                            </p>
                            <p className="text-[8px] text-gray-600 uppercase tracking-widest">Processing...</p>
                        </div>
                    </div>
                )}
                {!isLoading && !generatedImageUrl && (
                    <div className="text-center text-gray-800 px-6 flex flex-col items-center gap-4">
                        <div className="w-24 h-24 rounded-full border border-gray-800/30 flex items-center justify-center text-4xl bg-gray-900/20">📸</div>
                        <p className="font-black text-[10px] uppercase tracking-[0.4em] text-gray-700">Digital Darkroom Empty</p>
                    </div>
                )}
                {generatedImageUrl && !isLoading && (
                  <>
                    <img src={generatedImageUrl} alt="Generated model" className="w-full h-full object-contain pointer-events-none"
                      style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
                        transition: isDragging.current || isDraggingSlider.current ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                        transformOrigin: '0 0'
                      }}
                    />
                    
                    {showComparison && originalImageUrl && (
                      <div className="absolute inset-0 pointer-events-none" style={{ clipPath: `polygon(0 0, ${comparisonSliderPos}% 0, ${comparisonSliderPos}% 100%, 0 100%)` }}>
                        <img src={originalImageUrl} alt="Original model" className="w-full h-full object-contain pointer-events-none"
                          style={{
                            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            transition: isDragging.current || isDraggingSlider.current ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                            transformOrigin: '0 0',
                            rotate: `${rotation}deg`
                          }}
                        />
                      </div>
                    )}
                    
                    {showComparison && (
                      <div className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10" 
                           style={{ left: `${comparisonSliderPos}%` }}
                           onMouseDown={handleSliderMouseDown}
                           onTouchStart={handleSliderMouseDown}
                      >
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg pointer-events-none text-black">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                         </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {generatedImageUrl && !isLoading && (
                <div className="mt-6 w-full flex flex-col gap-6">
                   <div className="w-full flex justify-end">
                      <button 
                         onClick={() => setShowComparison(prev => !prev)}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            showComparison ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700'
                         }`}
                      >
                         {showComparison ? 'Hide Comparison' : 'Compare Original'}
                      </button>
                   </div>
                   <div className="grid grid-cols-3 gap-3 w-full">
                      <button onClick={handleDownload} className="col-span-2 py-5 bg-white text-black font-black rounded-2xl shadow-xl hover:bg-gray-200 transition-all active:scale-95 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3">
                        <SaveIcon className="w-4 h-4" /> Save
                      </button>
                      <button onClick={handleShare} className="py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-500 transition-all active:scale-95 text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-3" title="Share">
                         <ShareIcon className="w-4 h-4" /> Share
                      </button>
                   </div>
                   <div className="w-full">
                      <button onClick={handleZoomReset} className="w-full py-4 bg-gray-800/30 rounded-2xl border border-gray-700 hover:bg-gray-700 transition-all text-gray-500 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                        <ResetZoomIcon className="w-5 h-5" /> Reset View
                      </button>
                   </div>
                   
                   <div className="bg-[#0e101a] p-8 rounded-[2.5rem] border border-gray-800 space-y-6">
                      <h4 className="text-[9px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">Post-Processing Filters</h4>
                      <div className="space-y-6">
                        {[
                          { label: 'Brightness', value: brightness, setter: setBrightness },
                          { label: 'Contrast', value: contrast, setter: setContrast },
                          { label: 'Saturation', value: saturation, setter: setSaturation }
                        ].map(f => (
                          <div key={f.label} className="space-y-3">
                            <div className="flex justify-between items-center">
                              <label className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{f.label}</label>
                              <span className="text-[10px] font-black text-indigo-400">{f.value}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="200" value={f.value}
                              onMouseDown={handleFilterInteractionStart}
                              onChange={(e) => f.setter(parseInt(e.target.value))}
                              className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className={`lg:col-span-1 space-y-6 ${mode === 'editor' ? 'lg:col-span-4' : ''}`}>
                <div className="bg-[#0e101a] p-6 rounded-[3rem] border border-gray-800 shadow-2xl">
                   <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <SparklesIcon className="w-3 h-3 text-indigo-500" /> {mode === 'editor' ? 'Magic Command Center' : 'Rendering Logic'}
                   </h3>
                   <textarea 
                      value={smartPrompt}
                      onChange={(e) => setSmartPrompt(e.target.value)}
                      onBlur={() => { if(smartPrompt !== (past[past.length-1]?.smartPrompt)) saveToHistory(); }}
                      placeholder={mode === 'editor' ? "Describe how you want to modify the image (e.g., 'Add a retro filter', 'Remove background')..." : "Enter custom instructions..."}
                      className="w-full bg-black/40 border border-gray-800/50 rounded-2xl px-5 py-4 text-xs focus:border-indigo-500/50 outline-none transition-all resize-none h-32 placeholder-gray-600 text-gray-300 font-medium"
                   />
                   
                   {mode === 'try-on' && (
                       <div className="mt-8 space-y-8">
                          <div className="space-y-4">
                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] block">Quality Mode</label>
                            <div className="flex flex-wrap gap-2">
                                {(['Standard', 'High', 'Ultra (Pro)'] as QualityPreset[]).map(q => (
                                    <PillButton 
                                        key={q} 
                                        label={q} 
                                        active={quality === q} 
                                        onClick={() => handleParamClick(setQuality, q)} 
                                        colorClass={q.includes('Ultra') ? "bg-amber-600 border-amber-400" : "bg-purple-600 border-purple-400"} 
                                    />
                                ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] block">Resolution Tier</label>
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${isProMode ? 'text-indigo-400' : 'text-gray-500'}`}>
                                    {isProMode ? 'Pro Mode' : 'Flash Mode'}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {(['1K (Standard)', '2K (Premium)', '4K (Ultra)'] as Resolution[]).map(r => (
                                    <button 
                                        key={r} 
                                        onClick={() => handleParamClick(setResolution, r)}
                                        className={`w-full py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                                            resolution === r 
                                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' 
                                            : 'bg-black/20 border-gray-800 text-gray-600 hover:border-gray-600'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] block">Fine-Grained Detail</label>
                            <div className="flex flex-wrap gap-2">
                                {(['Standard', 'Fine', 'Intricate'] as DetailLevel[]).map(d => (
                                    <PillButton key={d} label={d} active={detailLevel === d} onClick={() => handleParamClick(setDetailLevel, d)} colorClass="bg-indigo-600 border-indigo-400" />
                                ))}
                            </div>
                          </div>
                       </div>
                   )}

                   <button
                        onClick={handleGenerate}
                        disabled={!originalImageUrl || isLoading}
                        className={`w-full mt-10 py-5 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-30 text-xs uppercase tracking-[0.3em] ${
                            mode === 'editor'
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-purple-500/30'
                            : (resolution.includes('Standard') 
                                ? 'bg-gradient-to-r from-gray-700 to-gray-800' 
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/30')
                        }`}
                    >
                        {isLoading ? 'Processing...' : (mode === 'editor' ? 'Magic Edit' : 'Start Rendering')}
                   </button>
                   
                   {error && (
                      <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-2xl flex flex-col items-center gap-3">
                        <p className="text-[9px] font-bold text-red-400 uppercase tracking-widest leading-relaxed text-center">
                          {error}
                        </p>
                        {(error.includes("Quota") || error.includes("Permission")) && (
                            <button 
                                onClick={handleSelectApiKey}
                                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-full text-[9px] font-black text-red-300 uppercase tracking-widest transition-all"
                            >
                                Set API Key Now
                            </button>
                        )}
                      </div>
                   )}
                </div>

                {mode === 'try-on' && (
                    <div className="bg-[#0e101a] p-6 rounded-[2.5rem] border border-gray-800 shadow-2xl space-y-6">
                       <div className="flex items-center justify-between">
                          <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                              <SaveIcon className="w-3 h-3 text-emerald-500" /> Presets
                          </h3>
                          <button 
                            onClick={() => setShowPresetInput(!showPresetInput)}
                            className="text-[9px] font-black text-indigo-400 uppercase tracking-widest"
                          >
                            {showPresetInput ? 'Cancel' : 'Add New'}
                          </button>
                       </div>

                       {showPresetInput && (
                          <div className="space-y-3">
                            <input 
                              type="text" 
                              placeholder="Preset Name" 
                              value={newPresetName}
                              onChange={(e) => setNewPresetName(e.target.value)}
                              className="w-full bg-black/40 border border-gray-800 rounded-xl px-4 py-2 text-[10px] focus:border-indigo-500/50 outline-none text-gray-300"
                            />
                            <button 
                              onClick={handleSavePreset}
                              className="w-full py-2 bg-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest text-white"
                            >
                              Save Current Settings
                            </button>
                          </div>
                       )}

                       <div className="space-y-2">
                          {presets.length === 0 && !showPresetInput && (
                            <p className="text-[8px] text-gray-700 uppercase tracking-widest text-center italic">No saved presets</p>
                          )}
                          {presets.map(p => (
                            <div key={p.id} onClick={() => applyPresetWithHistory(p)} className="flex items-center justify-between p-3 bg-black/20 border border-gray-800 rounded-xl hover:border-gray-600 transition-all cursor-pointer group">
                               <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover:text-gray-300">{p.name}</span>
                               <button onClick={(e) => deletePreset(e, p.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-700 hover:text-red-500 transition-all">
                                  <TrashIcon className="w-3 h-3" />
                               </button>
                            </div>
                          ))}
                       </div>
                    </div>
                )}
            </div>

            {mode === 'try-on' && (
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#0e101a] p-10 rounded-[3.5rem] border border-gray-800 shadow-2xl space-y-8 h-fit">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.4)]" />
                            <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em]">Identity Matrix</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-10">
                            <div className="space-y-4">
                               <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Core Demographics</label>
                               <div className="flex flex-wrap gap-3">
                                    {(['Female', 'Male'] as ModelGender[]).map(g => (
                                        <PillButton key={g} label={g} active={gender === g} onClick={() => handleParamClick(setGender, g)} />
                                    ))}
                                    <div className="w-px h-6 bg-gray-800 mx-1" />
                                    {(['Teen', 'Young Adult', 'Adult', 'Senior'] as ModelAge[]).map(a => (
                                        <PillButton key={a} label={a} active={modelAge === a} onClick={() => handleParamClick(setModelAge, a)} />
                                    ))}
                               </div>
                            </div>

                            <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                   <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Physiological Frame</label>
                                   <span className="text-[10px] font-black text-indigo-400">{formatHeight(modelHeight)}</span>
                               </div>
                               <div className="flex flex-col gap-6">
                                   <input 
                                      type="range" 
                                      min="60" 
                                      max="77" 
                                      value={modelHeight} 
                                      onMouseDown={handleFilterInteractionStart}
                                      onChange={(e) => setModelHeight(parseInt(e.target.value))}
                                      className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                   />
                                   <div className="flex flex-wrap gap-3">
                                        {(['Slim', 'Average', 'Athletic', 'Curvy', 'Plus-size', 'Petite'] as ModelBodyType[]).map(b => (
                                            <PillButton key={b} label={b} active={modelBodyType === b} onClick={() => handleParamClick(setModelBodyType, b)} />
                                        ))}
                                   </div>
                               </div>
                            </div>

                            <div className="space-y-4">
                               <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Ancestry & Hue</label>
                               <div className="flex flex-wrap gap-3">
                                    {(['South Asian', 'Asian', 'Black', 'White', 'Middle Eastern', 'Hispanic', 'Mixed'] as Ethnicity[]).map(e => (
                                        <PillButton key={e} label={e} active={ethnicity === e} onClick={() => handleParamClick(setEthnicity, e)} />
                                    ))}
                               </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                               <div className="space-y-4">
                                  <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Hair Color</label>
                                  <div className="flex flex-wrap gap-2">
                                     {(['Black', 'Brown', 'Blonde', 'Gray'] as HairColor[]).map(h => (
                                        <PillButton key={h} label={h} active={hairColor === h} onClick={() => handleParamClick(setHairColor, h)} colorClass="bg-pink-600 border-pink-400" />
                                     ))}
                                  </div>
                               </div>
                               <div className="space-y-4">
                                  <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Eye Color</label>
                                  <div className="flex flex-wrap gap-2">
                                     {(['Brown', 'Blue', 'Green'] as EyeColor[]).map(e => (
                                        <PillButton key={e} label={e} active={eyeColor === e} onClick={() => handleParamClick(setEyeColor, e)} colorClass="bg-pink-600 border-pink-400" />
                                     ))}
                                  </div>
                               </div>
                            </div>

                            <div className="space-y-4">
                               <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Material Composition</label>
                               <div className="flex flex-wrap gap-3">
                                    {(['Silk', 'Denim', 'Leather', 'Cotton', 'Wool', 'Velvet', 'Linen'] as FabricTexture[]).map(f => (
                                        <PillButton key={f} label={f} active={fabricTexture === f} onClick={() => handleParamClick(setFabricTexture, f)} colorClass="bg-indigo-600 border-indigo-400" />
                                    ))}
                               </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0e101a] p-10 rounded-[3.5rem] border border-gray-800 shadow-2xl space-y-10 h-fit">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.4)]" />
                            <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.3em]">Cinematic Staging</h4>
                        </div>

                        <div className="space-y-6">
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Active Choreography</label>
                            <div className="flex flex-wrap gap-3">
                                {(['Standing', 'Sitting', 'Walking', 'Relaxed', 'Dynamic'] as ModelPose[]).map(p => (
                                    <PillButton key={p} label={p} active={modelPose === p} onClick={() => handleParamClick(setModelPose, p)} colorClass="bg-blue-600 border-blue-400" />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Compositional Optics</label>
                            <div className="flex flex-wrap gap-3">
                                {(['Front View', 'Side View', 'Three-Quarter View', 'Close-up'] as CameraAngle[]).map(a => (
                                    <PillButton key={a} label={a} active={cameraAngle === a} onClick={() => handleParamClick(setCameraAngle, a)} colorClass="bg-cyan-600 border-cyan-400" />
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <label className="text-[9px] font-black text-gray-700 uppercase tracking-widest block">Environmental Vector</label>
                            <div className="flex flex-wrap gap-3">
                                {(['Studio', 'Outdoor', 'Cityscape', 'Beach', 'Forest', 'Abstract', 'Night City', 'Desert', 'Solid Color'] as BackgroundStyle[]).map(bg => (
                                    <PillButton key={bg} label={bg} active={backgroundStyle === bg} onClick={() => handleParamClick(setBackgroundStyle, bg)} colorClass="bg-gray-700 border-gray-600" />
                                ))}
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-800/50">
                            <button onClick={handleSelectApiKey} className="w-full py-5 bg-black/40 border border-gray-800 rounded-2xl text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] hover:text-gray-300 transition-all flex items-center justify-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${hasUserApiKey ? 'bg-green-500' : 'bg-gray-700'}`} />
                                {hasUserApiKey ? 'PRO KEY ACTIVE' : 'SELECT PERSONAL GPU KEY'}
                            </button>
                            {!hasUserApiKey && (
                                <p className="mt-4 text-[8px] text-gray-600 text-center uppercase tracking-widest leading-relaxed">
                                    Mandatory for 2K/4K. Visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-indigo-500 underline">Billing Docs</a> to setup.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
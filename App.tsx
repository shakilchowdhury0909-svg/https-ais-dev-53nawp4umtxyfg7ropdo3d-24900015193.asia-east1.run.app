import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, Gem } from 'lucide-react';
import { ImageUploader } from './components/ImageUploader';
import { Loader } from './components/Loader';
import {
  SparklesIcon,
  SaveIcon,
  ResetZoomIcon,
  TrashIcon,
  UndoIcon,
  RedoIcon,
  ShareIcon,
  TwitterIcon,
  FacebookIcon,
  LinkIcon,
  HistoryIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './components/icons';
import { generateVirtualTryOn, editImageWithGemini, GenerationOptions } from './services/geminiService';
import { fileToBase64, rotateImage } from './utils/imageUtils';
import { saveSessionToIndexedDB, loadSessionFromIndexedDB, clearSessionFromIndexedDB, getAllSessionsFromIndexedDB, SavedSession } from './utils/indexedDBUtils';

export const SAMPLE_PRESETS = [
  {
    name: 'South Asian Silk Saree & Gold',
    label: 'শাড়ি ও সোনার গয়না',
    modelUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&auto=format&fit=crop&q=80',
    garmentUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=900&auto=format&fit=crop&q=80',
    prompt: 'মানানসই খাঁটি সোনার জড়োয়া নেকলেস, ঐতিহ্যবাহী ঝুমকো ও সোনার বালা (Matching traditional gold Kundan necklace, jhumka earrings, and handcrafted gold bangles)',
    jewelry: 'Matching Gold Jewelry',
  },
  {
    name: 'Evening Gown & Diamond Set',
    label: 'গাউন ও হিরের সেট',
    modelUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop&q=80',
    garmentUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=900&auto=format&fit=crop&q=80',
    prompt: 'মানানসই হীরার নেকলেস ও কানের দুল (Sparkling diamond pendant necklace, matching studs, and elegant silver bracelet)',
    jewelry: 'Diamond & Gemstone Set',
  },
  {
    name: 'Royal Bridal & Kundan Set',
    label: 'ব্রাইডাল কুন্দন সেট',
    modelUrl: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=900&auto=format&fit=crop&q=80',
    garmentUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=900&auto=format&fit=crop&q=80',
    prompt: 'রাজকীয় কুন্দন চোকার, মাং টিকা, নথ ও রত্নখচিত বালা (Royal Kundan choker necklace, matching earrings, and ornate bangles)',
    jewelry: 'Royal Kundan & Polki',
  },
];

export const JEWELRY_OPTIONS = [
  { value: 'Matching Gold Jewelry', label: '✨ সোনার গয়না (Gold Necklace & Jhumkas)', promptSuffix: 'মানানসই খাঁটি সোনার নেকলেস, ঝুমকো ও সোনার চুড়ি (Traditional gold necklace, jhumkas and bangles)' },
  { value: 'Diamond & Gemstone Set', label: '💎 হিরের সেট (Sparkling Diamond Set)', promptSuffix: 'চকচকে হিরের নেকলেস, কানের টপস ও ডায়মন্ড ব্রেসলেট (Sparkling diamond necklace, studs and bracelet)' },
  { value: 'Royal Kundan & Polki', label: '👑 রাজকীয় কুন্দন (Kundan Choker & Polki)', promptSuffix: 'ঐতিহ্যবাহী কুন্দন চোকার হার, নথ ও টিকলি (Traditional Kundan choker set, nath and tikli)' },
  { value: 'Elegant Pearl Collection', label: '🦪 মুক্তার মালা (Pearl Choker & Drops)', promptSuffix: 'অভিজাত মুক্তার মালা ও মুক্তার কানের দুল (Elegant multi-strand pearl necklace and drop earrings)' },
  { value: 'Minimalist Silver & Rose Gold', label: '⚡ মিনিমালিস্ট (Modern Minimalist)', promptSuffix: 'আধুনিক স্লিক সিলভার চেইন ও মিনিমালিস্ট জুয়েলারি (Modern minimalist sleek silver chain & studs)' },
  { value: 'None', label: '❌ গয়না ছাড়া (Garment Only)', promptSuffix: '' },
];

export const QUICK_JEWELRY_CHIPS = [
  { label: '✨ সোনার জড়োয়া হার', text: 'মানানসই খাঁটি সোনার জড়োয়া নেকলেস' },
  { label: '💎 হিরের পেন্ডেন্ট ও টপস', text: 'উজ্জ্বল হিরের পেন্ডেন্ট ও কানের দুল' },
  { label: '👑 কুন্দন ব্রাইডাল সেট', text: 'পোশাকের সাথে ম্যাচিং রাজকীয় কুন্দন চোকার সেট' },
  { label: '🦪 মুক্তার মালা', text: 'অভিজাত খাঁটি মুক্তার মালা' },
  { label: '💫 সোনার চুড়ি ও বালা', text: 'হাতের মানানসই নকশাদার সোনার চুড়ি ও বালা' },
  { label: '🌸 কানের ঝুমকো', text: 'পোশাকের রঙে মানানসই ঐতিহ্যবাহী ঝুমকো' },
];

interface AppSnapshot {
  modelImageUrl: string | null;
  garmentImageUrl: string | null;
  generatedImageUrl: string | null;
  prompt: string;
  lighting: string;
  style: string;
  aspectRatio: string;
  brightness: number;
  contrast: number;
  saturation: number;
  mode?: 'tryon' | 'editor';
  jewelry?: string;
}

interface BatchItem {
  id: string;
  file: File;
  originalUrl: string;
  generatedUrl?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export default function App() {
  const [mode, setMode] = useState<'tryon' | 'editor'>('tryon');

  // Input states
  const [modelImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [modelImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [garmentImageFile, setGarmentImageFile] = useState<File | null>(null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const [prompt, setPrompt] = useState<string>('');
  const [jewelry, setJewelry] = useState<string>('Matching Gold Jewelry');
  const [lighting, setLighting] = useState<string>('Studio');
  const [style, setStyle] = useState<string>('Realistic');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [resolution, setResolution] = useState<string>('1024x1024');

  // Image adjustments
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  // Canvas zoom & pan
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);
  const startDragPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullScreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Lock body scroll when in fullscreen mode
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

  // Comparison slider
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [comparisonSliderPos, setComparisonSliderPos] = useState<number>(50);
  const isDraggingSlider = useRef<boolean>(false);

  // Status & loading
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Synthesizing high-res try-on...');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Undo / Redo history
  const [past, setPast] = useState<AppSnapshot[]>([]);
  const [future, setFuture] = useState<AppSnapshot[]>([]);

  // Batch mode
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

  // Modals
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  // Snapshot helpers
  const getSnapshot = useCallback((): AppSnapshot => {
    return {
      modelImageUrl,
      garmentImageUrl,
      generatedImageUrl,
      prompt,
      jewelry,
      lighting,
      style,
      aspectRatio,
      brightness,
      contrast,
      saturation,
      mode,
    };
  }, [
    modelImageUrl,
    garmentImageUrl,
    generatedImageUrl,
    prompt,
    jewelry,
    lighting,
    style,
    aspectRatio,
    brightness,
    contrast,
    saturation,
    mode,
  ]);

  const applySnapshot = useCallback((s: AppSnapshot) => {
    setOriginalImageUrl(s.modelImageUrl);
    setGarmentImageUrl(s.garmentImageUrl);
    setGeneratedImageUrl(s.generatedImageUrl);
    setPrompt(s.prompt);
    if (s.jewelry !== undefined) setJewelry(s.jewelry);
    setLighting(s.lighting);
    setStyle(s.style);
    setAspectRatio(s.aspectRatio);
    setBrightness(s.brightness);
    setContrast(s.contrast);
    setSaturation(s.saturation);
    if (s.mode) setMode(s.mode);
  }, []);

  const pushSnapshot = useCallback(() => {
    const current = getSnapshot();
    setPast((prev) => [...prev, current]);
    setFuture([]);
  }, [getSnapshot]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const current = getSnapshot();
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [current, ...prev]);
    applySnapshot(previous);
  }, [past, getSnapshot, applySnapshot]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const current = getSnapshot();
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, current]);
    applySnapshot(next);
  }, [future, getSnapshot, applySnapshot]);

  // Handle Model file upload
  const handleModelImageSelect = async (file: File) => {
    pushSnapshot();
    setOriginalImageFile(file);
    const base64 = await fileToBase64(file);
    setOriginalImageUrl(base64);
    setRotation(0);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Handle Garment file upload
  const handleGarmentImageSelect = async (file: File) => {
    pushSnapshot();
    setGarmentImageFile(file);
    const base64 = await fileToBase64(file);
    setGarmentImageUrl(base64);
  };

  const handleRotateModel = async () => {
    if (!modelImageUrl) return;
    const newRot = (rotation + 90) % 360;
    setRotation(newRot);
    const rotated = await rotateImage(modelImageUrl, 90);
    setOriginalImageUrl(rotated);
  };

  const handleZoomReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.1;
    const newScale = e.deltaY < 0 ? Math.min(scale + zoomFactor, 4) : Math.max(scale - zoomFactor, 1);
    setScale(newScale);
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  // Load Preset Look
  const handleSelectPreset = (preset: typeof SAMPLE_PRESETS[0]) => {
    pushSnapshot();
    setOriginalImageUrl(preset.modelUrl);
    setGarmentImageUrl(preset.garmentUrl);
    setPrompt(preset.prompt);
    setJewelry(preset.jewelry);
    setMode('tryon');
    setStatusMessage(null);
  };

  // Dedicated Quick Action: Add Matching Jewelry to Current Look
  const handleAddJewelryToCurrentLook = async () => {
    const targetImage = generatedImageUrl || modelImageUrl;
    if (!targetImage) {
      setStatusMessage('Please upload or generate a photo of the woman first.');
      return;
    }

    pushSnapshot();
    setIsLoading(true);
    setStatusMessage(null);
    const chosenJewelry = jewelry !== 'None' ? jewelry : 'Matching Gold & Gemstone Jewelry';
    setLoadingMessage(`নারীর পোশাকে মানানসই ${chosenJewelry} অলংকার যোগ করা হচ্ছে...`);

    try {
      const jewelryPrompt = prompt.trim()
        ? `Adorn the woman wearing the outfit with matching ${chosenJewelry}: ${prompt}. Add an elegant matching necklace along her neckline, complementary earrings, and coordinated bangles/bracelets that naturally fit the color and fabric of her dress.`
        : `Add exquisite, matching ${chosenJewelry} to the woman's outfit: an elegant necklace along her neckline, matching earrings, and coordinated bangles/bracelets that perfectly complement the dress fabric, color, and style.`;

      const options: GenerationOptions = {
        aspectRatio,
        lighting,
        style,
        resolution,
        jewelry: chosenJewelry,
      };

      const resultUrl = await editImageWithGemini(targetImage, jewelryPrompt, options);
      setGeneratedImageUrl(resultUrl);
      handleZoomReset();

      const sessionData: SavedSession = {
        id: `session_${Date.now()}`,
        name: `Jewelry - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        timestamp: Date.now(),
        mode: 'editor',
        modelImageUrl: targetImage,
        generatedImageUrl: resultUrl,
        prompt: jewelryPrompt,
        options: {
          ...options,
          jewelry: chosenJewelry,
        },
      };
      await saveSessionToIndexedDB(sessionData.id, sessionData);
    } catch (err: any) {
      console.error('Failed to add jewelry:', err);
      setStatusMessage('গয়না যোগ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  // Generation Trigger
  const handleGenerate = async () => {
    if (mode === 'tryon' && (!modelImageUrl || !garmentImageUrl)) {
      setStatusMessage('Please provide both a model photo and a garment photo.');
      return;
    }
    if (mode === 'editor' && !modelImageUrl) {
      setStatusMessage('Please upload an image to edit.');
      return;
    }

    pushSnapshot();
    setIsLoading(true);
    setStatusMessage(null);
    setLoadingMessage(mode === 'tryon' ? 'Dressing model with AI precision...' : 'Applying smart photo edits...');

    try {
      const options: GenerationOptions = {
        aspectRatio,
        lighting,
        style,
        resolution,
        jewelry: jewelry !== 'None' ? jewelry : undefined,
      };

      let resultUrl = '';
      if (mode === 'tryon') {
        resultUrl = await generateVirtualTryOn(modelImageUrl!, garmentImageUrl!, prompt, options);
      } else {
        resultUrl = await editImageWithGemini(modelImageUrl!, prompt, options);
      }

      setGeneratedImageUrl(resultUrl);
      handleZoomReset();

      // Save to IndexedDB automatically
      const sessionData: SavedSession = {
        id: `session_${Date.now()}`,
        name: `${mode === 'tryon' ? 'Try-On' : 'Edit'} - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        timestamp: Date.now(),
        mode,
        modelImageUrl,
        garmentImageUrl,
        generatedImageUrl: resultUrl,
        prompt,
        options: {
          ...options,
          jewelry,
        },
      };
      await saveSessionToIndexedDB(sessionData.id, sessionData);
    } catch (err: any) {
      console.error('Generation error:', err);
      setStatusMessage('Generation failed. Please check inputs and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Swipe gesture & generations navigation state
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const isTouchSwiping = useRef<boolean>(false);
  const isMouseSwiping = useRef<boolean>(false);
  const mouseStartX = useRef<number>(0);
  const mouseStartY = useRef<number>(0);
  const mouseStartTime = useRef<number>(0);

  // Batch navigation
  const completedBatchItems = batchItems.filter((item) => item.status === 'done' && item.generatedUrl);
  const currentBatchIndex = completedBatchItems.findIndex((item) => item.generatedUrl === generatedImageUrl);
  const isBatchMode = currentBatchIndex !== -1 && completedBatchItems.length > 1;

  // Extract distinct past generations from history snapshots
  const pastGenerations = React.useMemo(() => {
    const list: { url: string; snapshot: AppSnapshot; originalPastIndex: number }[] = [];
    const seen = new Set<string>();
    if (generatedImageUrl) seen.add(generatedImageUrl);

    for (let i = past.length - 1; i >= 0; i--) {
      const s = past[i];
      if (s.generatedImageUrl && !seen.has(s.generatedImageUrl)) {
        seen.add(s.generatedImageUrl);
        list.unshift({ url: s.generatedImageUrl, snapshot: s, originalPastIndex: i });
      }
    }
    return list;
  }, [past, generatedImageUrl]);

  // Extract distinct future generations from history snapshots
  const futureGenerations = React.useMemo(() => {
    const list: { url: string; snapshot: AppSnapshot; originalFutureIndex: number }[] = [];
    const seen = new Set<string>();
    if (generatedImageUrl) seen.add(generatedImageUrl);

    for (let i = 0; i < future.length; i++) {
      const s = future[i];
      if (s.generatedImageUrl && !seen.has(s.generatedImageUrl)) {
        seen.add(s.generatedImageUrl);
        list.push({ url: s.generatedImageUrl, snapshot: s, originalFutureIndex: i });
      }
    }
    return list;
  }, [future, generatedImageUrl]);

  const canNavigatePrev = isBatchMode ? currentBatchIndex > 0 : pastGenerations.length > 0;
  const canNavigateNext = isBatchMode ? currentBatchIndex < completedBatchItems.length - 1 : futureGenerations.length > 0;

  const totalGenerations = isBatchMode
    ? completedBatchItems.length
    : pastGenerations.length + (generatedImageUrl ? 1 : 0) + futureGenerations.length;

  const currentGenerationIndex = isBatchMode ? currentBatchIndex : pastGenerations.length;

  const navigateToPrevGeneration = useCallback(() => {
    if (isBatchMode && currentBatchIndex > 0) {
      const prevItem = completedBatchItems[currentBatchIndex - 1];
      setOriginalImageFile(prevItem.file);
      setOriginalImageUrl(prevItem.originalUrl);
      setGeneratedImageUrl(prevItem.generatedUrl || null);
      setRotation(0);
      handleZoomReset();
      setSwipeOffset(0);
      return;
    }

    if (pastGenerations.length === 0) return;
    const target = pastGenerations[pastGenerations.length - 1];
    const currentSnap = getSnapshot();
    const targetSnap = past[target.originalPastIndex];

    const newFuture = [...past.slice(target.originalPastIndex + 1), currentSnap, ...future];
    const newPast = past.slice(0, target.originalPastIndex);

    setPast(newPast);
    setFuture(newFuture);
    applySnapshot(targetSnap);
    handleZoomReset();
    setSwipeOffset(0);
  }, [isBatchMode, currentBatchIndex, completedBatchItems, pastGenerations, past, future, getSnapshot, applySnapshot, handleZoomReset]);

  const navigateToNextGeneration = useCallback(() => {
    if (isBatchMode && currentBatchIndex < completedBatchItems.length - 1) {
      const nextItem = completedBatchItems[currentBatchIndex + 1];
      setOriginalImageFile(nextItem.file);
      setOriginalImageUrl(nextItem.originalUrl);
      setGeneratedImageUrl(nextItem.generatedUrl || null);
      setRotation(0);
      handleZoomReset();
      setSwipeOffset(0);
      return;
    }

    if (futureGenerations.length === 0) return;
    const target = futureGenerations[0];
    const currentSnap = getSnapshot();
    const targetSnap = future[target.originalFutureIndex];

    const newPast = [...past, currentSnap, ...future.slice(0, target.originalFutureIndex)];
    const newFuture = future.slice(target.originalFutureIndex + 1);

    setPast(newPast);
    setFuture(newFuture);
    applySnapshot(targetSnap);
    handleZoomReset();
    setSwipeOffset(0);
  }, [isBatchMode, currentBatchIndex, completedBatchItems, futureGenerations, past, future, getSnapshot, applySnapshot, handleZoomReset]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'textarea' || activeTag === 'input') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        redo();
      } else if (e.key === 'ArrowLeft' && canNavigatePrev) {
        navigateToPrevGeneration();
      } else if (e.key === 'ArrowRight' && canNavigateNext) {
        navigateToNextGeneration();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        setIsFullscreen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canNavigatePrev, canNavigateNext, navigateToPrevGeneration, navigateToNextGeneration, isFullscreen]);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (isDraggingSlider.current) return;

      if (scale > 1) {
        isDragging.current = true;
        startDragPos.current = { x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y };
        return;
      }

      if (generatedImageUrl && totalGenerations > 1) {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        isTouchSwiping.current = true;
        setSwipeOffset(0);
      }
    },
    [scale, position, generatedImageUrl, totalGenerations]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDraggingSlider.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
        setComparisonSliderPos((x / rect.width) * 100);
        return;
      }

      if (scale > 1 && isDragging.current) {
        setPosition({
          x: e.touches[0].clientX - startDragPos.current.x,
          y: e.touches[0].clientY - startDragPos.current.y,
        });
        return;
      }

      if (!isTouchSwiping.current || scale > 1 || !generatedImageUrl) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - touchStartX.current;
      const diffY = currentY - touchStartY.current;

      if (Math.abs(diffX) > Math.abs(diffY)) {
        let effectiveDiff = diffX;
        if ((diffX > 0 && !canNavigatePrev) || (diffX < 0 && !canNavigateNext)) {
          effectiveDiff = diffX * 0.25;
        }
        setSwipeOffset(effectiveDiff);
      }
    },
    [scale, generatedImageUrl, canNavigatePrev, canNavigateNext]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      isDragging.current = false;
      isDraggingSlider.current = false;

      if (!isTouchSwiping.current || scale > 1 || !generatedImageUrl) {
        isTouchSwiping.current = false;
        setSwipeOffset(0);
        return;
      }

      isTouchSwiping.current = false;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - touchStartX.current;
      const diffY = touchEndY - touchStartY.current;
      const duration = Date.now() - touchStartTime.current;

      const isHorizontal = Math.abs(diffX) > Math.abs(diffY) * 1.1;
      const isFastSwipe = Math.abs(diffX) > 30 && duration < 350;
      const isNormalSwipe = Math.abs(diffX) > 50;

      if (isHorizontal && (isFastSwipe || isNormalSwipe)) {
        if (diffX > 0 && canNavigatePrev) {
          navigateToPrevGeneration();
        } else if (diffX < 0 && canNavigateNext) {
          navigateToNextGeneration();
        }
      }

      setSwipeOffset(0);
    },
    [scale, generatedImageUrl, canNavigatePrev, canNavigateNext, navigateToPrevGeneration, navigateToNextGeneration]
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingSlider.current) return;
      if (scale > 1) {
        isDragging.current = true;
        startDragPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        return;
      }

      if (generatedImageUrl && totalGenerations > 1) {
        isMouseSwiping.current = true;
        mouseStartX.current = e.clientX;
        mouseStartY.current = e.clientY;
        mouseStartTime.current = Date.now();
        setSwipeOffset(0);
      }
    },
    [scale, position, generatedImageUrl, totalGenerations]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingSlider.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        setComparisonSliderPos((x / rect.width) * 100);
        return;
      }

      if (scale > 1 && isDragging.current) {
        setPosition({ x: e.clientX - startDragPos.current.x, y: e.clientY - startDragPos.current.y });
        return;
      }

      if (isMouseSwiping.current && scale <= 1 && generatedImageUrl) {
        const diffX = e.clientX - mouseStartX.current;
        const diffY = e.clientY - mouseStartY.current;
        if (Math.abs(diffX) > Math.abs(diffY)) {
          let effectiveDiff = diffX;
          if ((diffX > 0 && !canNavigatePrev) || (diffX < 0 && !canNavigateNext)) {
            effectiveDiff = diffX * 0.25;
          }
          setSwipeOffset(effectiveDiff);
        }
      }
    },
    [scale, generatedImageUrl, canNavigatePrev, canNavigateNext]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = false;
      isDraggingSlider.current = false;

      if (isMouseSwiping.current && scale <= 1 && generatedImageUrl) {
        isMouseSwiping.current = false;
        const diffX = e.clientX - mouseStartX.current;
        const diffY = e.clientY - mouseStartY.current;
        const duration = Date.now() - mouseStartTime.current;

        const isHorizontal = Math.abs(diffX) > Math.abs(diffY) * 1.1;
        const isFastSwipe = Math.abs(diffX) > 30 && duration < 350;
        const isNormalSwipe = Math.abs(diffX) > 50;

        if (isHorizontal && (isFastSwipe || isNormalSwipe)) {
          if (diffX > 0 && canNavigatePrev) {
            navigateToPrevGeneration();
          } else if (diffX < 0 && canNavigateNext) {
            navigateToNextGeneration();
          }
        }
        setSwipeOffset(0);
      }
    },
    [scale, generatedImageUrl, canNavigatePrev, canNavigateNext, navigateToPrevGeneration, navigateToNextGeneration]
  );

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false;
    isDraggingSlider.current = false;
    if (isMouseSwiping.current) {
      isMouseSwiping.current = false;
      setSwipeOffset(0);
    }
  }, []);

  const handleSliderMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    isDraggingSlider.current = true;
  }, []);

  const handleDownload = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = `virtual-try-on-${Date.now()}.jpg`;
    a.click();
  };

  const handleLoadHistory = async () => {
    const sessions = await getAllSessionsFromIndexedDB();
    setSavedSessions(sessions);
    setShowHistoryModal(true);
  };

  const handleRestoreSession = (s: SavedSession) => {
    pushSnapshot();
    if (s.mode) setMode(s.mode as any);
    setOriginalImageUrl(s.modelImageUrl || null);
    setGarmentImageUrl(s.garmentImageUrl || null);
    setGeneratedImageUrl(s.generatedImageUrl || null);
    setPrompt(s.prompt || '');
    if (s.options) {
      if (s.options.lighting) setLighting(s.options.lighting);
      if (s.options.style) setStyle(s.options.style);
      if (s.options.aspectRatio) setAspectRatio(s.options.aspectRatio);
      if (s.options.resolution) setResolution(s.options.resolution);
      if (s.options.jewelry) setJewelry(s.options.jewelry);
    }
    handleZoomReset();
    setShowHistoryModal(false);
  };

  const handleDeleteSession = async (id: string) => {
    await clearSessionFromIndexedDB(id);
    setSavedSessions((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#07080f] text-gray-100 flex flex-col antialiased">
      {/* Top Header */}
      <header className="border-b border-gray-800/60 bg-[#090b14]/80 backdrop-blur-xl sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Virtual Try-On <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Studio</span>
            </h1>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white transition-all"
            title="Undo (Ctrl+Z)"
          >
            <UndoIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white transition-all"
            title="Redo (Ctrl+Y)"
          >
            <RedoIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleLoadHistory}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-semibold text-gray-300 hover:text-white transition-all"
            title="Session History"
          >
            <HistoryIcon className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">History</span>
          </button>
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            disabled={!generatedImageUrl}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold text-gray-300 hover:text-white transition-all"
            title="Share Result"
          >
            <ShareIcon className="w-4 h-4 text-violet-400" />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column: Controls & Inputs */}
        <div className="lg:col-span-5 flex flex-col space-y-6">
          {/* Mode Tabs */}
          <div className="p-1 rounded-2xl bg-gray-900/80 border border-gray-800/80 flex items-center gap-1">
            <button
              onClick={() => setMode('tryon')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'tryon'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Virtual Try-On
            </button>
            <button
              onClick={() => setMode('editor')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                mode === 'editor'
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              AI Photo Editor
            </button>
          </div>

          {/* Quick Preset Looks */}
          <div className="p-3 rounded-2xl bg-[#0a0c16] border border-gray-800/60 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-400 font-bold flex items-center gap-1.5">
                <Gem className="w-3.5 h-3.5 text-amber-400" />
                স্যাম্পল লুক ও গয়না (Sample Looks):
              </span>
              <span className="text-[10px] text-amber-400/80 font-medium">১-ক্লিকে লোড করুন</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className="px-2 py-1.5 rounded-xl bg-gray-900/80 border border-gray-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-gray-300 hover:text-amber-200 text-[11px] font-semibold transition-all text-center leading-tight truncate"
                  title={preset.name}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Uploaders Container */}
          <div className="p-5 rounded-3xl bg-[#0b0d18] border border-gray-800/70 shadow-xl space-y-5">
            <div className={`grid ${mode === 'tryon' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <ImageUploader
                title={mode === 'tryon' ? '1. Model Photo' : 'Upload Image'}
                description={mode === 'tryon' ? 'Full body or torso' : 'Any photo to edit'}
                imageUrl={modelImageUrl}
                onImageSelect={handleModelImageSelect}
                onClear={() => {
                  pushSnapshot();
                  setOriginalImageFile(null);
                  setOriginalImageUrl(null);
                }}
                onRotate={handleRotateModel}
                rotation={rotation}
              />

              {mode === 'tryon' && (
                <ImageUploader
                  title="2. Garment Photo"
                  description="Clothing item"
                  imageUrl={garmentImageUrl}
                  onImageSelect={handleGarmentImageSelect}
                  onClear={() => {
                    pushSnapshot();
                    setGarmentImageFile(null);
                    setGarmentImageUrl(null);
                  }}
                />
              )}
            </div>

            {/* Matching Jewelry Section */}
            <div className="p-3.5 rounded-2xl bg-[#080914] border border-amber-500/20 shadow-inner space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Gem className="w-3.5 h-3.5 text-amber-400" />
                  পোশাকের মানানসই গহনা (Matching Jewelry)
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  AI Styling
                </span>
              </div>

              {/* Jewelry Style Dropdown */}
              <select
                value={jewelry}
                onChange={(e) => setJewelry(e.target.value)}
                className="w-full bg-[#0b0d1c] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-100 font-medium focus:outline-none focus:border-amber-400"
              >
                {JEWELRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0b0d18] text-gray-200">
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Quick Jewelry Suggestion Chips */}
              <div className="space-y-1 pt-1">
                <div className="text-[10px] text-gray-400 font-semibold">কুইক গয়না নির্বাচন (Quick Chips):</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_JEWELRY_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => {
                        pushSnapshot();
                        const addition = chip.text;
                        setPrompt((prev) => {
                          if (!prev) return addition;
                          if (prev.includes(addition)) return prev;
                          return `${prev}, ${addition}`;
                        });
                        if (chip.label.includes('সোনার')) setJewelry('Matching Gold Jewelry');
                        else if (chip.label.includes('হিরের')) setJewelry('Diamond & Gemstone Set');
                        else if (chip.label.includes('কুন্দন')) setJewelry('Royal Kundan & Polki');
                        else if (chip.label.includes('মুক্তার')) setJewelry('Elegant Pearl Collection');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-gray-900 hover:bg-amber-950/40 border border-gray-800 hover:border-amber-500/40 text-[11px] text-gray-300 hover:text-amber-200 transition-all active:scale-95"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  {mode === 'tryon' ? 'Fitting, Jewelry & Styling Notes' : 'Edit Prompt'}
                </label>
                <span className="text-[10px] text-gray-500 font-medium">Optional</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === 'tryon'
                    ? 'e.g. পোশাকের সাথে মানানসই সোনার নেকলেস ও ঝুমকা, tuck in the shirt, match natural fabric folds...'
                    : 'e.g. Add matching gold necklace and earrings to the woman\'s outfit...'
                }
                rows={2}
                className="w-full bg-[#080912] border border-gray-800 rounded-2xl p-3 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            {/* Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Lighting</label>
                <select
                  value={lighting}
                  onChange={(e) => setLighting(e.target.value)}
                  className="w-full mt-1 bg-[#080912] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Studio">Studio Softbox</option>
                  <option value="Natural Daylight">Natural Daylight</option>
                  <option value="Golden Hour">Golden Hour</option>
                  <option value="Dramatic High-Contrast">Dramatic High-Contrast</option>
                  <option value="Cyberpunk Neon">Cyberpunk Neon</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Aesthetic Style</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full mt-1 bg-[#080912] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Realistic">Photorealistic</option>
                  <option value="Editorial Vogue">Editorial Vogue</option>
                  <option value="Streetwear Lookbook">Streetwear Lookbook</option>
                  <option value="Haute Couture">Haute Couture</option>
                  <option value="Casual Minimalist">Casual Minimalist</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Aspect Ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full mt-1 bg-[#080912] border border-gray-800 rounded-xl px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="1:1">1:1 Square</option>
                  <option value="3:4">3:4 Portrait</option>
                  <option value="4:3">4:3 Landscape</option>
                  <option value="9:16">9:16 Story</option>
                </select>
              </div>
            </div>

            {/* Fine-Tuning Filters */}
            <div className="space-y-3 pt-3 border-t border-gray-800/60">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-semibold">Brightness</span>
                <span>{brightness}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="140"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
              />

              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="font-semibold">Contrast</span>
                <span>{contrast}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="140"
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-gray-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Error / Status Alert */}
            {statusMessage && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-200 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Generate Action Button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || (mode === 'tryon' && (!modelImageUrl || !garmentImageUrl)) || (mode === 'editor' && !modelImageUrl)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-white text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <SparklesIcon className="w-4 h-4 text-indigo-200" />
              <span>{isLoading ? 'Generating...' : mode === 'tryon' ? 'Generate Virtual Try-On' : 'Apply AI Edit'}</span>
            </button>

            {/* Dedicated Matching Jewelry Button */}
            {(generatedImageUrl || modelImageUrl) && (
              <button
                type="button"
                id="add-matching-jewelry-button"
                onClick={handleAddJewelryToCurrentLook}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600/25 via-yellow-600/20 to-amber-600/25 hover:from-amber-600/35 hover:to-amber-500/35 border border-amber-500/40 text-amber-200 hover:text-white font-bold text-xs shadow-lg shadow-amber-950/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <Gem className="w-4 h-4 text-amber-400" />
                <span>পোশাকে মানানসই গয়না যোগ করুন (Add Matching Jewelry)</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Canvas Preview */}
        <div className="lg:col-span-7 flex flex-col space-y-4">
          <div
            id="preview-canvas-wrapper"
            className={
              isFullscreen
                ? 'fixed inset-0 z-50 bg-[#07080f] flex flex-col p-3 sm:p-5 space-y-3'
                : 'flex flex-col space-y-4'
            }
          >
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                Preview Canvas
                {isFullscreen && (
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase tracking-wider">
                    Full Screen
                  </span>
                )}
                {scale > 1 && (
                  <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800/40">
                    {Math.round(scale * 100)}% Zoom
                  </span>
                )}
              </h2>

              {/* Canvas Toolbar */}
              <div className="flex items-center gap-2">
                {(generatedImageUrl || modelImageUrl) && (
                  <button
                    type="button"
                    id="toolbar-add-jewelry-button"
                    onClick={handleAddJewelryToCurrentLook}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 hover:text-white text-xs font-semibold transition-all shadow-sm"
                    title="পোশাকে মানানসই গয়না যোগ করুন (Add Matching Jewelry)"
                  >
                    <Gem className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">মানানসই গয়না</span>
                  </button>
                )}

                {generatedImageUrl && modelImageUrl && (
                  <button
                    type="button"
                    onClick={() => setShowComparison(!showComparison)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      showComparison
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
                    }`}
                  >
                    {showComparison ? 'Exit Split View' : 'Compare Original'}
                  </button>
                )}

                {scale > 1 && (
                  <button
                    type="button"
                    onClick={handleZoomReset}
                    className="p-2 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all"
                    title="Reset Zoom"
                  >
                    <ResetZoomIcon className="w-4 h-4" />
                  </button>
                )}

                {generatedImageUrl && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-300 hover:text-white transition-all"
                    title="Download Image"
                  >
                    <SaveIcon className="w-4 h-4" />
                  </button>
                )}

                {/* Full Screen Button */}
                <button
                  type="button"
                  id="canvas-fullscreen-button"
                  onClick={toggleFullScreen}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    isFullscreen
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white'
                  }`}
                  title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen (F)'}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-4 h-4" />
                      <span>Exit Full Screen</span>
                      <kbd className="hidden sm:inline-block text-[10px] bg-indigo-700/60 px-1.5 py-0.5 rounded text-indigo-100 font-mono">
                        Esc
                      </kbd>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 text-indigo-400" />
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Canvas Element with Swipe Support & Zoom/Pan */}
            <div
              ref={containerRef}
              id="preview-canvas-viewport"
              className={`w-full bg-[#08090f] flex items-center justify-center border border-gray-800/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden select-none touch-none ${
                isFullscreen
                  ? 'flex-1 h-full min-h-0 rounded-2xl sm:rounded-3xl'
                  : 'aspect-square rounded-[2.5rem]'
              }`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            style={{
              cursor: scale > 1 ? (isDragging.current ? 'grabbing' : 'grab') : totalGenerations > 1 ? 'grab' : 'default',
            }}
          >
            {isLoading && (
              <div className="flex flex-col items-center gap-6">
                <Loader message={loadingMessage} />
              </div>
            )}

            {!isLoading && !generatedImageUrl && !modelImageUrl && (
              <div className="flex flex-col items-center gap-3 text-gray-600 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-900 flex items-center justify-center text-gray-500">
                  <SparklesIcon className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-sm font-semibold text-gray-400">No Image Rendered Yet</p>
                <p className="text-xs text-gray-600 max-w-xs">Upload your model and garment photos on the left, then click Generate.</p>
              </div>
            )}

            {!isLoading && !generatedImageUrl && modelImageUrl && (
              <img
                src={modelImageUrl}
                alt="Source preview"
                className="w-full h-full object-contain pointer-events-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
                  rotate: `${rotation}deg`,
                  transformOrigin: '0 0',
                }}
              />
            )}

            {!isLoading && generatedImageUrl && (
              <>
                <img
                  src={generatedImageUrl}
                  alt="Generated Result"
                  className="w-full h-full object-contain pointer-events-none"
                  style={{
                    transform: `translate(${position.x + swipeOffset}px, ${position.y}px) scale(${scale})`,
                    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
                    transition:
                      isDragging.current || isDraggingSlider.current || isTouchSwiping.current || isMouseSwiping.current
                        ? 'none'
                        : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    transformOrigin: '0 0',
                  }}
                />

                {/* Interactive Split Comparison */}
                {showComparison && modelImageUrl && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ clipPath: `polygon(0 0, ${comparisonSliderPos}% 0, ${comparisonSliderPos}% 100%, 0 100%)` }}
                  >
                    <img
                      src={modelImageUrl}
                      alt="Original Model"
                      className="w-full h-full object-contain pointer-events-none"
                      style={{
                        transform: `translate(${position.x + swipeOffset}px, ${position.y}px) scale(${scale})`,
                        transition:
                          isDragging.current || isDraggingSlider.current || isTouchSwiping.current || isMouseSwiping.current
                            ? 'none'
                            : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        transformOrigin: '0 0',
                        rotate: `${rotation}deg`,
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize pointer-events-auto flex items-center justify-center shadow-2xl"
                      style={{ left: `calc(${comparisonSliderPos}% - 2px)` }}
                      onMouseDown={handleSliderMouseDown}
                      onTouchStart={handleSliderMouseDown}
                    >
                      <div className="w-7 h-7 rounded-full bg-white text-black text-[10px] font-black flex items-center justify-center shadow-xl">
                        ↔
                      </div>
                    </div>
                  </div>
                )}

                {/* Generations Navigation & Badges */}
                {totalGenerations > 1 && (
                  <>
                    {/* Top Counter Badge */}
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-gray-700/60 text-white shadow-2xl pointer-events-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToPrevGeneration();
                        }}
                        disabled={!canNavigatePrev}
                        className="p-1 rounded-full hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-gray-300 hover:text-white"
                        title="Previous Generation (Swipe Right)"
                      >
                        <ChevronLeftIcon className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[9px] font-black tracking-widest uppercase text-indigo-400 px-1.5">
                        Gen {currentGenerationIndex + 1} / {totalGenerations}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToNextGeneration();
                        }}
                        disabled={!canNavigateNext}
                        className="p-1 rounded-full hover:bg-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-gray-300 hover:text-white"
                        title="Next Generation (Swipe Left)"
                      >
                        <ChevronRightIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Edge Buttons */}
                    {canNavigatePrev && scale <= 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToPrevGeneration();
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition-all opacity-60 hover:opacity-100 shadow-xl"
                        title="Previous Generation"
                      >
                        <ChevronLeftIcon className="w-4 h-4" />
                      </button>
                    )}
                    {canNavigateNext && scale <= 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToNextGeneration();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white flex items-center justify-center transition-all opacity-60 hover:opacity-100 shadow-xl"
                        title="Next Generation"
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    )}

                    {/* Swipe Gesture Live Indicator */}
                    {swipeOffset > 25 && canNavigatePrev && (
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full bg-indigo-600/90 text-white shadow-2xl backdrop-blur-md pointer-events-none">
                        <ChevronLeftIcon className="w-4 h-4 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Previous Generation</span>
                      </div>
                    )}
                    {swipeOffset < -25 && canNavigateNext && (
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2 px-3.5 py-2 rounded-full bg-indigo-600/90 text-white shadow-2xl backdrop-blur-md pointer-events-none">
                        <span className="text-[9px] font-black uppercase tracking-wider">Next Generation</span>
                        <ChevronRightIcon className="w-4 h-4 animate-pulse" />
                      </div>
                    )}

                    {/* On-canvas swipe instruction hint */}
                    {scale <= 1 && !showComparison && Math.abs(swipeOffset) < 10 && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/5 text-gray-400">
                        <svg className="w-3 h-3 text-indigo-400 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 16l-4-4m0 0l4-4m-4 4h18m-4 4l4-4m0 0l-4-4"/></svg>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Swipe to switch generations</span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-[#0c0e1a] border border-gray-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Share Result</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-400">Share your virtual try-on render across platforms or copy link:</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Check out my AI Virtual Try-On look!')}`);
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-bold text-gray-200 hover:text-white transition-all"
              >
                <TwitterIcon className="w-4 h-4 text-sky-400" />
                <span>Twitter / X</span>
              </button>
              <button
                onClick={() => {
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`);
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-bold text-gray-200 hover:text-white transition-all"
              >
                <FacebookIcon className="w-4 h-4 text-blue-500" />
                <span>Facebook</span>
              </button>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setStatusMessage('Link copied to clipboard!');
                setShowShareModal(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30 text-xs font-bold text-indigo-300 hover:text-white transition-all"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Copy Web App Link</span>
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-xl max-h-[80vh] rounded-3xl bg-[#0c0e1a] border border-gray-800 p-6 flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HistoryIcon className="w-4 h-4 text-indigo-400" />
                Saved Generations History
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {savedSessions.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-xs">
                  No saved generations found. Generate an image to see it here!
                </div>
              ) : (
                savedSessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-2xl bg-gray-900/60 border border-gray-800/80 flex items-center justify-between gap-4 hover:border-gray-700 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {session.generatedImageUrl ? (
                        <img
                          src={session.generatedImageUrl}
                          alt="Saved"
                          className="w-12 h-12 rounded-xl object-cover bg-black border border-gray-700/50"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-xs text-gray-500">
                          N/A
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-200">{session.name || 'Generation'}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(session.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreSession(session)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-bold border border-indigo-500/30 transition-all"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-1.5 rounded-xl bg-red-950/30 hover:bg-red-900/50 text-red-400 border border-red-800/30 transition-all"
                        title="Delete from history"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

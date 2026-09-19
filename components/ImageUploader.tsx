import React, { useRef, useState } from 'react';

interface ImageUploaderProps {
  title: string;
  description?: string;
  imageUrl: string | null;
  onImageSelect: (file: File) => void;
  onClear?: () => void;
  onRotate?: () => void;
  rotation?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  title,
  description,
  imageUrl,
  onImageSelect,
  onClear,
  onRotate,
  rotation = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageSelect(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageSelect(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</label>
        {imageUrl && (
          <div className="flex items-center gap-1.5">
            {onRotate && (
              <button
                type="button"
                onClick={onRotate}
                title="Rotate 90°"
                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-800/80 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                ↻ 90°
              </button>
            )}
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                title="Remove image"
                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative w-full aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden flex flex-col items-center justify-center p-4 text-center ${
          isDragging
            ? 'border-indigo-500 bg-indigo-950/20'
            : imageUrl
            ? 'border-gray-700/60 bg-[#0d0f18]'
            : 'border-gray-800 hover:border-gray-700 bg-[#090a12]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {imageUrl ? (
          <div className="w-full h-full flex items-center justify-center relative">
            <img
              src={imageUrl}
              alt={title}
              className="max-w-full max-h-full object-contain rounded-lg transition-transform duration-300"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-semibold text-white rounded-lg">
              Click to replace
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 text-gray-500">
            <div className="w-10 h-10 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-300">Click or drag & drop</p>
              {description && <p className="text-[11px] text-gray-500 mt-0.5">{description}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

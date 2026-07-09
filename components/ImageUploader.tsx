import React, { useState, useCallback } from 'react';
import { UploadIcon, TrashIcon, RotateIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  onImageRemove: () => void;
  onImageRotate: () => void;
  imageUrl: string | null;
  rotation: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, onImageRemove, onImageRotate, imageUrl, rotation }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };
  
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onImageUpload(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [onImageUpload]);

  if (imageUrl) {
    return (
      <div className="relative group w-full aspect-square bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 shadow-lg">
        <img 
          src={imageUrl} 
          alt="Uploaded preview" 
          className="w-full h-full object-contain transition-transform duration-300 ease-in-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onImageRotate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors transform hover:scale-105"
              aria-label="Rotate image"
            >
              <RotateIcon className="w-5 h-5" />
              Rotate
            </button>
            <button
              onClick={onImageRemove}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors transform hover:scale-105"
              aria-label="Remove image"
            >
              <TrashIcon className="w-5 h-5" />
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-full aspect-square border-2 border-dashed rounded-lg p-8 flex items-center justify-center text-center transition-all duration-300 ${
        isDragging 
          ? 'border-purple-500 bg-purple-900/20 scale-105 shadow-lg shadow-purple-500/20' 
          : 'border-gray-600 hover:border-purple-500'
      }`}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept="image/png, image/jpeg"
        onChange={handleFileChange}
      />
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center space-y-4 cursor-pointer">
        <UploadIcon className={`w-12 h-12 transition-colors duration-300 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
        <p className="text-lg font-medium text-gray-300">
          <span className="text-purple-400">Click to upload</span> or drag and drop
        </p>
        <p className="text-sm text-gray-500">PNG or JPG</p>
      </label>
    </div>
  );
};
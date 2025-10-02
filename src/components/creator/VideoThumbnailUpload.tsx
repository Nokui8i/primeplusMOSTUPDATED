'use client';

import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

interface VideoThumbnailUploadProps {
  onThumbnailChange: (file: File | null) => void;
  currentThumbnail?: string;
}

export default function VideoThumbnailUpload({ onThumbnailChange, currentThumbnail }: VideoThumbnailUploadProps) {
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(currentThumbnail || null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    onThumbnailChange(file);
  };

  const handleAreaClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Video Thumbnail</div>
      <div
        className={`group flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer select-none relative w-full max-w-lg mx-auto
          ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-blue-400 hover:bg-blue-500/5'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleAreaClick}
        tabIndex={0}
        role="button"
        aria-label="Upload or drag thumbnail image"
      >
        <input
          type="file"
          ref={inputRef}
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {thumbnailPreview ? (
          <div className="relative w-full max-w-2xl h-56 rounded-lg overflow-hidden border border-gray-800 shadow-md">
            <img
              src={thumbnailPreview}
              alt="Video thumbnail"
              className="w-full h-full object-contain bg-black"
              style={{ maxHeight: '14rem' }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload className="w-7 h-7 text-white mb-1" />
              <span className="text-xs text-white font-medium">Change Thumbnail</span>
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-12 h-12 text-blue-400 mb-1" />
            <span className="text-base text-gray-300 font-medium">Click or drag & drop</span>
            <span className="text-xs text-gray-400">Upload a thumbnail image</span>
          </>
        )}
      </div>
    </div>
  );
} 
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, X, Maximize2, Minimize2, ChevronUp, Pause, Play, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUpload } from '@/contexts/UploadContext';
import type { UploadTask } from '@/contexts/UploadContext';
import { formatBytes, formatTimeRemaining } from '@/utils/format';
import { PauseIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface UploadManagerProps {
  uploads: UploadTask[];
  onMinimize: () => void;
  onMaximize: () => void;
  isMinimized: boolean;
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
  onEdit: (id: string) => void;
  onUploadComplete: (task: UploadTask) => void;
  onUploadError: (error: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  maxConcurrentUploads?: number;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
}

export default function UploadManager({ 
  uploads, 
  onMinimize, 
  onMaximize, 
  isMinimized, 
  onCancel,
  onClearCompleted,
  onEdit,
  onUploadComplete,
  onUploadError,
  onPause,
  onResume,
  maxConcurrentUploads = 3,
  acceptedFileTypes = ['video/*', 'image/*'],
  maxFileSize = 10 * 1024 * 1024 * 1024, // 10GB
}: UploadManagerProps) {
  const [showHint, setShowHint] = useState(true);
  const [showRestoreButton, setShowRestoreButton] = useState(false);
  const activeUploads = uploads.filter(u => u.status === 'uploading');
  const completedUploads = uploads.filter(u => u.status === 'completed');
  const failedUploads = uploads.filter(u => u.status === 'error');
  const [dragActive, setDragActive] = useState(false);

  // Show hint for 10 seconds
  useEffect(() => {
    const hasSeenHint = localStorage.getItem('uploadHintSeen');
    if (!hasSeenHint && uploads.length > 0) {
      setShowHint(true);
      localStorage.setItem('uploadHintSeen', 'true');
      
      // Hide hint after 10 seconds
      const timer = setTimeout(() => setShowHint(false), 10000);
      return () => clearTimeout(timer);
    } else {
      setShowHint(false);
    }
  }, [uploads.length]);

  // Show/hide restore button when scrolling
  useEffect(() => {
    const handleScroll = () => {
      setShowRestoreButton(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const createUploadTask = useCallback((file: File): UploadTask => {
    return {
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      speed: 0,
      timeRemaining: '0s',
      status: 'uploading',
      isPaused: false
    };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        onUploadError(`File ${file.name} exceeds maximum size of ${formatBytes(maxFileSize)}`);
        return false;
      }
      if (!acceptedFileTypes.some(type => file.type.match(type))) {
        onUploadError(`File ${file.name} is not an accepted file type`);
        return false;
      }
      // MOV files will be automatically converted, so we allow them
      // No need to block MOV files anymore
      return true;
    });

    validFiles.forEach(file => {
      const task = createUploadTask(file);
      onUploadComplete(task);
    });
  }, [maxFileSize, acceptedFileTypes, onUploadError, createUploadTask, onUploadComplete]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const task = createUploadTask(file);
        onUploadComplete(task);
      });
    }
  }, [createUploadTask, onUploadComplete]);

  // Update the pause/resume button click handler
  const handlePauseResume = useCallback((upload: UploadTask) => {
    if (upload.isPaused) {
      onResume(upload.id);
    } else {
      onPause(upload.id);
    }
  }, [onPause, onResume]);

  if (uploads.length === 0) return null;

  // Restore button that appears when scrolling
  const RestoreButton = () => {
    if (!isMinimized || !showRestoreButton) return null;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed bottom-20 right-4 h-10 w-10 rounded-full bg-gray-900 border border-gray-800 shadow-lg hover:bg-gray-800 z-50"
              onClick={onMaximize}
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show uploads</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (isMinimized) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 w-[300px]">
            <div className="p-3 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm font-medium">
                  {activeUploads.length} upload{activeUploads.length !== 1 ? 's' : ''} in progress
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-gray-800"
                  onClick={onMaximize}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Show only the first active upload in minimized view */}
            {activeUploads[0] && (
              <div className="p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-gray-400 truncate flex-1">
                    {activeUploads[0].file.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`px-3 py-1 text-xs font-medium ${
                        activeUploads[0].isPaused 
                          ? 'text-green-500 hover:text-green-400' 
                          : 'text-yellow-500 hover:text-yellow-400'
                      }`}
                      onClick={() => handlePauseResume(activeUploads[0])}
                    >
                      {activeUploads[0].isPaused ? (
                        <div className="flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          <span>Resume</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Pause className="h-3 w-3" />
                          <span>Pause</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="relative w-full h-1 bg-gray-800 rounded-full mt-2">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                      activeUploads[0].isPaused
                        ? 'bg-yellow-500'
                        : 'bg-gradient-to-r from-blue-500 to-purple-600'
                    }`}
                    style={{ width: `${activeUploads[0].progress}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Show total progress */}
            <div className="px-3 pb-2 text-xs text-gray-400">
              {completedUploads.length} completed • {failedUploads.length} failed
            </div>
          </div>
        </div>
        <RestoreButton />
      </>
    );
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        {/* First-time user hint */}
        {showHint && (
          <div className="absolute bottom-full mb-4 right-0 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg text-sm animate-bounce">
            <p className="font-medium mb-1">Pro Tip! 💡</p>
            <p>You can minimize this window and continue using the platform while uploading.</p>
            <p className="mt-1 text-blue-200">Click anywhere to dismiss</p>
            <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-3 h-3 bg-blue-500" />
          </div>
        )}

        <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 w-[400px]">
          <div className="p-3 flex items-center justify-between border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Uploads</span>
            </div>
            <div className="flex items-center gap-1">
              {completedUploads.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs hover:bg-gray-800"
                  onClick={onClearCompleted}
                >
                  Clear completed
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-gray-800"
                onClick={onMinimize}
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="p-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 truncate text-sm">{upload.file.name}</div>
                  <div className="flex items-center gap-2">
                    {(upload.status === 'uploading' || upload.status === 'paused') && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`px-3 py-1 text-xs font-medium ${
                            upload.isPaused || upload.status === 'paused'
                              ? 'text-green-500 hover:text-green-400' 
                              : 'text-yellow-500 hover:text-yellow-400'
                          }`}
                          onClick={() => handlePauseResume(upload)}
                        >
                          {upload.isPaused || upload.status === 'paused' ? (
                            <div className="flex items-center gap-1">
                              <Play className="h-3 w-3" />
                              <span>Resume</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Pause className="h-3 w-3" />
                              <span>Pause</span>
                            </div>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-gray-700"
                          onClick={() => onCancel(upload.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {(upload.status === 'uploading' || upload.status === 'paused') && (
                  <>
                    <div className="relative w-full h-2 bg-gray-800 rounded-full">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-300 ${
                          upload.isPaused || upload.status === 'paused'
                            ? 'bg-yellow-500'
                            : 'bg-gradient-to-r from-blue-500 to-purple-600'
                        }`}
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>

                    <div className="flex justify-between mt-1 text-xs text-gray-400">
                      <div className="space-x-2">
                        <span>{upload.progress.toFixed(1)}%</span>
                        <span>•</span>
                        <span>
                          {upload.isPaused || upload.status === 'paused' 
                            ? 'Paused' 
                            : `${(upload.speed / (1024 * 1024)).toFixed(1)} MB/s`}
                        </span>
                      </div>
                      <span>
                        {upload.isPaused || upload.status === 'paused'
                          ? 'Paused'
                          : upload.timeRemaining}
                      </span>
                    </div>
                  </>
                )}

                {upload.status === 'completed' && (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-green-500">Completed</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full hover:bg-gray-700"
                      onClick={() => onCancel(upload.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {upload.status === 'error' && (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-red-500">Upload failed</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-full hover:bg-gray-700"
                      onClick={() => onCancel(upload.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
} 
import React from 'react';
import { ProgressBar } from './ProgressBar';
import { formatBytes, formatTimeRemaining } from '../../utils/format';

interface UploadProgressProps {
  fileName: string;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
  uploadSpeed: number;
  timeRemaining: number;
  onCancel?: () => void;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({
  fileName,
  progress,
  bytesUploaded,
  totalBytes,
  uploadSpeed,
  timeRemaining,
  onCancel,
}) => {
  return (
    <div className="w-full p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate" title={fileName}>
            {fileName}
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatBytes(bytesUploaded)} of {formatBytes(totalBytes)}
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="ml-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            aria-label="Cancel upload"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <ProgressBar progress={progress} className="mb-2" />

      <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{formatBytes(uploadSpeed)}/s</span>
        <span>{formatTimeRemaining(timeRemaining)} remaining</span>
      </div>
    </div>
  );
}; 
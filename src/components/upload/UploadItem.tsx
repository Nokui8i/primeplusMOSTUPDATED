import React from 'react';
import { UploadTask } from '@/contexts/UploadContext';
import { formatBytes } from '@/utils/formatBytes';
import { FaPlay, FaPause, FaTrash } from 'react-icons/fa';
import { MdError } from 'react-icons/md';
import { AiOutlineCheckCircle } from 'react-icons/ai';

interface UploadItemProps {
  upload: UploadTask;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

const UploadItem: React.FC<UploadItemProps> = ({ upload, onPause, onResume, onCancel }) => {
  const { id, file, progress, speed, timeRemaining, status, isPaused } = upload;

  const handlePauseResume = () => {
    if (isPaused) {
      onResume(id);
    } else {
      onPause(id);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'error':
        return <MdError className="text-red-500 text-xl" />;
      case 'completed':
        return <AiOutlineCheckCircle className="text-green-500 text-xl" />;
      default:
        return (
          <button
            onClick={handlePauseResume}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            disabled={(status as any) === 'completed' || (status as any) === 'error'}
          >
            {isPaused ? (
              <FaPlay className="text-blue-500" />
            ) : (
              <FaPause className="text-blue-500" />
            )}
          </button>
        );
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium truncate">{file.name}</span>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {(status as any) !== 'completed' && (status as any) !== 'error' && (
              <button
                onClick={() => onCancel(id)}
                className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <FaTrash className="text-red-500" />
              </button>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
          <div
            className={`h-2 rounded-full ${
              (status as any) === 'error'
                ? 'bg-red-500'
                : (status as any) === 'completed'
                ? 'bg-green-500'
                : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            {(status as any) === 'error' ? (
              <span className="text-red-500">{upload.error}</span>
            ) : (status as any) === 'completed' ? (
              'Upload complete'
            ) : (
              <>
                {formatBytes(speed)}/s • {timeRemaining}
              </>
            )}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
};

export default UploadItem; 
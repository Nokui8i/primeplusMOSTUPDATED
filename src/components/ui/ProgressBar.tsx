import React from 'react';

interface ProgressBarProps {
  progress: number;
  showPercentage?: boolean;
  height?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showPercentage = true,
  height = 'h-2',
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-gray-200 rounded-full dark:bg-gray-700 ${height}`}>
        <div
          className="bg-blue-600 rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: `${percentage}%`,
            height: '100%',
          }}
        />
      </div>
      {showPercentage && (
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
}; 
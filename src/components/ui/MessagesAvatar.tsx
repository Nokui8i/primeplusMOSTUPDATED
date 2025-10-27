import React from 'react';
import { cn } from '@/lib/utils';

interface MessagesAvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: { width: '40px', height: '40px' },
  md: { width: '52px', height: '52px' }, 
  lg: { width: '60px', height: '60px' }
};

export function MessagesAvatar({ 
  src, 
  alt = 'Avatar', 
  fallback = 'U', 
  size = 'md',
  className 
}: MessagesAvatarProps) {
  const dimensions = sizeClasses[size];
  
  return (
    <div 
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        'flex-shrink-0',
        className
      )}
      style={{
        borderRadius: '50%',
        width: dimensions.width,
        height: dimensions.height,
        minWidth: dimensions.width,
        minHeight: dimensions.height,
        maxWidth: dimensions.width,
        maxHeight: dimensions.height,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{
            borderRadius: '50%',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
      ) : (
        <div 
          className="bg-blue-600 text-white font-medium flex items-center justify-center"
          style={{
            borderRadius: '50%',
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            fontSize: size === 'sm' ? '10px' : size === 'md' ? '12px' : '14px'
          }}
        >
          {fallback[0]?.toUpperCase() || 'U'}
        </div>
      )}
    </div>
  );
}

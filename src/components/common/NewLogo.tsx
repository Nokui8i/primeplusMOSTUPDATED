import React from 'react';

interface NewLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export default function NewLogo({ 
  size = 'md', 
  showText = true, 
  className = '' 
}: NewLogoProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-80 h-80'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  };

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Logo Icon - Real Logo Image */}
      <div className={`${sizeClasses[size]} relative`}>
        <img 
          src="/images/ChatGPT Image Sep 26, 2025, 04_01_20 PM.png" 
          alt="PrimePlus+" 
          className="w-full h-full object-contain"
          style={{ 
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Logo Text - Hidden since we have the logo image */}
      {false && showText && (
        <div className={`${textSizeClasses[size]} font-bold text-gray-800 tracking-wide`}>
          PrimePlus<span className="text-blue-600">+</span>
        </div>
      )}
    </div>
  );
}

import React from 'react';

interface NewLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
  showText?: boolean;
  className?: string;
}

export default function NewLogo({ 
  size = 'md', 
  showText = true, 
  className = '' 
}: NewLogoProps) {
  console.log('🎨 NewLogo rendering:', { size, showText, className })
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
    xl: 'w-32 h-32',
    xxl: 'w-48 h-48',
    xxxl: 'w-80 h-80'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
    xxl: 'text-5xl',
    xxxl: 'text-6xl'
  };

  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {/* Logo Icon - Real Logo Image */}
      <div className={`${sizeClasses[size]} relative bg-transparent p-0 m-0`}>
        <img 
          src="/images/ChatGPT Image Sep 26, 2025, 04_01_20 PM.png" 
          alt="PrimePlus+" 
          className="w-full h-full object-contain"
          style={{ 
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            backgroundColor: 'transparent',
            imageRendering: 'crisp-edges',
            filter: 'drop-shadow(0 0 1px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.6))'
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

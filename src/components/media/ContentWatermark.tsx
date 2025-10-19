'use client';

import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';

interface ContentWatermarkProps {
  username: string;
  className?: string;
}

export function ContentWatermark({ username, className = '' }: ContentWatermarkProps) {
  const [profileUrl, setProfileUrl] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    let url = `${window.location.origin}/${username}`;
    url = url.replace(/^https?:\/\//, '');
    setProfileUrl(url);
  }, [username]);

  return (
    <div 
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      style={{ zIndex: 10 }}
    >
      <div 
        className="absolute bottom-2 right-2 text-white text-sm font-medium opacity-80"
        style={{
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          fontFamily: 'inherit',
          letterSpacing: '0.01em',
          padding: '4px 8px',
          margin: 0,
          zIndex: 11,
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: '4px',
          fontSize: 'clamp(10px, 2vw, 14px)',
          maxWidth: '90%',
          wordBreak: 'break-all'
        }}
      >
        {profileUrl}
      </div>
    </div>
  );
} 
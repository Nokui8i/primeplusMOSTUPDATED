'use client';

import { useAuth } from '@/lib/firebase/auth';
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
        className="absolute bottom-3 right-3 text-white text-base font-medium opacity-70"
        style={{
          textShadow: '0 1px 2px rgba(0,0,0,0.25)',
          fontFamily: 'inherit',
          letterSpacing: '0.01em',
          padding: 0,
          margin: 0,
          zIndex: 11,
        }}
      >
        {profileUrl}
      </div>
    </div>
  );
} 
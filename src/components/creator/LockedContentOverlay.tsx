import React from 'react';
import { FiLock } from 'react-icons/fi';

interface LockedContentOverlayProps {
  thumbnail?: string;
  onShowPlans: () => void;
  children?: React.ReactNode;
}

export default function LockedContentOverlay({ thumbnail, onShowPlans, children }: LockedContentOverlayProps) {
  return (
    <div className="relative group cursor-pointer" onClick={onShowPlans}>
      {thumbnail ? (
        <img src={thumbnail} alt="Locked content" className="w-full h-full object-cover rounded" />
      ) : (
        <div className="w-full h-full rounded overflow-hidden">
          <div className="blur-sm opacity-70 pointer-events-none select-none">
            {children}
          </div>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-gray-400/60 rounded-full p-3 flex items-center justify-center">
          <FiLock className="w-8 h-8 text-[#6437ff] drop-shadow" />
        </div>
      </div>
    </div>
  );
} 
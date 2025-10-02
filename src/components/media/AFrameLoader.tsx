import React from 'react';

export interface AFrameLoaderProps {
  children: React.ReactNode;
}

const AFrameLoader: React.FC<AFrameLoaderProps> = ({ children }) => {
  return (
    <div className="aframe-loader relative w-full h-full min-h-[400px] bg-gray-900 rounded-lg overflow-hidden">
      {children}
    </div>
  );
};

export default AFrameLoader; 
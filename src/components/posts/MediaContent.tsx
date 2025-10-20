import React from 'react';

interface MediaContentProps {
  url: string;
  type: string;
  thumbnailUrl?: string;
  compact?: boolean;
  username?: string;
  showWatermark?: boolean;
  hotspots?: Array<{
    position: string;
    content: string;
    id: string;
  }>;
}

const MediaContent: React.FC<MediaContentProps> = ({
  url,
  type,
  thumbnailUrl,
  compact = false,
  username,
  showWatermark = false,
  hotspots = []
}) => {
  if (type === 'image' || type === 'image360') {
    return (
      <div className="relative w-full h-full">
        <img
          src={url}
          alt="Post content"
          className={`w-full h-full object-cover ${compact ? 'rounded-lg' : 'rounded-xl'}`}
          draggable="false"
        />
        {type === 'image360' && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            360°
          </div>
        )}
        {showWatermark && username && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            @{username}
          </div>
        )}
      </div>
    );
  }

  if (type === 'video' || type === 'video360') {
    return (
      <div className="relative w-full h-full">
        <video
          src={url}
          className={`w-full h-full object-cover ${compact ? 'rounded-lg' : 'rounded-xl'}`}
          preload="metadata"
          muted
          controls
        />
        {type === 'video360' && (
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            360°
          </div>
        )}
        {showWatermark && username && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium backdrop-blur-sm">
            @{username}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default MediaContent;

import React, { useEffect, useState } from 'react';
import { StreamQualityMonitor } from '@/lib/streaming/quality-monitor';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface StreamQualityIndicatorProps {
  qualityMonitor: StreamQualityMonitor;
  stream: MediaStream;
}

export function StreamQualityIndicator({ qualityMonitor, stream }: StreamQualityIndicatorProps) {
  const [metrics, setMetrics] = useState(qualityMonitor.getMetrics());
  const [currentPreset, setCurrentPreset] = useState(qualityMonitor.getCurrentPreset());
  const [isQualityVerified, setIsQualityVerified] = useState(false);

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const newMetrics = qualityMonitor.getMetrics();
      const newPreset = qualityMonitor.getCurrentPreset();
      setMetrics(newMetrics);
      setCurrentPreset(newPreset);

      // Verify if actual quality matches selected quality
      const actualWidth = newMetrics.resolution.width;
      const actualHeight = newMetrics.resolution.height;
      const targetWidth = newPreset.width;
      const targetHeight = newPreset.height;

      // Allow for small variations (within 5%)
      const widthMatch = Math.abs(actualWidth - targetWidth) / targetWidth <= 0.05;
      const heightMatch = Math.abs(actualHeight - targetHeight) / targetHeight <= 0.05;
      const bitrateMatch = newMetrics.bitrate >= newPreset.minBitrate;

      setIsQualityVerified(widthMatch && heightMatch && bitrateMatch);
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [qualityMonitor]);

  const getQualityStatusColor = () => {
    if (isQualityVerified) return 'text-green-500';
    if (metrics.networkQuality === 'poor') return 'text-red-500';
    return 'text-yellow-500';
  };

  const getQualityStatusIcon = () => {
    if (isQualityVerified) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (metrics.networkQuality === 'poor') return <XCircle className="w-5 h-5 text-red-500" />;
    return <AlertCircle className="w-5 h-5 text-yellow-500" />;
  };

  return (
    <Card className="p-4 bg-gray-900/50 backdrop-blur-sm border border-gray-800">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Stream Quality</h3>
          <div className="flex items-center gap-2">
            {getQualityStatusIcon()}
            <span className={`text-sm font-medium ${getQualityStatusColor()}`}>
              {currentPreset.name.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Resolution</span>
            <span>{metrics.resolution.width}x{metrics.resolution.height}</span>
          </div>
          <Progress 
            value={(metrics.resolution.width * metrics.resolution.height) / (currentPreset.width * currentPreset.height) * 100} 
            className="h-1"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Bitrate</span>
            <span>{(metrics.bitrate / 1000000).toFixed(1)} Mbps</span>
          </div>
          <Progress 
            value={(metrics.bitrate / currentPreset.targetBitrate) * 100} 
            className="h-1"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>FPS</span>
            <span>{metrics.fps.toFixed(1)}</span>
          </div>
          <Progress value={(metrics.fps / 60) * 100} className="h-1" />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>Network Quality</span>
            <span className="capitalize">{metrics.networkQuality}</span>
          </div>
          <Progress 
            value={
              metrics.networkQuality === 'excellent' ? 100 :
              metrics.networkQuality === 'good' ? 75 :
              metrics.networkQuality === 'fair' ? 50 : 25
            } 
            className="h-1"
          />
        </div>

        {!isQualityVerified && (
          <div className="text-xs text-yellow-500 bg-yellow-500/10 p-2 rounded">
            Current quality doesn't match selected preset. This might be due to:
            <ul className="list-disc list-inside mt-1">
              <li>Network limitations</li>
              <li>Device capabilities</li>
              <li>Browser restrictions</li>
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
} 
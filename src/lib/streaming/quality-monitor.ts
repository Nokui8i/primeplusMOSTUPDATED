import { toast } from 'sonner';

interface StreamQualityMetrics {
  bitrate: number;
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  bufferHealth: number;
}

interface QualityPreset {
  name: '4k' | '2k' | '1080p' | '720p' | '480p';
  width: number;
  height: number;
  minBitrate: number;
  targetBitrate: number;
  maxBitrate: number;
}

const QUALITY_PRESETS: Record<QualityPreset['name'], QualityPreset> = {
  '4k': {
    name: '4k',
    width: 3840,
    height: 2160,
    minBitrate: 15000000, // 15 Mbps
    targetBitrate: 20000000, // 20 Mbps
    maxBitrate: 25000000, // 25 Mbps
  },
  '2k': {
    name: '2k',
    width: 2560,
    height: 1440,
    minBitrate: 8000000, // 8 Mbps
    targetBitrate: 10000000, // 10 Mbps
    maxBitrate: 15000000, // 15 Mbps
  },
  '1080p': {
    name: '1080p',
    width: 1920,
    height: 1080,
    minBitrate: 4000000, // 4 Mbps
    targetBitrate: 6000000, // 6 Mbps
    maxBitrate: 8000000, // 8 Mbps
  },
  '720p': {
    name: '720p',
    width: 1280,
    height: 720,
    minBitrate: 2000000, // 2 Mbps
    targetBitrate: 3000000, // 3 Mbps
    maxBitrate: 4000000, // 4 Mbps
  },
  '480p': {
    name: '480p',
    width: 854,
    height: 480,
    minBitrate: 1000000, // 1 Mbps
    targetBitrate: 1500000, // 1.5 Mbps
    maxBitrate: 2000000, // 2 Mbps
  },
};

export class StreamQualityMonitor {
  private metrics: StreamQualityMetrics;
  private currentPreset: QualityPreset;
  private onQualityChange: (preset: QualityPreset) => void;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    initialPreset: QualityPreset['name'],
    onQualityChange: (preset: QualityPreset) => void
  ) {
    this.currentPreset = QUALITY_PRESETS[initialPreset];
    this.onQualityChange = onQualityChange;
    this.metrics = {
      bitrate: 0,
      fps: 0,
      resolution: {
        width: this.currentPreset.width,
        height: this.currentPreset.height,
      },
      networkQuality: 'good',
      bufferHealth: 100,
    };
  }

  startMonitoring(stream: MediaStream) {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.updateMetrics(stream);
      this.adjustQuality();
    }, 2000); // Check every 2 seconds
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private updateMetrics(stream: MediaStream) {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    this.metrics.fps = settings.frameRate || 0;
    this.metrics.resolution = {
      width: settings.width || 0,
      height: settings.height || 0,
    };

    // Calculate current bitrate
    this.calculateBitrate(stream);

    // Update network quality
    this.updateNetworkQuality();

    // Update buffer health
    this.updateBufferHealth();
  }

  private calculateBitrate(stream: MediaStream) {
    // Implementation would depend on the streaming service
    // This is a placeholder for actual bitrate calculation
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Example calculation (simplified)
    const settings = videoTrack.getSettings();
    const frameSize = (settings.width || 0) * (settings.height || 0) * 1.5; // Rough estimate
    this.metrics.bitrate = frameSize * (settings.frameRate || 0);
  }

  private updateNetworkQuality() {
    // Implementation would depend on network conditions
    // This is a placeholder for actual network quality assessment
    const bitrate = this.metrics.bitrate;
    const targetBitrate = this.currentPreset.targetBitrate;

    if (bitrate >= targetBitrate * 0.9) {
      this.metrics.networkQuality = 'excellent';
    } else if (bitrate >= targetBitrate * 0.7) {
      this.metrics.networkQuality = 'good';
    } else if (bitrate >= targetBitrate * 0.5) {
      this.metrics.networkQuality = 'fair';
    } else {
      this.metrics.networkQuality = 'poor';
    }
  }

  private updateBufferHealth() {
    // Implementation would depend on the streaming service
    // This is a placeholder for actual buffer health calculation
    this.metrics.bufferHealth = 100; // Placeholder
  }

  private adjustQuality() {
    const { bitrate, networkQuality, bufferHealth } = this.metrics;
    const currentPreset = this.currentPreset;

    // Determine if we need to adjust quality
    if (networkQuality === 'poor' || bufferHealth < 50) {
      // Downgrade quality
      this.downgradeQuality();
    } else if (networkQuality === 'excellent' && bufferHealth > 90) {
      // Upgrade quality
      this.upgradeQuality();
    }
  }

  private downgradeQuality() {
    const presets: QualityPreset['name'][] = ['4k', '2k', '1080p', '720p', '480p'];
    const currentIndex = presets.indexOf(this.currentPreset.name);
    
    if (currentIndex < presets.length - 1) {
      const newPreset = QUALITY_PRESETS[presets[currentIndex + 1]];
      this.setQualityPreset(newPreset);
      toast.warning(`Stream quality reduced to ${newPreset.name} due to network conditions`);
    }
  }

  private upgradeQuality() {
    const presets: QualityPreset['name'][] = ['4k', '2k', '1080p', '720p', '480p'];
    const currentIndex = presets.indexOf(this.currentPreset.name);
    
    if (currentIndex > 0) {
      const newPreset = QUALITY_PRESETS[presets[currentIndex - 1]];
      this.setQualityPreset(newPreset);
      toast.success(`Stream quality increased to ${newPreset.name}`);
    }
  }

  private setQualityPreset(preset: QualityPreset) {
    this.currentPreset = preset;
    this.onQualityChange(preset);
  }

  getMetrics(): StreamQualityMetrics {
    return { ...this.metrics };
  }

  getCurrentPreset(): QualityPreset {
    return { ...this.currentPreset };
  }
} 
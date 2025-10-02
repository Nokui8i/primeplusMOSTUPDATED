import { toast } from 'sonner';

interface NetworkMetrics {
  bandwidth: number;      // in Mbps
  latency: number;        // in ms
  packetLoss: number;     // percentage
  jitter: number;         // in ms
}

interface QualityPreset {
  name: '4k' | '2k' | '1080p' | '720p' | '480p';
  resolution: {
    width: number;
    height: number;
  };
  bitrate: {
    min: number;  // in Mbps
    target: number;
    max: number;
  };
  fps: {
    min: number;
    target: number;
    max: number;
  };
}

export class AdaptiveBitrateManager {
  private currentPreset: QualityPreset;
  private networkMetrics: NetworkMetrics;
  private qualityPresets: QualityPreset[];
  private onQualityChange: (preset: QualityPreset) => void;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(onQualityChange: (preset: QualityPreset) => void) {
    this.onQualityChange = onQualityChange;
    this.networkMetrics = {
      bandwidth: 0,
      latency: 0,
      packetLoss: 0,
      jitter: 0
    };

    // Define quality presets
    this.qualityPresets = [
      {
        name: '4k',
        resolution: { width: 3840, height: 2160 },
        bitrate: { min: 15, target: 20, max: 25 },
        fps: { min: 24, target: 30, max: 60 }
      },
      {
        name: '2k',
        resolution: { width: 2560, height: 1440 },
        bitrate: { min: 8, target: 12, max: 15 },
        fps: { min: 24, target: 30, max: 60 }
      },
      {
        name: '1080p',
        resolution: { width: 1920, height: 1080 },
        bitrate: { min: 4, target: 6, max: 8 },
        fps: { min: 24, target: 30, max: 60 }
      },
      {
        name: '720p',
        resolution: { width: 1280, height: 720 },
        bitrate: { min: 2, target: 3, max: 4 },
        fps: { min: 24, target: 30, max: 60 }
      },
      {
        name: '480p',
        resolution: { width: 854, height: 480 },
        bitrate: { min: 1, target: 1.5, max: 2 },
        fps: { min: 24, target: 30, max: 60 }
      }
    ];

    // Start with 1080p as default
    this.currentPreset = this.qualityPresets[2];
  }

  startMonitoring(mediaElement: HTMLMediaElement) {
    if (this.checkInterval) return;

    // Check network conditions every 2 seconds
    this.checkInterval = setInterval(() => {
      this.updateNetworkMetrics(mediaElement);
      this.optimizeQuality();
    }, 2000);
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async updateNetworkMetrics(mediaElement: HTMLMediaElement) {
    try {
      // Get network information from the media element
      const stats = await this.getNetworkStats(mediaElement);
      
      this.networkMetrics = {
        bandwidth: stats.bandwidth,
        latency: stats.latency,
        packetLoss: stats.packetLoss,
        jitter: stats.jitter
      };

      // Log network issues
      if (this.networkMetrics.packetLoss > 5) {
        console.warn('High packet loss detected:', this.networkMetrics.packetLoss + '%');
      }
      if (this.networkMetrics.latency > 1000) {
        console.warn('High latency detected:', this.networkMetrics.latency + 'ms');
      }
    } catch (error) {
      console.error('Error updating network metrics:', error);
    }
  }

  private async getNetworkStats(mediaElement: HTMLMediaElement) {
    // This is a simplified version. In a real implementation,
    // you would use WebRTC stats or other network monitoring APIs
    return {
      bandwidth: await this.estimateBandwidth(),
      latency: await this.measureLatency(),
      packetLoss: await this.measurePacketLoss(),
      jitter: await this.measureJitter()
    };
  }

  private async estimateBandwidth(): Promise<number> {
    // Simulate bandwidth estimation
    // In a real implementation, use WebRTC stats or other methods
    return Math.random() * 20 + 5; // Random value between 5-25 Mbps
  }

  private async measureLatency(): Promise<number> {
    // Simulate latency measurement
    return Math.random() * 100 + 50; // Random value between 50-150ms
  }

  private async measurePacketLoss(): Promise<number> {
    // Simulate packet loss measurement
    return Math.random() * 5; // Random value between 0-5%
  }

  private async measureJitter(): Promise<number> {
    // Simulate jitter measurement
    return Math.random() * 20 + 5; // Random value between 5-25ms
  }

  private optimizeQuality() {
    const { bandwidth, latency, packetLoss } = this.networkMetrics;
    const currentIndex = this.qualityPresets.findIndex(p => p.name === this.currentPreset.name);
    
    // Determine if we should switch quality
    let shouldDowngrade = false;
    let shouldUpgrade = false;

    // Check if current quality is sustainable
    if (bandwidth < this.currentPreset.bitrate.min || 
        latency > 1000 || 
        packetLoss > 5) {
      shouldDowngrade = true;
    }
    // Check if we can upgrade
    else if (bandwidth > this.currentPreset.bitrate.max * 1.2 && 
             latency < 500 && 
             packetLoss < 1) {
      shouldUpgrade = true;
    }

    // Apply quality changes
    if (shouldDowngrade && currentIndex < this.qualityPresets.length - 1) {
      this.setQuality(this.qualityPresets[currentIndex + 1]);
    } else if (shouldUpgrade && currentIndex > 0) {
      this.setQuality(this.qualityPresets[currentIndex - 1]);
    }
  }

  private setQuality(preset: QualityPreset) {
    if (preset.name === this.currentPreset.name) return;

    this.currentPreset = preset;
    this.onQualityChange(preset);

    // Notify user of quality change
    toast.info(`Stream quality adjusted to ${preset.name.toUpperCase()}`);
  }

  getCurrentPreset(): QualityPreset {
    return { ...this.currentPreset };
  }

  getNetworkMetrics(): NetworkMetrics {
    return { ...this.networkMetrics };
  }
} 
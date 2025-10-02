import { toast } from 'sonner';

interface BufferMetrics {
  bufferSize: number;
  bufferHealth: number;
  bufferLatency: number;
  droppedFrames: number;
  bufferUnderruns: number;
}

interface BufferConfig {
  minBufferSize: number;
  maxBufferSize: number;
  targetLatency: number;
  healthThreshold: number;
}

export class StreamBufferManager {
  private metrics: BufferMetrics;
  private config: BufferConfig;
  private bufferHealthCheckInterval: NodeJS.Timeout | null = null;
  private onBufferHealthChange: (health: number) => void;

  constructor(
    onBufferHealthChange: (health: number) => void,
    config: Partial<BufferConfig> = {}
  ) {
    this.onBufferHealthChange = onBufferHealthChange;
    this.config = {
      minBufferSize: 2, // seconds
      maxBufferSize: 10, // seconds
      targetLatency: 2, // seconds
      healthThreshold: 0.8, // 80%
      ...config
    };

    this.metrics = {
      bufferSize: this.config.minBufferSize,
      bufferHealth: 100,
      bufferLatency: 0,
      droppedFrames: 0,
      bufferUnderruns: 0
    };
  }

  startMonitoring(mediaElement: HTMLMediaElement) {
    if (this.bufferHealthCheckInterval) return;

    // Monitor buffer health
    this.bufferHealthCheckInterval = setInterval(() => {
      this.updateBufferMetrics(mediaElement);
      this.optimizeBufferSize();
    }, 1000);

    // Add event listeners for buffer events
    mediaElement.addEventListener('waiting', () => this.handleBufferUnderrun());
    mediaElement.addEventListener('stalled', () => this.handleBufferStall());
    mediaElement.addEventListener('canplay', () => this.handleBufferReady());
  }

  stopMonitoring(mediaElement: HTMLMediaElement) {
    if (this.bufferHealthCheckInterval) {
      clearInterval(this.bufferHealthCheckInterval);
      this.bufferHealthCheckInterval = null;
    }

    // Remove event listeners
    mediaElement.removeEventListener('waiting', () => this.handleBufferUnderrun());
    mediaElement.removeEventListener('stalled', () => this.handleBufferStall());
    mediaElement.removeEventListener('canplay', () => this.handleBufferReady());
  }

  private updateBufferMetrics(mediaElement: HTMLMediaElement) {
    if (!mediaElement.buffered.length) return;

    const currentTime = mediaElement.currentTime;
    const bufferedEnd = mediaElement.buffered.end(mediaElement.buffered.length - 1);
    const bufferSize = bufferedEnd - currentTime;

    this.metrics.bufferSize = bufferSize;
    this.metrics.bufferLatency = currentTime - mediaElement.buffered.start(0);

    // Calculate buffer health
    const healthScore = this.calculateBufferHealth();
    this.metrics.bufferHealth = healthScore;
    this.onBufferHealthChange(healthScore);

    // Log buffer issues
    if (healthScore < this.config.healthThreshold * 100) {
      console.warn('Buffer health below threshold:', healthScore);
    }
  }

  private calculateBufferHealth(): number {
    const { bufferSize, bufferLatency, droppedFrames, bufferUnderruns } = this.metrics;
    const { minBufferSize, maxBufferSize, targetLatency } = this.config;

    // Calculate individual health scores
    const sizeScore = Math.min(100, (bufferSize / maxBufferSize) * 100);
    const latencyScore = Math.max(0, 100 - (bufferLatency / targetLatency) * 100);
    const stabilityScore = Math.max(0, 100 - (droppedFrames + bufferUnderruns) * 10);

    // Weight the scores
    return (sizeScore * 0.4 + latencyScore * 0.4 + stabilityScore * 0.2);
  }

  private optimizeBufferSize() {
    const { bufferHealth, bufferSize } = this.metrics;
    const { minBufferSize, maxBufferSize } = this.config;

    if (bufferHealth < 50) {
      // Increase buffer size if health is poor
      const newSize = Math.min(maxBufferSize, bufferSize * 1.2);
      this.setBufferSize(newSize);
      toast.warning('Increasing buffer size to improve stability');
    } else if (bufferHealth > 90 && bufferSize > minBufferSize) {
      // Decrease buffer size if health is excellent
      const newSize = Math.max(minBufferSize, bufferSize * 0.9);
      this.setBufferSize(newSize);
    }
  }

  private setBufferSize(size: number) {
    this.metrics.bufferSize = size;
  }

  private handleBufferUnderrun() {
    this.metrics.bufferUnderruns++;
    toast.error('Stream buffer underrun detected');
  }

  private handleBufferStall() {
    toast.warning('Stream buffer stalled');
  }

  private handleBufferReady() {
    if (this.metrics.bufferHealth < 50) {
      toast.success('Stream buffer recovered');
    }
  }

  getMetrics(): BufferMetrics {
    return { ...this.metrics };
  }

  getConfig(): BufferConfig {
    return { ...this.config };
  }
} 
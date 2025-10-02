import { SignalingServer } from './signaling';

interface PeerConfig {
  streamId: string;
  userId: string;
  isBroadcaster: boolean;
  onStream?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
}

export class PeerConnection {
  private peerConnection: RTCPeerConnection;
  private signalingServer: SignalingServer;
  private isBroadcaster: boolean;
  private onStream?: (stream: MediaStream) => void;
  private onError?: (error: Error) => void;

  constructor(config: PeerConfig) {
    this.isBroadcaster = config.isBroadcaster;
    this.onStream = config.onStream;
    this.onError = config.onError;

    // Initialize WebRTC configuration
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    });

    // Initialize signaling server
    this.signalingServer = new SignalingServer(config.streamId, config.userId);

    // Set up event handlers
    this.setupPeerConnectionHandlers();
    this.setupSignalingHandlers();
  }

  private setupPeerConnectionHandlers() {
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingServer.sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
          to: this.isBroadcaster ? 'viewer' : 'broadcaster'
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };

    // Handle incoming tracks
    this.peerConnection.ontrack = (event) => {
      if (this.onStream && event.streams[0]) {
        this.onStream(event.streams[0]);
      }
    };
  }

  private setupSignalingHandlers() {
    this.signalingServer.onSignalingMessage(async (data) => {
      try {
        switch (data.type) {
          case 'offer':
            if (!this.isBroadcaster && data.sdp) {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
              const answer = await this.peerConnection.createAnswer();
              await this.peerConnection.setLocalDescription(answer);
              await this.signalingServer.sendSignalingMessage({
                type: 'answer',
                sdp: answer,
                to: 'broadcaster'
              });
            }
            break;

          case 'answer':
            if (this.isBroadcaster && data.sdp) {
              await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
            break;

          case 'ice-candidate':
            if (data.candidate) {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            break;
        }
      } catch (error) {
        console.error('Error handling signaling message:', error);
        this.onError?.(error as Error);
      }
    });
  }

  // Start broadcasting
  async startBroadcasting(stream: MediaStream) {
    if (!this.isBroadcaster) {
      throw new Error('Only broadcaster can start broadcasting');
    }

    try {
      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      await this.signalingServer.sendSignalingMessage({
        type: 'offer',
        sdp: offer,
        to: 'viewer'
      });
    } catch (error) {
      console.error('Error starting broadcast:', error);
      this.onError?.(error as Error);
    }
  }

  // Clean up resources
  async cleanup() {
    this.peerConnection.close();
    await this.signalingServer.cleanup();
  }
} 
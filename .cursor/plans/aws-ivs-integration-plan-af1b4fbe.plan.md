<!-- af1b4fbe-1378-4db6-bbba-d2e8c11c5f9a 3809ec42-ebc5-4171-ad3d-464f411652c8 -->
# AWS IVS Live Streaming Integration Plan

## Overview

Transform the platform from expensive LiveKit WebRTC (per-viewer cost) to AWS IVS broadcast (per-stream cost) for OnlyFans-style streaming: one creator broadcasting to many viewers. This will reduce streaming costs from ~$500/stream to ~$100-150/stream.

## Phase 1: Restore Tip System Infrastructure

### 1.1 Restore Deleted Files

Recreate the tip system foundation that was deleted:

- `src/types/tip.ts` - Tip type definitions (id, creatorId, tipperId, amount, currency, status, etc.)
- `src/lib/services/tip.service.ts` - Tip business logic (createTip, getCreatorTips, updateTipStatus, getCreatorEarnings)

**Note**: These will be non-functional without payment gateway but provide the structure for future integration.

### 1.2 Update Documentation

Mark tip system as "infrastructure only" in `MONETIZATION_PROGRESS.md`:

- Tip System: Infrastructure ready, awaiting payment gateway integration
- Note that 85/15 revenue split is defined but not processing actual payments

## Phase 2: AWS IVS Infrastructure Setup

### 2.1 Install AWS SDK Dependencies

Add to `package.json`:

```json
"@aws-sdk/client-ivs": "^3.x.x",
"@aws-sdk/client-ivs-realtime": "^3.x.x"
```

### 2.2 Create AWS IVS Service Layer

Create `src/lib/streaming/aws-ivs.service.ts`:

- `createIVSChannel()` - Creates AWS IVS channel for a creator
- `getStreamKey()` - Retrieves RTMP ingest credentials
- `getPlaybackUrl()` - Gets HLS playback URL for viewers
- `deleteChannel()` - Cleanup after stream ends
- `startRecording()` - Enable auto-recording to S3
- `stopRecording()` - Stop recording

### 2.3 Create AWS IVS Configuration

Create `src/lib/streaming/aws-ivs-config.ts`:

```typescript
export const AWS_IVS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  recordingEnabled: true,
  recordingS3Bucket: process.env.AWS_S3_BUCKET_RECORDINGS,
  latencyMode: 'LOW', // 3-5 second latency
  type: 'STANDARD' // vs BASIC
};
```

### 2.4 Environment Variables

Add to `.env.local`:

```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET_RECORDINGS=primeplus-stream-recordings
```

## Phase 3: Backend API Routes

### 3.1 Create IVS Channel Management API

Create `src/app/api/streaming/ivs/channel/route.ts`:

- POST - Creates new IVS channel when user starts stream
- GET - Retrieves channel info and playback URL
- DELETE - Removes channel when stream ends

### 3.2 Create Stream Key API

Create `src/app/api/streaming/ivs/stream-key/route.ts`:

- GET - Returns RTMP ingest URL and stream key for OBS/broadcaster

### 3.3 Create Playback URL API  

Create `src/app/api/streaming/ivs/playback/[streamId]/route.ts`:

- GET - Returns HLS playback URL for viewers

## Phase 4: Frontend Components

### 4.1 Create AWS IVS Broadcaster Component

Create `src/components/live/IVSBroadcaster.tsx`:

- Instructions for OBS/streaming software setup
- Display RTMP URL and stream key
- Stream status monitoring
- Viewer count display

### 4.2 Create AWS IVS Viewer Component

Create `src/components/live/IVSViewer.tsx`:

- HLS video player using `hls.js` (already installed)
- Playback controls
- Quality selector
- Viewer chat integration (existing Firebase chat)

### 4.3 Update LiveStreamDialog

Modify `src/components/live/LiveStreamDialog.tsx`:

- Add streaming method selector: "Browser (Simple)" vs "Professional (OBS)"
- Browser method uses existing LiveKit for small streams
- OBS method creates IVS channel and shows setup instructions

### 4.4 Update Stream Type Logic

Modify `src/lib/streaming/client.ts`:

- Add `streamType: 'webrtc' | 'ivs'` parameter
- Route to appropriate streaming method based on type

## Phase 5: Database Schema Updates

### 5.1 Extend Stream Document in Firestore

Update stream documents to include:

```typescript
{
  streamType: 'webrtc' | 'ivs',
  ivsChannelArn?: string,
  ivsStreamKey?: string,
  ivsPlaybackUrl?: string,
  rtmpIngestUrl?: string,
  recordingEnabled: boolean,
  recordingS3Key?: string
}
```

## Phase 6: Cost Optimization Strategy

### 6.1 Implement Stream Type Auto-Selection

Create `src/lib/streaming/stream-selector.ts`:

- If expected viewers > 50: recommend IVS
- If interactive 1-on-1: use LiveKit
- If creator verified: offer both options
- If new user: start with LiveKit (simpler)

### 6.2 Add Cost Estimation Display

In `LiveStreamDialog.tsx`:

- Show estimated cost per hour based on expected viewers
- "Small stream (< 50 viewers): Browser streaming recommended"
- "Large stream (> 50 viewers): Professional (OBS) recommended - Lower costs"

## Phase 7: Monetization Hooks (Preparation)

### 7.1 Add Payment Gateway Placeholder

Create `src/lib/payment/gateway.interface.ts`:

- Define payment gateway interface for future Stripe/CCBill integration
- Methods: processTip(), processSubscription(), refund()

### 7.2 Update Tip Service Integration Points

Modify restored `tip.service.ts`:

- Add TODO comments where payment gateway calls will go
- Keep 85/15 revenue split logic
- Add status transitions: pending -> completed (after payment)

### 7.3 Add Paywall Preparation

Create `src/components/live/StreamAccessControl.tsx`:

- Check if stream requires subscription
- Check if stream requires PPV payment
- Show "Subscribe" or "Pay to Watch" UI
- Currently shows access granted (no payment yet)

## Phase 8: Testing & Documentation

### 8.1 Create AWS IVS Setup Guide

Create `docs/AWS_IVS_SETUP.md`:

- AWS account setup instructions
- IAM permissions required
- S3 bucket configuration for recordings
- CloudFront CDN setup (optional but recommended)

### 8.2 Create Streaming Guide for Creators

Create `docs/STREAMING_GUIDE.md`:

- When to use Browser vs OBS
- How to set up OBS with RTMP credentials
- Recommended OBS settings (bitrate, resolution)

### 8.3 Update Platform Documentation

Update `MONETIZATION_PROGRESS.md`:

- Live Streaming: Hybrid (LiveKit + AWS IVS) ✓
- Payment Gateway: Not implemented (ready for integration)
- Tip System: Infrastructure ready, awaiting payments
- Cost per 1000 viewers: Reduced from $500 to $100-150

## Key Files Summary

**New Files (11)**:

- `src/types/tip.ts` (restored)
- `src/lib/services/tip.service.ts` (restored)
- `src/lib/streaming/aws-ivs.service.ts`
- `src/lib/streaming/aws-ivs-config.ts`
- `src/lib/streaming/stream-selector.ts`
- `src/lib/payment/gateway.interface.ts`
- `src/app/api/streaming/ivs/channel/route.ts`
- `src/app/api/streaming/ivs/stream-key/route.ts`
- `src/app/api/streaming/ivs/playback/[streamId]/route.ts`
- `src/components/live/IVSBroadcaster.tsx`
- `src/components/live/IVSViewer.tsx`
- `src/components/live/StreamAccessControl.tsx`

**Modified Files (5)**:

- `src/components/live/LiveStreamDialog.tsx`
- `src/lib/streaming/client.ts`
- `package.json`
- `MONETIZATION_PROGRESS.md`
- `.env.local` (create if not exists)

**Documentation Files (2)**:

- `docs/AWS_IVS_SETUP.md` (new)
- `docs/STREAMING_GUIDE.md` (new)

## Success Criteria

1. Creators can choose between Browser (LiveKit) and Professional (AWS IVS/OBS) streaming
2. Large streams (>50 viewers) use AWS IVS automatically to save costs
3. IVS streams auto-record to S3 for VOD replay
4. Tip system infrastructure is ready for payment gateway integration
5. Cost reduction: ~$500 → ~$100-150 per 1000-viewer stream
6. LiveKit preserved for future 1-on-1 video features
7. Clear documentation for AWS setup and creator usage

### To-dos

- [ ] Restore tip system files (tip.ts, tip.service.ts) that were deleted
- [ ] Install AWS IVS SDK dependencies
- [ ] Create AWS IVS service layer (channel creation, stream keys, playback URLs)
- [ ] Create AWS IVS configuration and environment variables
- [ ] Build API routes for IVS channel management, stream keys, and playback
- [ ] Create IVS Broadcaster component (OBS setup instructions, RTMP credentials display)
- [ ] Create IVS Viewer component (HLS player with hls.js)
- [ ] Update LiveStreamDialog to allow choosing between Browser and Professional streaming
- [ ] Add stream type routing logic to streaming client
- [ ] Extend Firestore stream documents with IVS fields
- [ ] Implement stream type auto-selection based on expected viewer count
- [ ] Create payment gateway interface for future integration
- [ ] Create stream access control component (preparation for monetization)
- [ ] Write AWS setup guide and creator streaming guide
- [ ] Update MONETIZATION_PROGRESS.md with accurate status
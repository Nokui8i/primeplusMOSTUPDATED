# PrimePlus+ Platform Vision & Technical Setup

## 🎯 Platform Vision

### Core Mission
Building a next-generation content creator platform that revolutionizes the creator economy by providing superior technology and creator tools compared to existing platforms like OnlyFans.

### Target Audience
1. **Content Creators**
   - Professional creators
   - Independent artists
   - Digital content producers
   - VR/360° content creators

2. **Users/Subscribers**
   - Content consumers
   - VR/360° content enthusiasts
   - Interactive content lovers

### Key Differentiators
1. **Technology**
   - Next.js 14 for superior performance
   - Real-time Firebase backend
   - VR technology integration
   - AI-powered features
   - Enhanced security measures
   - Scalable architecture

2. **Creator Tools**
   - Professional media editing suite
   - Real-time content preview
   - Batch processing capabilities
   - Automated content scheduling
   - Advanced analytics dashboard
   - Revenue optimization tools
   - Custom branding options

3. **User Experience**
   - Modern, clean interface
   - AI-powered content discovery
   - Smart recommendations
   - Advanced search capabilities
   - Real-time engagement features
   - Cross-platform compatibility
   - Seamless mobile experience

## 🛠 Technical Setup

### Required Services

#### 1. Firebase Configuration
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

#### 2. Firebase Services Required
- Authentication
- Cloud Firestore
- Storage
- Analytics
- Cloud Functions
- Hosting

#### 3. Dependencies
```bash
npm install firebase react-query zustand @tanstack/react-query
```

### Data Models

#### 1. User Collection
```typescript
interface User {
  uid: string;              // Firebase Auth UID
  username: string;         // Unique username
  email: string;           // User's email
  displayName?: string;     // Display name
  photoURL?: string;       // Profile photo URL
  role: 'user' | 'creator' | 'admin';
  isVerified: boolean;     // Creator verification status
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 2. Content Collection
```typescript
interface Content {
  id: string;
  authorId: string;        // Reference to user
  title: string;
  description?: string;
  type: 'text' | 'image' | 'video' | 'vr' | '360';
  mediaUrl?: string;      // URL to media content
  thumbnailUrl?: string;  // URL to thumbnail
  isPublic: boolean;
  likes: number;
  comments: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### 3. Comments Collection
```typescript
interface Comment {
  id: string;
  contentId: string;      // Reference to content
  authorId: string;       // Reference to user
  text: string;
  likes: number;
  createdAt: Timestamp;
}
```

#### 4. Subscriptions Collection
```typescript
interface Subscription {
  id: string;
  creatorId: string;      // Reference to creator
  subscriberId: string;   // Reference to subscriber
  status: 'active' | 'cancelled' | 'expired';
  planId: string;
  startDate: Timestamp;
  endDate: Timestamp;
}
```

## 🎨 Theme System

### Brand Colors
```typescript
// Core Colors
colors: {
  background: '#0F172A',      // Dark blue background
  foreground: '#FFFFFF',      // White text
  primary: '#2B55FF',         // Primary blue
  secondary: '#1E293B',       // Secondary dark blue
  accent: '#FF69B4',          // Accent pink
  muted: '#1E293B',           // Muted dark blue
  mutedForeground: '#E0E0E0', // Light gray text
  border: '#2B55FF40',        // Semi-transparent blue border
  input: '#2B55FF40',         // Semi-transparent blue input
  ring: '#2B55FF',            // Blue ring
  card: '#0F172A',            // Dark blue card
  popover: '#0F172A',         // Dark blue popover
  destructive: '#FF4444',     // Red for destructive actions
}

// Gradient Backgrounds
gradients: {
  primary: 'linear-gradient(to bottom right, #6B3BFF, #2B55FF)',
  elementor: 'linear-gradient(to bottom right, #2B1B5A, #4B3BBA, #4169E1)',
  night: 'linear-gradient(to right, #1e3c72, #2B55FF)',
  pink: 'linear-gradient(to bottom, transparent, #ff69b420)',
}

// Glow Effects
glow: {
  blue: '0 0 30px rgba(43,85,255,0.5)',
  pink: '0 0 30px rgba(255,105,180,0.5)',
  white: '0 0 20px rgba(255,255,255,0.8)',
}
```

## 💰 Monetization System

### Commission Structure
- Universal Creator-First Rate
  - 85% to Creator
  - 15% to Platform
  - Transparent fee structure
  - No hidden charges
  - Weekly payout options
  - Multiple payout methods

### Subscription Features
1. **Custom Duration Plans**
   - Set any number of days for subscription length
   - Monthly subscriptions
   - Yearly subscriptions (with savings incentive)
   - Complete freedom in duration setting

2. **Multi-Tier System**
   - Unlimited number of subscription tiers
   - Each tier fully customizable by creator
   - Mix and match content types per tier
   - Stack benefits from lower tiers

3. **Content Access Configuration**
   - Photo galleries
   - Video content
   - VR experiences
   - 360° room tours
   - Direct messaging
   - Custom requests
   - Special events

### Promotional System
1. **Custom Promo Codes**
   - Create unlimited promo codes
   - Set custom discount percentages
   - Define validity period
   - Limit number of uses
   - Restrict to specific tiers
   - Track promo code performance

2. **Promo Code Types**
   - Percentage discount
   - Fixed amount discount
   - Free trial period
   - Tier upgrade discount
   - Bundle deal discount
   - New subscriber special

## 🔒 Security Rules

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles are readable by anyone but only writable by the owner
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
    
    // Content access rules
    match /content/{contentId} {
      allow read: if resource.data.isPublic == true || 
                    request.auth.uid == resource.data.authorId;
      allow write: if request.auth.uid == request.resource.data.authorId;
    }
    
    // Comment rules
    match /comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.authorId;
    }
    
    // Subscription rules
    match /subscriptions/{subscriptionId} {
      allow read: if request.auth.uid == resource.data.subscriberId || 
                    request.auth.uid == resource.data.creatorId;
      allow create: if request.auth.uid == request.resource.data.subscriberId;
    }
  }
}
```

### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile images
    match /users/{userId}/profile/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.uid == userId &&
                     request.resource.size < 5 * 1024 * 1024 &&
                     request.resource.contentType.matches('image/.*');
    }
    
    // Content media
    match /content/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth.uid == userId &&
                     request.resource.size < 10 * 1024 * 1024 * 1024;
    }
  }
}
``` 
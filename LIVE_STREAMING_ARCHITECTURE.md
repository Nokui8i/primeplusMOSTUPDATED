# 🏗️ ארכיטקטורת מערכת שידורי LIVE
## PrimePlus+ Live Streaming Architecture

---

## 📊 **תרשים זרימת נתונים**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   יוצר תוכן     │    │   צופה          │    │   צופה          │
│   (Creator)     │    │   (Viewer 1)    │    │   (Viewer 2)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ 1. Start Live        │ 2. Join Stream       │ 2. Join Stream
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Go Live     │  │ Live Player │  │ Live Chat   │            │
│  │ Component   │  │ Component   │  │ Component   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 3. API Calls
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ /api/live/  │  │ /api/chat/  │  │ /api/tips/  │            │
│  │ start       │  │ send        │  │ send        │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 4. Authentication & Authorization
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Firebase Services                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Firebase    │  │ Firestore   │  │ Realtime    │            │
│  │ Auth        │  │ Database    │  │ Database    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 5. Create Participant Token
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS IVS Service                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Create      │  │ WebRTC      │  │ HLS         │            │
│  │ Stage       │  │ Broadcast   │  │ Playback    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 6. Stream Distribution
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS CloudFront CDN                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Global      │  │ Edge        │  │ Caching     │            │
│  │ Distribution│  │ Locations   │  │ Layer       │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ 7. Live Stream to Viewers
                  ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   צופה          │    │   צופה          │    │   צופה          │
│   (Viewer 1)    │    │   (Viewer 2)    │    │   (Viewer N)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 🔧 **רכיבי המערכת**

### **1. Frontend Layer (Next.js)**
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Components                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Go Live Button  │ Live Player     │ Live Chat               │
│ - Camera Access │ - Video Player  │ - Real-time Messages    │
│ - Mic Access    │ - Controls      │ - Emoji Reactions       │
│ - Start/Stop    │ - Full Screen   │ - User List             │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### **2. API Layer (Next.js API Routes)**
```
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoints                            │
├─────────────────┬─────────────────┬─────────────────────────┤
│ /api/live/      │ /api/chat/      │ /api/tips/              │
│ - start         │ - send          │ - send                  │
│ - stop          │ - get           │ - get                   │
│ - status        │ - subscribe     │ - history               │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### **3. Authentication Layer (Firebase)**
```
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Services                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Firebase Auth   │ Firestore       │ Realtime Database       │
│ - User Login    │ - User Data     │ - Live Chat             │
│ - JWT Tokens    │ - Stream Data   │ - Live Reactions        │
│ - Permissions   │ - Analytics     │ - Live Notifications    │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### **4. Streaming Layer (AWS IVS)**
```
┌─────────────────────────────────────────────────────────────┐
│                    AWS IVS Service                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Stage Management│ WebRTC          │ HLS Playback            │
│ - Create Stage  │ - Broadcast     │ - Adaptive Bitrate      │
│ - Participants  │ - Low Latency   │ - Multi-resolution      │
│ - Tokens        │ - Mobile Support│ - CDN Integration       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### **5. CDN Layer (AWS CloudFront)**
```
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront CDN                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│ Global Edge     │ Caching         │ Performance             │
│ - 200+ Locations│ - Video Caching │ - Low Latency           │
│ - SSL/TLS       │ - API Caching   │ - High Availability     │
│ - DDoS Protection│ - Static Assets │ - Auto Scaling          │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 📱 **זרימת משתמש (User Flow)**

### **יוצר תוכן (Creator Flow):**
```
1. Login to PrimePlus+
   ↓
2. Click "Go Live" Button
   ↓
3. Grant Camera/Mic Permissions
   ↓
4. Preview Live Stream
   ↓
5. Click "Start Live"
   ↓
6. Stream Goes Live
   ↓
7. Interact with Viewers
   ↓
8. Click "End Live"
   ↓
9. Stream Ends
```

### **צופה (Viewer Flow):**
```
1. Browse Live Streams
   ↓
2. Click on Stream
   ↓
3. Join Live Stream
   ↓
4. Watch Video + Chat
   ↓
5. Send Messages/Tips
   ↓
6. Leave Stream
```

---

## 🔄 **זרימת נתונים (Data Flow)**

### **שידור (Broadcasting):**
```
Creator Device → WebRTC → AWS IVS → CloudFront → Viewers
```

### **צ'אט (Chat):**
```
Viewer → Firebase Realtime DB → All Viewers
```

### **טיפים (Tips):**
```
Viewer → API → Firebase → Creator Account
```

---

## 🛡️ **אבטחה (Security)**

### **Authentication:**
- **Firebase Auth** - User authentication
- **JWT Tokens** - API authentication
- **Role-based Access** - Creator/Viewer permissions

### **Data Protection:**
- **HTTPS** - All communications encrypted
- **TLS 1.3** - Latest encryption standard
- **Content Moderation** - Automated content filtering

### **Privacy:**
- **Private Streams** - Pay-per-view streams
- **Age Verification** - 18+ content protection
- **Data Retention** - GDPR compliant

---

## 📊 **ביצועים (Performance)**

### **Latency:**
- **WebRTC**: < 1 second
- **HLS Playback**: 2-5 seconds
- **Chat**: < 100ms

### **Scalability:**
- **Concurrent Viewers**: 1M+
- **Concurrent Streams**: 10K+
- **Global Distribution**: 200+ locations

### **Quality:**
- **Video**: 480p to 4K
- **Audio**: 44.1kHz stereo
- **Adaptive Bitrate**: Auto quality adjustment

---

## 💰 **עלויות (Costs)**

### **AWS IVS Pricing:**
- **Input**: $0.015-0.06/hour
- **Playback**: $0.045/hour per viewer
- **Storage**: $0.023/GB/month

### **Estimated Monthly Costs:**
- **100 viewers**: $25
- **1,000 viewers**: $250
- **10,000 viewers**: $2,500
- **100,000 viewers**: $25,000

---

## 🚀 **יתרונות הארכיטקטורה**

### **✅ יתרונות:**
- **Pay As You Go** - Only pay for usage
- **Auto Scaling** - Handles any number of viewers
- **Global CDN** - Low latency worldwide
- **Mobile Support** - Works on all devices
- **High Availability** - 99.9% uptime
- **Security** - Enterprise-grade security

### **⚠️ חסרונות:**
- **AWS Dependency** - Single vendor lock-in
- **High Costs** - Expensive at scale
- **Complexity** - Multiple services to manage
- **Learning Curve** - Requires AWS knowledge

---

*תוכנית ארכיטקטורה זו נכונה לתאריך: ינואר 2025*
*עדכון אחרון: ינואר 2025*

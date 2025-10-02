# 🥽 VR Media Player System

מערכת נגני VR/360° מאוחדת ומקצועית עבור פלטפורמת PrimePlus+.

## 🎯 סקירה כללית

המערכת מאחדת 4 סוגי נגנים שונים תחת קומפוננטה אחת מרכזית:

- **Video.js VR** - נגן וידאו מקצועי לוידאו 360°
- **Google VR View** - תמיכה בתמונות 360° ו-VR עם hotspots
- **A-Frame Model Viewer** - הצגת מודלים תלת מימדיים
- **A-Frame Fallback** - גיבוי לכל סוגי התוכן

## 📁 מבנה הקבצים

```
src/components/media/
├── VRMediaPlayer.tsx          # קומפוננטה מרכזית
├── GoogleVRView.tsx           # Google VR View
├── GoogleVRImageView.tsx      # תמונות 360°
├── GoogleVRVideoView.tsx      # וידאו 360°
├── VRVideoPlayer.tsx          # Video.js VR Player
├── AFrameModelViewer.tsx      # מודלים 3D
└── README.md                  # מדריך זה
```

## 🚀 שימוש בסיסי

```tsx
import VRMediaPlayer from '@/components/media/VRMediaPlayer'

function MyComponent() {
  return (
    <VRMediaPlayer
      type="video360"
      src="https://example.com/video.mp4"
      title="My 360° Video"
      width="100%"
      height="400px"
      onReady={() => console.log('Ready!')}
      onError={(error) => console.error('Error:', error)}
    />
  )
}
```

## 🎮 סוגי תוכן נתמכים

### 1. **video360** - וידאו 360°
```tsx
<VRMediaPlayer
  type="video360"
  src="https://example.com/video360.mp4"
  projection="360"
  quality="auto"
  autoplay={false}
  muted={false}
/>
```

**תכונות:**
- נגן Video.js מקצועי
- בקרות מלאות (play/pause/volume)
- VR mode עם כפתור VR
- Fullscreen mode
- בקרות איכות ומהירות
- תמיכה במובייל

### 2. **image360** - תמונה 360°
```tsx
<VRMediaPlayer
  type="image360"
  src="https://example.com/image360.jpg"
  hotspots={[
    { id: '1', pitch: 0, yaw: 0, text: 'Click me!' }
  ]}
  onHotspotClick={(id) => console.log('Hotspot clicked:', id)}
/>
```

**תכונות:**
- Google VR View
- Hotspots אינטראקטיביים
- תמיכה ב-Stereo
- תמיכה ב-preview images

### 3. **vr** - תוכן VR
```tsx
<VRMediaPlayer
  type="vr"
  src="https://example.com/vr-content.mp4"
  isStereo={true}
  onReady={() => console.log('VR ready')}
/>
```

**תכונות:**
- Google VR View עם תמיכה ב-VR
- Stereo support
- VR mode controls
- Hotspots support

### 4. **ar** - תוכן AR
```tsx
<VRMediaPlayer
  type="ar"
  src="https://example.com/ar-content.mp4"
  onReady={() => console.log('AR ready')}
/>
```

**תכונות:**
- Google VR View עם תמיכה ב-AR
- AR mode controls
- Mobile optimization

### 5. **model** - מודל 3D
```tsx
<VRMediaPlayer
  type="model"
  src="https://example.com/model.gltf"
  title="3D Model"
/>
```

**תכונות:**
- A-Frame Model Viewer
- תמיכה ב-GLTF/GLB
- בקרות מצלמה
- VR mode support

## 🔧 Props מלאים

```tsx
interface VRMediaPlayerProps {
  type: 'video360' | 'image360' | 'vr' | 'ar' | 'model'
  src: string
  title?: string
  poster?: string
  width?: string
  height?: string
  preview?: string
  isStereo?: boolean
  onReady?: () => void
  onError?: (error: string) => void
  hotspots?: Array<{
    id: string
    pitch: number
    yaw: number
    text: string
  }>
  onHotspotClick?: (hotspotId: string) => void
  className?: string
}
```

## 🎨 עיצוב ו-UI

הקומפוננטה כוללת עיצוב אחיד עם:

- **מסגרת מעוצבת** עם glassmorphism
- **תווית סוג התוכן** בפינה הימנית העליונה
- **כותרת אופציונלית** בחלק העליון
- **Loading states** עם אנימציות
- **Error handling** עם הודעות ברורות
- **Responsive design** לכל המכשירים

## 🔍 זיהוי אוטומטי של סוג התוכן

```tsx
import { detectVRMediaType, isVRMediaSupported } from '@/components/media/VRMediaPlayer'

// זיהוי סוג התוכן
const file = event.target.files[0]
const type = detectVRMediaType(file) // 'video360' | 'image360' | 'vr' | 'ar' | 'model' | null

// בדיקת תמיכה
const supported = isVRMediaSupported(file) // boolean
```

## 📱 תמיכה במובייל

כל הנגנים מותאמים למובייל:

- **Touch controls** לניווט ב-360°
- **Responsive design** לכל גדלי מסך
- **Performance optimization** לטעינה מהירה
- **Battery optimization** לחיסכון בסוללה

## ⚡ ביצועים

- **Lazy loading** - הנגנים נטענים רק כשצריך
- **Dynamic imports** - מניעת בעיות SSR
- **Error boundaries** - טיפול בשגיאות
- **Memory management** - ניקוי זיכרון אוטומטי

## 🛠️ התקנה ותלות

```bash
npm install video.js videojs-vr three aframe
```

## 📋 דוגמאות שימוש

### בפוסט רגיל
```tsx
function Post({ post }) {
  return (
    <div className="post-card">
      <h3>{post.title}</h3>
      <VRMediaPlayer
        type={post.type}
        src={post.mediaUrl}
        title={post.title}
      />
    </div>
  )
}
```

### עם hotspots
```tsx
<VRMediaPlayer
  type="image360"
  src={imageUrl}
  hotspots={[
    { id: 'info', pitch: 0, yaw: 0, text: 'Click for info' },
    { id: 'gallery', pitch: 30, yaw: 45, text: 'View gallery' }
  ]}
  onHotspotClick={(id) => {
    if (id === 'info') showInfo()
    if (id === 'gallery') showGallery()
  }}
/>
```

### עם error handling
```tsx
<VRMediaPlayer
  type="video360"
  src={videoUrl}
  onReady={() => setLoading(false)}
  onError={(error) => {
    setError(error)
    setLoading(false)
  }}
/>
```

## 🎯 יתרונות המערכת

1. **איחוד מלא** - קומפוננטה אחת לכל סוגי ה-VR
2. **נגן מקצועי** - Video.js VR כמו YouTube
3. **UI אחיד** - עיצוב עקבי בכל הפלטפורמה
4. **תחזוקה פשוטה** - קוד מרכזי ומובנה
5. **מוכנות ל-production** - ביצועים ויציבות גבוהים
6. **גמישות** - תמיכה בכל סוגי התוכן
7. **זיהוי אוטומטי** - בחירה חכמה של הנגן המתאים

## 🚀 העתיד

המערכת מוכנה להרחבות עתידיות:

- **WebXR support** - תמיכה מלאה ב-VR headsets
- **Spatial audio** - אודיו מרחבי
- **Hand tracking** - מעקב אחר ידיים
- **Multi-user VR** - חוויות VR משותפות
- **AI-powered hotspots** - hotspots חכמים עם AI

---

**💡 טיפ:** השתמש ב-`VRMediaPlayerExample.tsx` כדי לראות דוגמאות חיות של כל סוגי התוכן!

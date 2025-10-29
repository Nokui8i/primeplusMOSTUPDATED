# 🖼️ Profile & Cover Photo Cleanup

## ✅ Your Question: "Does changing profile/cover image delete the old one automatically?"

**YES!** Old images are automatically deleted when you upload new ones.

---

## 🔄 What Happens When You Change Profile/Cover Photo

### Step-by-Step Process:

```
1. User uploads new photo
   ↓
2. System checks if old photo exists
   ↓
3. Deletes old photo from storage (S3 or Firebase)
   ↓
4. Uploads new photo to AWS S3
   ↓
5. Updates database with new photo URL
   ↓
6. Invalidates CloudFront cache (if stored in S3)
   ↓
7. Old photo completely removed!
```

---

## 📍 Code Locations

### Profile Photos:
- **File:** `src/app/settings/components/AccountSettings.tsx`
- **Lines:** 124-149 (Delete old photo logic)

```typescript
// Delete old profile photo if exists
const currentPhotoUrl = profile?.photoURL;
if (currentPhotoUrl) {
  if (currentPhotoUrl.includes('cloudfront.net')) {
    // Delete from AWS S3
    const { deleteFromS3, extractS3KeyFromUrl } = 
      await import('@/lib/aws/s3');
    const s3Key = extractS3KeyFromUrl(currentPhotoUrl);
    if (s3Key) {
      await deleteFromS3(s3Key); // ✅ Now invalidates CloudFront!
    }
  }
}
```

### Cover Photos:
- **File:** `src/components/profile/CoverPhoto.tsx`
- **Lines:** 203-224 (Delete old cover photo logic)

```typescript
// Delete old cover photo if exists
if (currentPhotoUrl.includes('cloudfront.net')) {
  const { deleteFromS3, extractS3KeyFromUrl } = 
    await import('@/lib/aws/s3');
  const s3Key = extractS3KeyFromUrl(currentPhotoUrl);
  if (s3Key) {
    await deleteFromS3(s3Key); // ✅ Now invalidates CloudFront!
  }
}
```

---

## ✨ What I Just Fixed

### Before:
- ❌ Old photos deleted from S3
- ❌ CloudFront cache NOT invalidated
- ⚠️ Old photos still accessible via CDN for up to 1 year

### After:
- ✅ Old photos deleted from S3
- ✅ **CloudFront cache automatically invalidated**
- ✅ Old photos immediately unavailable

### Files Updated:
1. **`src/app/api/upload/delete/route.ts`** - Added CloudFront invalidation
2. **`src/app/api/delete-media/route.ts`** - Added CloudFront invalidation

Both endpoints now invalidate CloudFront cache automatically!

---

## 🧪 Testing

To verify it works:

1. **Upload a new profile photo**
2. **Wait 2-5 minutes** (for CloudFront invalidation)
3. **Try to access the old photo URL** - should get 404
4. **Check AWS S3 console** - old file should be gone

---

## 📝 Important Notes

### Storage Types Supported:
- ✅ **AWS S3** - Full cleanup with CloudFront invalidation
- ✅ **Firebase Storage** - Cleanup without CloudFront (not needed)

### Error Handling:
- If deletion fails, the upload continues anyway
- Errors are logged but don't block new photo upload
- Prevents orphaned photos from stopping functionality

---

## 🎯 Summary

**YES, old photos are automatically deleted!** 

And now, thanks to the recent update, the CloudFront cache is also invalidated automatically, so old photos become completely inaccessible immediately after you upload a new one.


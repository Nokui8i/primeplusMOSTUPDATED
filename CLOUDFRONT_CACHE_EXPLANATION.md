# 🎬 Why Videos Still Play After Deleting from AWS

## The Problem Explained

When you delete files from AWS S3, the **videos/images still work** on your website because of **CloudFront CDN caching**.

### How It Works:

```
1. Upload Video → S3 Storage
                    ↓
2. CloudFront CDN caches the video
                    ↓
3. Users watch video from CloudFront cache (not S3)
                    ↓
4. You delete from S3 ❌
                    ↓
5. CloudFront STILL has cached copy ⚠️
                    ↓
6. Video continues playing from cache for UP TO 1 YEAR! 📹
```

### Your Current Configuration:

From `cloudfront-config.json`:
- **Max Cache Time:** 1 YEAR (31,536,000 seconds)
- **Cache Policy:** `managed-caching-optimized` (aggressive caching)
- **Cache-Control Header:** `max-age=31536000, immutable`

This means deleted files remain accessible for up to 1 year!

---

## ✅ The Solution I Just Implemented

### 1. **Auto Cache Invalidation on Delete**
When you delete a file through your app, it now:
- ✅ Deletes from S3
- ✅ **Automatically invalidates CloudFront cache**
- ✅ Video becomes unavailable immediately

### Updated Files:
- `src/app/api/delete-media/route.ts` - Now invalidates CloudFront cache
- `scripts/invalidate-cloudfront-cache.js` - Manual invalidation script

---

## 🛠️ How to Use

### Automatic (Recommended):
Just delete posts normally through your app - cache invalidation happens automatically now.

### Manual Invalidation:
If you need to invalidate manually:

```bash
# Install dependency first
npm install @aws-sdk/client-cloudfront

# Run invalidation script
node scripts/invalidate-cloudfront-cache.js <distribution-id> <path>

# Example: Invalidate all video files
node scripts/invalidate-cloudfront-cache.js E1234567890ABC /content/videos/*

# Example: Invalidate everything
node scripts/invalidate-cloudfront-cache.js E1234567890ABC /*
```

### Environment Variable Required:
Add to your `.env.local`:
```env
CLOUDFRONT_DISTRIBUTION_ID=your-distribution-id-here
```

You can find your Distribution ID in AWS CloudFront console.

---

## 🚨 Important Notes

### CloudFront Invalidation:
- **Free tier:** 1,000 invalidations per month
- **Cost:** $0.005 per path after free tier
- **Time:** Takes 1-15 minutes to complete globally

### Better Alternatives:
1. **Use versioning** - Add `?v=timestamp` to URLs
2. **Reduce cache time** - Lower from 1 year to shorter periods
3. **Edge caching** - Use CloudFront Origin Shield

---

## 📊 Testing

To verify the fix works:

1. **Delete a post** through your app
2. **Check S3 console** - file should be gone
3. **Wait 2-5 minutes** - for CloudFront invalidation
4. **Try to load video** - should get 404 error

---

## 🔧 Optional: Reduce Cache Time

If you want files to expire faster, update `cloudfront-config.json`:

```json
{
  "DefaultTTL": 86400,  // 1 day instead of 0
  "MaxTTL": 604800      // 1 week instead of 1 year
}
```

Then redeploy your CloudFront distribution.

---

## 📝 Summary

**Before:** Deleted files stayed in CloudFront cache for up to 1 year
**After:** Deleted files are immediately invalidated from cache

**The fix is now live in your delete media API route!** 🎉


# Manual Database Cleanup Guide

This guide shows you how to manually clean up orphaned data from Firebase Console.

## ⚠️ **Important Notes**
- **Backup First**: Always backup your database before deleting data
- **Verify Before Delete**: Double-check what you're deleting
- **Start Small**: Delete a few items first to test

---

## 🧹 **Step 1: Find Orphaned Comments**

### What to Look For:
Comments that reference posts that no longer exist.

### How to Clean:
1. Go to Firebase Console → Firestore Database
2. Open the `comments` collection
3. For each comment, check if the `postId` exists:
   - Try to find the post in `posts` collection with that ID
   - If it doesn't exist, the comment is orphaned
4. Delete orphaned comments manually

### Quick Check Query:
```
comments collection → Filter by postId → Check if post exists
```

---

## 💬 **Step 2: Find Orphaned Personal Chats**

### What to Look For:
Personal chats (`users/{userId}/chats/{chatId}`) where `sharedChatId` doesn't exist in `chats` collection.

### How to Clean:
1. Go to `users` collection
2. For each user, open `chats` subcollection
3. For each chat, check if `sharedChatId` exists:
   - Go to `chats` collection
   - Look for the document with that `sharedChatId`
   - If it doesn't exist, the personal chat is orphaned
4. Delete orphaned personal chats

### Quick Check:
```
users/{userId}/chats → Check sharedChatId → Verify in chats collection
```

---

## 📊 **Step 3: Find Old Chat Structure**

### What to Look For:
Old chat documents in `chats` collection that might have messages but no corresponding personal chats.

### How to Check:
1. Go to `chats` collection
2. Check each chat document
3. Look for chats with `participants` array
4. Verify if both users have personal chat entries
5. If not, consider if messages should be migrated or deleted

---

## 🗑️ **How to Delete in Firebase Console**

### Method 1: Single Document
1. Click on the document
2. Click the trash icon (🗑️)
3. Confirm deletion

### Method 2: Multiple Documents
1. Use Firebase Console filters
2. Select multiple documents
3. Click "Delete" button
4. Confirm

---

## ✅ **What to Delete**

### **Safe to Delete:**
- ✅ Comments with `postId` that doesn't exist in `posts`
- ✅ Personal chats with `sharedChatId` that doesn't exist in `chats`
- ✅ Empty collections

### **Be Careful:**
- ⚠️ Chats with messages - check if messages should be preserved
- ⚠️ User data - make sure user still exists

---

## 🔍 **Quick Checklist**

- [ ] Check `comments` for orphaned entries
- [ ] Check `users/{userId}/chats` for orphaned personal chats  
- [ ] Verify no critical data is being deleted
- [ ] Backup before major deletions
- [ ] Test on a few items first

---

## 💡 **Tips**

1. **Filter First**: Use Firestore filters to find candidates
2. **Batch Operations**: Delete similar items together
3. **Keep Logs**: Note what you deleted for reference
4. **Check Counts**: Before/after deletion counts help verify

---

## 🚨 **If Something Goes Wrong**

- **Firebase Console has undo?** No, but you can restore from backup
- **Check Realtime Database**: Some data might be there too
- **Contact Support**: If critical data is lost

---

*This guide is for manual cleanup when automated tools aren't available.*


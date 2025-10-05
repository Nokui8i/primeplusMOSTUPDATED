"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onFollowCreate = exports.onCommentCreate = exports.onLikeCreate = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const notifications_1 = require("../services/notifications");
// Trigger for likes - create notification when someone likes a post
exports.onLikeCreate = functions.firestore
    .document('posts/{postId}/likes/{likeId}')
    .onCreate(async (snap, context) => {
    const likeData = snap.data();
    const { postId } = context.params;
    console.log('Like created:', { postId, likeId: context.params.likeId, likeData });
    try {
        // Get post data to find the author
        const postDoc = await admin.firestore().doc(`posts/${postId}`).get();
        if (!postDoc.exists) {
            console.log('Post not found:', postId);
            return;
        }
        const postData = postDoc.data();
        const postAuthorId = postData?.authorId;
        const likerId = likeData.userId;
        // Don't notify if user is liking their own post
        if (postAuthorId === likerId) {
            console.log('User liking their own post, skipping notification');
            return;
        }
        // Check if notification already exists to prevent duplicates
        const existingNotificationQuery = admin.firestore()
            .collection('notifications')
            .where('type', '==', 'like')
            .where('fromUserId', '==', likerId)
            .where('toUserId', '==', postAuthorId)
            .where('data.postId', '==', postId)
            .limit(1);
        const existingNotifications = await existingNotificationQuery.get();
        if (!existingNotifications.empty) {
            console.log('Notification already exists for this like, skipping');
            return;
        }
        // Get liker's profile
        const likerDoc = await admin.firestore().doc(`users/${likerId}`).get();
        if (!likerDoc.exists) {
            console.log('Liker profile not found:', likerId);
            return;
        }
        const likerData = likerDoc.data();
        // Create notification
        const notificationData = {
            type: 'like',
            fromUserId: likerId,
            toUserId: postAuthorId,
            fromUser: {
                uid: likerId,
                displayName: likerData?.displayName || 'Anonymous',
                photoURL: likerData?.photoURL || '',
                username: likerData?.username || ''
            },
            read: false,
            data: {
                postId,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const notificationRef = await admin.firestore().collection('notifications').add(notificationData);
        console.log('Like notification created:', notificationRef.id);
        // Send push notification
        await (0, notifications_1.sendPushNotification)(postAuthorId, {
            type: 'like',
            title: 'New Like',
            body: `${likerData?.displayName || 'Someone'} liked your post`,
            data: {
                postId,
                notificationId: notificationRef.id
            }
        });
    }
    catch (error) {
        console.error('Error creating like notification:', error);
    }
});
// Trigger for comments - create notification when someone comments on a post
exports.onCommentCreate = functions.firestore
    .document('comments/{commentId}')
    .onCreate(async (snap, context) => {
    const commentData = snap.data();
    const { commentId } = context.params;
    console.log('Comment created:', { commentId, commentData });
    try {
        const postId = commentData.postId;
        const commenterId = commentData.authorId;
        // Get post data to find the author
        const postDoc = await admin.firestore().doc(`posts/${postId}`).get();
        if (!postDoc.exists) {
            console.log('Post not found:', postId);
            return;
        }
        const postData = postDoc.data();
        const postAuthorId = postData?.authorId;
        // Don't notify if user is commenting on their own post
        if (postAuthorId === commenterId) {
            console.log('User commenting on their own post, skipping notification');
            return;
        }
        // Check if notification already exists to prevent duplicates
        const existingNotificationQuery = admin.firestore()
            .collection('notifications')
            .where('type', '==', 'comment')
            .where('fromUserId', '==', commenterId)
            .where('toUserId', '==', postAuthorId)
            .where('data.postId', '==', postId)
            .where('data.commentId', '==', commentId)
            .limit(1);
        const existingNotifications = await existingNotificationQuery.get();
        if (!existingNotifications.empty) {
            console.log('Notification already exists for this comment, skipping');
            return;
        }
        // Get commenter's profile
        const commenterDoc = await admin.firestore().doc(`users/${commenterId}`).get();
        if (!commenterDoc.exists) {
            console.log('Commenter profile not found:', commenterId);
            return;
        }
        const commenterData = commenterDoc.data();
        const commentText = commentData.content || '';
        const truncatedText = commentText.length > 100 ? commentText.substring(0, 100) + '...' : commentText;
        // Create notification
        const notificationData = {
            type: 'comment',
            fromUserId: commenterId,
            toUserId: postAuthorId,
            fromUser: {
                uid: commenterId,
                displayName: commenterData?.displayName || 'Anonymous',
                photoURL: commenterData?.photoURL || '',
                username: commenterData?.username || ''
            },
            read: false,
            data: {
                postId,
                commentId,
                text: truncatedText,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const notificationRef = await admin.firestore().collection('notifications').add(notificationData);
        console.log('Comment notification created:', notificationRef.id);
        // Send push notification
        await (0, notifications_1.sendPushNotification)(postAuthorId, {
            type: 'comment',
            title: 'New Comment',
            body: `${commenterData?.displayName || 'Someone'} commented on your post`,
            data: {
                postId,
                commentId,
                notificationId: notificationRef.id
            }
        });
    }
    catch (error) {
        console.error('Error creating comment notification:', error);
    }
});
// Trigger for follows - create notification when someone follows a user
exports.onFollowCreate = functions.firestore
    .document('follows/{followId}')
    .onCreate(async (snap, context) => {
    const followData = snap.data();
    const { followId } = context.params;
    console.log('Follow created:', { followId, followData });
    try {
        const followerId = followData.followerId;
        const followingId = followData.followingId;
        // Don't notify if user is following themselves
        if (followerId === followingId) {
            console.log('User following themselves, skipping notification');
            return;
        }
        // Get follower's profile
        const followerDoc = await admin.firestore().doc(`users/${followerId}`).get();
        if (!followerDoc.exists) {
            console.log('Follower profile not found:', followerId);
            return;
        }
        const followerData = followerDoc.data();
        // Create notification
        const notificationData = {
            type: 'follow',
            fromUserId: followerId,
            toUserId: followingId,
            fromUser: {
                uid: followerId,
                displayName: followerData?.displayName || 'Anonymous',
                photoURL: followerData?.photoURL || '',
                username: followerData?.username || ''
            },
            read: false,
            data: {
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const notificationRef = await admin.firestore().collection('notifications').add(notificationData);
        console.log('Follow notification created:', notificationRef.id);
        // Send push notification
        await (0, notifications_1.sendPushNotification)(followingId, {
            type: 'follow',
            title: 'New Follower',
            body: `${followerData?.displayName || 'Someone'} started following you`,
            data: {
                notificationId: notificationRef.id
            }
        });
    }
    catch (error) {
        console.error('Error creating follow notification:', error);
    }
});
//# sourceMappingURL=notificationTriggers.js.map
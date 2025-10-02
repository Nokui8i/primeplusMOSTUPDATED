"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotificationHttp = void 0;
exports.sendNotification = sendNotification;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
async function sendNotification(userId, type, message, metadata = {}) {
    const db = (0, firestore_1.getFirestore)();
    const notification = {
        userId,
        toUserId: userId,
        type,
        message,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        read: false,
        metadata,
    };
    await db.collection('users').doc(userId).collection('notifications').add(notification);
}
exports.sendNotificationHttp = (0, https_1.onRequest)(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    try {
        const { userId, type, message, metadata } = req.body;
        if (!userId || !type || !message) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        await sendNotification(userId, type, message, metadata || {});
        res.json({ success: true });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('sendNotificationHttp error:', errorMsg);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Example usage in admin actions:
// await sendNotification(userId, 'creator_approved', 'Your creator application has been approved!');
// await sendNotification(userId, 'banned', 'Your account has been banned.', { reason: 'violation' }); 
//# sourceMappingURL=notifications.js.map
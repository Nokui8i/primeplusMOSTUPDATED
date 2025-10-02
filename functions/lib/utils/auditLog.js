"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEvent = logAuditEvent;
exports.getAuditLogs = getAuditLogs;
const firestore_1 = require("firebase-admin/firestore");
async function logAuditEvent(entry) {
    const db = (0, firestore_1.getFirestore)();
    try {
        await db.collection('auditLogs').add({
            ...entry,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error logging audit event:', error);
        // Don't throw - we don't want audit logging failures to break the main functionality
    }
}
async function getAuditLogs(userId, action, startDate, endDate, limit = 100) {
    const db = (0, firestore_1.getFirestore)();
    let query = db.collection('auditLogs').orderBy('timestamp', 'desc').limit(limit);
    if (userId) {
        query = query.where('userId', '==', userId);
    }
    if (action) {
        query = query.where('action', '==', action);
    }
    if (startDate) {
        query = query.where('timestamp', '>=', startDate.toISOString());
    }
    if (endDate) {
        query = query.where('timestamp', '<=', endDate.toISOString());
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data());
}
//# sourceMappingURL=auditLog.js.map
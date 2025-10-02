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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCreatorVerificationDataHttp = exports.deleteCreatorVerificationData = exports.changeUserDisplayName = exports.forceLogoutUser = exports.resetUserPassword = void 0;
const functions = __importStar(require("firebase-functions"));
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const cors_1 = __importDefault(require("cors"));
const https_1 = require("firebase-functions/v2/https");
const corsHandler = (0, cors_1.default)({ origin: true });
// Helper: log audit event
async function logAudit(action, userId, performedBy, metadata = {}) {
    const db = (0, firestore_1.getFirestore)();
    await db.collection('auditLogs').add({
        action,
        userId,
        performedBy,
        timestamp: new Date().toISOString(),
        metadata,
    });
}
// 1. Reset User Password (send reset email)
exports.resetUserPassword = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    const { userId, email } = data;
    if (!userId || !email)
        throw new functions.https.HttpsError('invalid-argument', 'Missing userId or email');
    // Only allow admin roles
    const requester = await (0, auth_1.getAuth)().getUser(context.auth.uid);
    const requesterRole = requester.customClaims?.role || null;
    if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }
    const link = await (0, auth_1.getAuth)().generatePasswordResetLink(email);
    await logAudit('reset_password', userId, context.auth.uid, { email });
    return { success: true, link };
});
// 2. Force Logout (revoke refresh tokens)
exports.forceLogoutUser = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    const { userId } = data;
    if (!userId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing userId');
    const requester = await (0, auth_1.getAuth)().getUser(context.auth.uid);
    const requesterRole = requester.customClaims?.role || null;
    if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }
    await (0, auth_1.getAuth)().revokeRefreshTokens(userId);
    await logAudit('force_logout', userId, context.auth.uid);
    return { success: true };
});
// 3. Change Display Name
exports.changeUserDisplayName = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    const { userId, newDisplayName } = data;
    if (!userId || !newDisplayName)
        throw new functions.https.HttpsError('invalid-argument', 'Missing userId or newDisplayName');
    const requester = await (0, auth_1.getAuth)().getUser(context.auth.uid);
    const requesterRole = requester.customClaims?.role || null;
    if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }
    await (0, auth_1.getAuth)().updateUser(userId, { displayName: newDisplayName });
    await logAudit('change_display_name', userId, context.auth.uid, { newDisplayName });
    return { success: true };
});
// 4. Delete creator verification files and Firestore document
exports.deleteCreatorVerificationData = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Not authenticated');
    const { userId } = data;
    if (!userId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing userId');
    // Only allow admin roles
    const requester = await (0, auth_1.getAuth)().getUser(context.auth.uid);
    const requesterRole = requester.customClaims?.role || null;
    if (!['admin', 'superadmin', 'owner'].includes(requesterRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions');
    }
    const db = (0, firestore_1.getFirestore)();
    const verificationSnap = await db.collection('verificationData').where('userId', '==', userId).get();
    if (verificationSnap.empty)
        return { success: true };
    const storage = (0, storage_1.getStorage)();
    for (const doc of verificationSnap.docs) {
        const data = doc.data();
        // Delete file from Storage if present
        if (data.idDocumentUrl) {
            try {
                const url = new URL(data.idDocumentUrl);
                // Extract the path after '/o/' and before '?'
                const path = decodeURIComponent(url.pathname.split('/o/')[1]);
                await storage.bucket().file(path).delete();
            }
            catch (err) {
                // Ignore file not found errors
            }
        }
        await doc.ref.delete();
    }
    return { success: true };
});
// New onRequest function for CORS support
exports.deleteCreatorVerificationDataHttp = (0, https_1.onRequest)(async (req, res) => {
    // --- CORS HEADERS: Set for ALL requests ---
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        // Preflight request: respond with only headers, no body
        res.status(204).end();
        return;
    }
    try {
        const { userId } = req.body;
        if (!userId) {
            console.log('Missing userId in request body');
            res.status(400).json({ error: 'Missing userId' });
            return;
        }
        const db = (0, firestore_1.getFirestore)();
        const verificationSnap = await db.collection('verificationData').where('userId', '==', userId).get();
        console.log(`Found ${verificationSnap.size} verificationData docs for userId: ${userId}`);
        if (verificationSnap.empty) {
            res.json({ success: true, message: 'No verificationData docs found.' });
            return;
        }
        const storage = (0, storage_1.getStorage)();
        for (const doc of verificationSnap.docs) {
            const data = doc.data();
            console.log(`Deleting verificationData doc: ${doc.id}`);
            if (data.idDocumentUrl) {
                try {
                    const url = new URL(data.idDocumentUrl);
                    const path = decodeURIComponent(url.pathname.split('/o/')[1]);
                    await storage.bucket().file(path).delete();
                    console.log(`Deleted file from storage: ${path}`);
                }
                catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    console.log(`Failed to delete file: ${errorMsg}`);
                }
            }
            await doc.ref.delete();
            console.log(`Deleted Firestore doc: ${doc.id}`);
        }
        res.json({ success: true, message: 'Deleted verificationData docs and files.' });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Function error:', errorMsg);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=supportActions.js.map
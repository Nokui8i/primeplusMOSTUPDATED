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
exports.restoreUserRoles = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
exports.restoreUserRoles = functions.pubsub
    .schedule('every 1 hours')
    .onRun(async (context) => {
    const db = (0, firestore_1.getFirestore)();
    const now = new Date();
    try {
        // Query for users with expired downgrades
        const usersSnapshot = await db.collection('users')
            .where('downgradeUntil', '<=', now.toISOString())
            .where('downgradedFrom', '!=', null)
            .get();
        const batch = db.batch();
        let restoredCount = 0;
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            if (userData.downgradedFrom) {
                // Restore the previous role
                batch.update(doc.ref, {
                    role: userData.downgradedFrom,
                    downgradedFrom: null,
                    downgradeUntil: null,
                    lastRoleRestored: now.toISOString()
                });
                restoredCount++;
                // Add to audit log
                const auditLogRef = db.collection('auditLogs').doc();
                batch.set(auditLogRef, {
                    action: 'role_restored',
                    userId: doc.id,
                    previousRole: userData.role,
                    newRole: userData.downgradedFrom,
                    restoredAt: now.toISOString(),
                    reason: 'automatic_restoration',
                    performedBy: 'system'
                });
            }
        }
        if (restoredCount > 0) {
            await batch.commit();
            console.log(`Successfully restored roles for ${restoredCount} users`);
        }
        return null;
    }
    catch (error) {
        console.error('Error in restoreUserRoles:', error);
        throw error;
    }
});
//# sourceMappingURL=restoreUserRoles.js.map
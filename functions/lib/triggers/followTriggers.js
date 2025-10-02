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
exports.onFollowWrite = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Trigger to update followersCount and followingCount
exports.onFollowWrite = functions.firestore
    .document('follows/{followId}')
    .onWrite(async (change, context) => {
    console.log('onFollowWrite triggered', context.params.followId);
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    const batch = admin.firestore().batch();
    if (!before && after) {
        // New follow
        const { followerId, followingId } = after;
        console.log('New follow:', { followerId, followingId });
        const followerRef = admin.firestore().doc(`users/${followerId}`);
        const followingRef = admin.firestore().doc(`users/${followingId}`);
        batch.update(followerRef, { followingCount: admin.firestore.FieldValue.increment(1) });
        batch.update(followingRef, { followersCount: admin.firestore.FieldValue.increment(1) });
    }
    else if (before && !after) {
        // Unfollow
        const { followerId, followingId } = before;
        console.log('Unfollow:', { followerId, followingId });
        const followerRef = admin.firestore().doc(`users/${followerId}`);
        const followingRef = admin.firestore().doc(`users/${followingId}`);
        batch.update(followerRef, { followingCount: admin.firestore.FieldValue.increment(-1) });
        batch.update(followingRef, { followersCount: admin.firestore.FieldValue.increment(-1) });
    }
    else {
        console.log('No follow/unfollow detected');
    }
    await batch.commit();
    console.log('Batch committed');
});
//# sourceMappingURL=followTriggers.js.map
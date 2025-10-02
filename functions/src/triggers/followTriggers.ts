import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Trigger to update followersCount and followingCount
export const onFollowWrite = functions.firestore
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
    } else if (before && !after) {
      // Unfollow
      const { followerId, followingId } = before;
      console.log('Unfollow:', { followerId, followingId });
      const followerRef = admin.firestore().doc(`users/${followerId}`);
      const followingRef = admin.firestore().doc(`users/${followingId}`);
      batch.update(followerRef, { followingCount: admin.firestore.FieldValue.increment(-1) });
      batch.update(followingRef, { followersCount: admin.firestore.FieldValue.increment(-1) });
    } else {
      console.log('No follow/unfollow detected');
    }
    await batch.commit();
    console.log('Batch committed');
  }); 
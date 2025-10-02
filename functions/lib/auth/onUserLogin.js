"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// export const onUserLogin = functions.auth.user().onSignIn(async (user: UserRecord) => {
//   const db = getFirestore();
//   const now = new Date();
//   
//   try {
//     const userRef = db.collection('users').doc(user.uid);
//     const userDoc = await userRef.get();
//     
//     if (!userDoc.exists) {
//       console.log(`User ${user.uid} not found in Firestore`);
//       return null;
//     }
//
//     const userData = userDoc.data();
//     
//     // Check if user has an expired downgrade
//     if (userData?.downgradeUntil && 
//         new Date(userData.downgradeUntil) <= now && 
//         userData.downgradedFrom) {
//       
//       // Restore the previous role
//       await userRef.update({
//         role: userData.downgradedFrom,
//         downgradedFrom: null,
//         downgradeUntil: null,
//         lastRoleRestored: now.toISOString()
//       });
//
//       // Add to audit log
//       await db.collection('auditLogs').add({
//         action: 'role_restored',
//         userId: user.uid,
//         previousRole: userData.role,
//         newRole: userData.downgradedFrom,
//         restoredAt: now.toISOString(),
//         reason: 'login_restoration',
//         performedBy: 'system'
//       });
//
//       console.log(`Restored role for user ${user.uid} on login`);
//     }
//
//     // Update last login timestamp
//     await userRef.update({
//       lastLogin: now.toISOString()
//     });
//
//     return null;
//   } catch (error) {
//     console.error('Error in onUserLogin:', error);
//     throw error;
//   }
// }); 
//# sourceMappingURL=onUserLogin.js.map
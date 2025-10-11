import { db } from '@/lib/firebase/config';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  serverTimestamp, 
  Timestamp,
  doc,
  getDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import type { Tip, TipStats } from '@/types/tip';

/**
 * Create a new tip (no payment processing - just tracking)
 */
export async function createTip(
  tip: Omit<Tip, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<Tip> {
  const tipsCollection = collection(db, 'tips');
  const newTip = {
    ...tip,
    status: 'completed' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(tipsCollection, newTip);
  const docSnap = await getDoc(doc(db, 'tips', docRef.id));
  
  return {
    id: docRef.id,
    ...docSnap.data(),
  } as Tip;
}

/**
 * Get all tips for a creator
 */
export async function getCreatorTips(creatorId: string): Promise<Tip[]> {
  const tipsQuery = query(
    collection(db, 'tips'),
    where('creatorId', '==', creatorId),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(tipsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Tip[];
}

/**
 * Get tips received by a creator with pagination
 */
export async function getCreatorTipsPaginated(
  creatorId: string,
  limitCount: number = 20
): Promise<Tip[]> {
  const tipsQuery = query(
    collection(db, 'tips'),
    where('creatorId', '==', creatorId),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snapshot = await getDocs(tipsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Tip[];
}

/**
 * Get tips sent by a user
 */
export async function getUserTips(tipperId: string): Promise<Tip[]> {
  const tipsQuery = query(
    collection(db, 'tips'),
    where('tipperId', '==', tipperId),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(tipsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Tip[];
}

/**
 * Get tip statistics for a creator
 */
export async function getCreatorTipStats(creatorId: string): Promise<TipStats> {
  const tips = await getCreatorTips(creatorId);
  
  const totalAmount = tips.reduce((sum, tip) => sum + tip.amount, 0);
  const tipCount = tips.length;
  
  // Get recent tips (last 10)
  const recentTips = tips.slice(0, 10);
  
  return {
    totalTips: tipCount,
    totalAmount,
    tipCount,
    recentTips,
  };
}

/**
 * Get tips for a specific context (post, stream, etc.)
 */
export async function getTipsForContext(
  contextType: 'post' | 'live' | 'message' | 'profile',
  contextId?: string
): Promise<Tip[]> {
  const tipsQuery = query(
    collection(db, 'tips'),
    where('context.type', '==', contextType),
    ...(contextId ? [where('context.id', '==', contextId)] : []),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(tipsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Tip[];
}

/**
 * Calculate creator earnings from tips and subscriptions
 * Platform takes 15%, creator gets 85%
 */
export async function getCreatorEarnings(creatorId: string): Promise<{
  totalEarnings: number;
  subscriptionEarnings: number;
  tipEarnings: number;
  recentSubscriptionEarnings: number;
  recentTipEarnings: number;
}> {
  // Get subscription earnings
  const subscriptionsQuery = query(
    collection(db, 'subscriptions'),
    where('creatorId', '==', creatorId),
    where('status', '==', 'active')
  );
  const subscriptionsSnap = await getDocs(subscriptionsQuery);
  
  let subscriptionEarnings = 0;
  let recentSubscriptionEarnings = 0;
  
  // Calculate start of the week
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  
  for (const docSnap of subscriptionsSnap.docs) {
    const data = docSnap.data();
    const planQuery = query(
      collection(db, 'plans'),
      where('__name__', '==', data.planId)
    );
    const planSnap = await getDocs(planQuery);
    if (!planSnap.empty) {
      const plan = planSnap.docs[0].data();
      const earning = (plan.price || 0) * 0.85; // 85% to creator
      subscriptionEarnings += earning;
      
      // Check if subscription was created this week
      const createdAt = data.createdAt?.toDate();
      if (createdAt && createdAt >= weekStart) {
        recentSubscriptionEarnings += earning;
      }
    }
  }

  // Get tip earnings
  const tips = await getCreatorTips(creatorId);
  
  let tipEarnings = 0;
  let recentTipEarnings = 0;
  
  for (const tip of tips) {
    const earning = tip.amount * 0.85; // 85% to creator
    tipEarnings += earning;
    
    // Check if tip was created this week
    const createdAt = tip.createdAt?.toDate ? tip.createdAt.toDate() : new Date(tip.createdAt as any);
    if (createdAt && createdAt >= weekStart) {
      recentTipEarnings += earning;
    }
  }

  return {
    totalEarnings: subscriptionEarnings + tipEarnings,
    subscriptionEarnings,
    tipEarnings,
    recentSubscriptionEarnings,
    recentTipEarnings,
  };
}

/**
 * Get top tippers for a creator
 */
export async function getTopTippers(creatorId: string, limitCount: number = 10): Promise<Array<{
  tipperId: string;
  totalAmount: number;
  tipCount: number;
}>> {
  const tips = await getCreatorTips(creatorId);
  
  // Group by tipper
  const tipperMap = new Map<string, { totalAmount: number; tipCount: number }>();
  
  for (const tip of tips) {
    const existing = tipperMap.get(tip.tipperId) || { totalAmount: 0, tipCount: 0 };
    tipperMap.set(tip.tipperId, {
      totalAmount: existing.totalAmount + tip.amount,
      tipCount: existing.tipCount + 1,
    });
  }
  
  // Convert to array and sort by total amount
  const topTippers = Array.from(tipperMap.entries())
    .map(([tipperId, data]) => ({ tipperId, ...data }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limitCount);
  
  return topTippers;
}


import { db } from '@/lib/firebase/config';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Tip } from '@/types/tip';

export async function createTip(tip: Omit<Tip, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tip> {
  const tipsCollection = collection(db, 'tips');
  const newTip = {
    ...tip,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(tipsCollection, newTip);
  const docSnap = await getDocs(query(collection(db, 'tips'), where('__name__', '==', docRef.id)));
  return docSnap.docs[0].data() as Tip;
}

export async function getCreatorTips(creatorId: string): Promise<Tip[]> {
  const tipsQuery = query(
    collection(db, 'tips'),
    where('creatorId', '==', creatorId),
    where('status', '==', 'completed')
  );
  
  const snapshot = await getDocs(tipsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Tip[];
}

export async function updateTipStatus(tipId: string, status: Tip['status'], refundReason?: string): Promise<void> {
  const tipRef = doc(db, 'tips', tipId);
  await updateDoc(tipRef, {
    status,
    refundReason,
    updatedAt: serverTimestamp(),
  });
}

export async function getCreatorEarnings(creatorId: string): Promise<{
  totalEarnings: number;
  subscriptionEarnings: number;
  tipEarnings: number;
}> {
  // Get subscription earnings
  const subscriptionsQuery = query(
    collection(db, 'subscriptions'),
    where('creatorId', '==', creatorId),
    where('status', '==', 'active')
  );
  const subscriptionsSnap = await getDocs(subscriptionsQuery);
  
  let subscriptionEarnings = 0;
  for (const doc of subscriptionsSnap.docs) {
    const data = doc.data();
    const planQuery = query(
      collection(db, 'plans'),
      where('id', '==', data.planId)
    );
    const planSnap = await getDocs(planQuery);
    if (!planSnap.empty) {
      const plan = planSnap.docs[0].data();
      subscriptionEarnings += plan.price * 0.85; // 85% to creator
    }
  }

  // Get tip earnings
  const tipsQuery = query(
    collection(db, 'tips'),
    where('creatorId', '==', creatorId),
    where('status', '==', 'completed')
  );
  const tipsSnap = await getDocs(tipsQuery);
  
  let tipEarnings = 0;
  for (const doc of tipsSnap.docs) {
    const data = doc.data();
    tipEarnings += data.amount * 0.85; // 85% to creator
  }

  return {
    totalEarnings: subscriptionEarnings + tipEarnings,
    subscriptionEarnings,
    tipEarnings,
  };
} 
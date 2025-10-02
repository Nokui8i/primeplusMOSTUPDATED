import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export async function POST(req: NextRequest, { params }: { params: { streamId: string } }) {
  const { streamId } = params;
  if (!streamId) {
    return NextResponse.json({ error: 'Missing streamId' }, { status: 400 });
  }
  try {
    await updateDoc(doc(db, 'streams', streamId), {
      status: 'ended',
      endedAt: new Date(),
      updatedAt: new Date(),
    });
    await updateDoc(doc(db, 'posts', streamId), {
      status: 'ended',
      updatedAt: new Date(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[END STREAM API] Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
} 
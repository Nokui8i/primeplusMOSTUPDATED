/**
 * This route is temporarily commented out due to Next.js 15 build issues
 * Remove comments when the build issues are resolved
 */

/*
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function GET(
  request: NextRequest,
  context: { params: { streamId: string } }
) {
  try {
    const streamId = context.params.streamId;
    const streamDoc = await getDoc(doc(db, 'streams', streamId));
    
    if (!streamDoc.exists()) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    const streamData = streamDoc.data();

    if (streamData.status !== 'live') {
      return NextResponse.json({ error: 'Stream is not live' }, { status: 400 });
    }

    // For now, just return stream metadata
    return NextResponse.json({
      id: streamId,
      ...streamData
    });
  } catch (error) {
    console.error('Error handling stream request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
*/ 
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = cookies().get('session')?.value;

    if (!session) {
      return NextResponse.json({ isAuthenticated: false });
    }

    const decodedClaims = await auth.verifySessionCookie(session, true);
    const userDoc = await db.collection('users').doc(decodedClaims.uid).get();
    const userData = userDoc.data();

    return NextResponse.json({
      isAuthenticated: true,
      profileCompleted: userData?.profileCompleted || false,
      user: {
        uid: decodedClaims.uid,
        email: decodedClaims.email,
        ...userData
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ isAuthenticated: false });
  }
} 
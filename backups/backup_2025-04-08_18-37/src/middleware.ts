import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth, db } from '@/lib/firebase-admin'

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value || ''

  // Return to login if no session exists
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // Verify the session
    const decodedClaims = await auth.verifySessionCookie(session, true)

    // If accessing dashboard, check if profile is completed
    if (request.nextUrl.pathname === '/dashboard') {
      // Get user document from Firestore
      const userDoc = await db.collection('users').doc(decodedClaims.uid).get()
      const userData = userDoc.data()
      
      if (!userData?.profileCompleted) {
        return NextResponse.redirect(new URL('/complete-profile', request.url))
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/dashboard/:path*']
} 
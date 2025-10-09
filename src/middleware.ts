import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth, db } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value || ''

  // Return to login if no session exists
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // Verify the session with force refresh
    const decodedClaims = await auth.verifySessionCookie(session, true)

    // Check if token is about to expire (within 5 minutes)
    const expirationTime = decodedClaims.exp * 1000 // Convert to milliseconds
    const fiveMinutes = 5 * 60 * 1000
    if (Date.now() + fiveMinutes > expirationTime) {
      // Token is about to expire, refresh it
      const newSessionCookie = await auth.createSessionCookie(decodedClaims.token, {
        expiresIn: 60 * 60 * 24 * 5 * 1000 // 5 days
      })
      
      const response = NextResponse.next()
      response.cookies.set('session', newSessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 5 // 5 days
      })
      return response
    }

    // If accessing dashboard, check if profile is completed
    if (request.nextUrl.pathname === '/dashboard') {
      try {
        // Get user document from Firestore
        const userDoc = await db.collection('users').doc(decodedClaims.uid).get()
        const userData = userDoc.data()
        
        if (!userData?.profileCompleted) {
          return NextResponse.redirect(new URL('/complete-profile', request.url))
        }
      } catch (error) {
        console.error('Error checking profile completion:', error)
        // If we can't verify profile completion, allow access but log the error
        return NextResponse.next()
      }
    }

    return NextResponse.next()
  } catch (error) {
    console.error('Middleware error:', error)
    // Clear invalid session cookie
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    return response
  }
}

export const config = {
  matcher: [
    '/home',
    '/messages/:path*',
    '/profile/:path*',
    '/subscriptions/:path*',
    '/settings/:path*',
    '/notifications/:path*',
    '/creator/:path*',
    '/admin/:path*',
    '/dashboard/:path*'
  ]
} 
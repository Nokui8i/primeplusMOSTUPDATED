import { NextRequest, NextResponse } from 'next/server';
import { generateToken } from '@/lib/streaming/server-config';

export async function GET(request: NextRequest) {
  try {
    // Debug: Log env vars

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const room = searchParams.get('room');
    const identity = searchParams.get('identity');
    const isHost = searchParams.get('isHost') === 'true';

    // Validate required parameters
    if (!room || !identity) {
      return NextResponse.json(
        { error: 'Missing required parameters: room, identity' },
        { status: 400 }
      );
    }

    // Generate token using our server-side utility
    const token = await generateToken(room, identity, isHost);

    // Debug: Log the generated token and its type

    // If token is not a string, return an error
    if (typeof token !== 'string' || !token.startsWith('ey')) {
      return NextResponse.json(
        { error: 'Failed to generate a valid LiveKit token. Check your LIVEKIT_API_KEY and LIVEKIT_API_SECRET environment variables.' },
        { status: 500 }
      );
    }

    // Return token
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 
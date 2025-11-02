import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Chat | PrimePlus+',
  description: 'Private messaging',
  // PWA manifest for standalone mode - prevents browser from pushing chat window when keyboard opens
  manifest: '/manifest-chat.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Chat',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

// CRITICAL: PWA standalone viewport - prevents browser from resizing viewport when keyboard opens
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // This is CRITICAL for PWA standalone mode - prevents viewport resize when keyboard opens
  interactiveWidget: 'resizes-content',
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}


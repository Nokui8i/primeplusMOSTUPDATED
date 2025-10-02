import type { Metadata } from 'next'
import '@/styles/globals.css'
import '@/styles/modern-auth.css'
import '@/styles/responsive-layout.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { RootLayoutContent } from '@/components/RootLayoutContent'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { NotificationList } from '@/components/common/NotificationList'
import { AuthPersistence } from '@/components/AuthPersistence'
import { UploadProvider } from '@/contexts/UploadContext'
import { Toaster } from 'sonner'
import { ChatProvider } from '@/contexts/ChatContext'
import { ChatWindows } from '@/components/chat/ChatWindows'
import { ClientComponents } from '@/components/ClientComponents'
import { WebGLInitializer } from '@/components/WebGLInitializer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PrimePlus+',
  description: 'Connect with fellow developers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <ChatProvider>
            <NotificationProvider>
              <AuthPersistence />
              <UploadProvider>
                <WebGLInitializer />
                <RootLayoutContent>{children}</RootLayoutContent>
                <ClientComponents />
                <ChatWindows />
              </UploadProvider>
              <NotificationList />
            </NotificationProvider>
          </ChatProvider>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
} 
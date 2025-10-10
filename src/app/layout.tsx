import type { Metadata } from 'next'
import '@/styles/globals.css'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import { ChatProvider } from '@/contexts/ChatContext'
import { RootLayoutContent } from '@/components/RootLayoutContent'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { NotificationList } from '@/components/common/NotificationList'
import { Toaster } from '@/components/ui/toaster'
import { SimpleToaster } from '@/components/ui/SimpleToast'

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
        <style dangerouslySetInnerHTML={{__html: `
          /* Critical CSS - Loaded immediately to prevent layout shift and flash */
          html, body {
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .chat-message-input,
          .chat-message-input input {
            height: 40px !important;
            min-height: 40px !important;
            max-height: 40px !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
          }
          .chat-recipient-name {
            font-size: 16px !important;
            line-height: 1.5 !important;
            display: inline-block !important;
            min-width: 50px !important;
          }
        `}} />
      </head>
      <body className={inter.className} style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
        <AuthProvider>
          <ChatProvider>
            <NotificationProvider>
              <RootLayoutContent>{children}</RootLayoutContent>
              <NotificationList />
              <SimpleToaster />
            </NotificationProvider>
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  )
} 
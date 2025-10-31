"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Chat } from '@/components/chat/Chat';

interface ThreadPageProps {
  params: { id: string };
}

export default function ThreadPage({ params }: ThreadPageProps) {
  const router = useRouter();
  const recipientId = params.id;
  const [recipientName, setRecipientName] = useState<string>("Loading...");
  const [recipientProfile, setRecipientProfile] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', recipientId));
        if (!isMounted) return;
        if (userDoc.exists()) {
          const data = userDoc.data();
          setRecipientProfile(data);
          setRecipientName(data.displayName || data.username || 'Unknown User');
        } else {
          setRecipientName('Unknown User');
        }
      } catch {
        setRecipientName('Unknown User');
      }
    };
    load();
    return () => { isMounted = false; };
  }, [recipientId]);

  // ✅ Keep container within viewport bounds - never exceed URL bar or navigation bar
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    
    const container = document.querySelector('[data-chat-page-container]') as HTMLElement;
    if (!container) return;

    // ✅ Prevent all document scrolling - lock the page completely
    const preventScroll = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Lock body and html to prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100vh';
    document.documentElement.style.overflow = 'hidden';
    
    // Prevent scroll events on document
    document.addEventListener('scroll', preventScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', (e) => {
      // Only allow scroll inside messages container, not on document
      const target = e.target as HTMLElement;
      const messagesContainer = target.closest('[class*="chat-messages"], [class*="messages-container"]');
      if (!messagesContainer) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false, capture: true });
    
    // Prevent wheel scroll
    document.addEventListener('wheel', preventScroll, { passive: false, capture: true });

    const updateHeight = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      
      // Get the actual visible viewport height (shrinks when keyboard opens)
      const viewportHeight = vv.height;
      
      // Get offset - when keyboard opens, viewport scrolls up (offsetTop > 0)
      // We need to compensate for this to keep container at top: 0
      const offsetTop = vv.offsetTop || 0;
      
      // Set container height to viewport height (WhatsApp-style shrink)
      container.style.height = `${viewportHeight}px`;
      container.style.maxHeight = `${viewportHeight}px`;
      container.style.minHeight = `${viewportHeight}px`;
      
      // Compensate for viewport scroll - translate down by offsetTop to keep it at top: 0
      // This prevents container from going above URL bar
      if (offsetTop > 0) {
        container.style.transform = `translateY(${offsetTop}px)`;
      } else {
        container.style.transform = 'translateY(0)';
      }
      
      // Always keep top at 0 (below URL bar)
      container.style.top = '0';
      
      // WhatsApp-style: Container shrinks, content moves with it naturally
      // No need to adjust scroll - browser handles it automatically
    };

    // Initial height
    updateHeight();

    // Listen to viewport changes (keyboard open/close)
    window.visualViewport.addEventListener('resize', updateHeight);
    window.visualViewport.addEventListener('scroll', updateHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('scroll', updateHeight);
      
      // Restore scroll
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.removeEventListener('scroll', preventScroll, { capture: true });
      document.removeEventListener('touchmove', preventScroll as any, { capture: true });
      document.removeEventListener('wheel', preventScroll, { capture: true });
    };
  }, []);

  return (
    <div 
      data-chat-page-container
      className="flex flex-col w-full bg-white overflow-hidden"
      style={{
        boxSizing: 'border-box',
        // Debug: Red border for page container
        border: '3px solid #ff0000',
        position: 'relative',
        // WhatsApp-style: No transitions, container shrinks instantly with keyboard
        transition: 'none'
      }}
    >
      <Chat
        key={`${recipientId}-${recipientName}`}
        recipientId={recipientId}
        recipientName={recipientName}
        hideHeader={false}
        onClose={() => router.push('/messages')}
        recipientProfile={recipientProfile}
      />
    </div>
  );
}



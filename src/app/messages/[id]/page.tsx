"use client";

import React, { useEffect, useState, useRef } from 'react';
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
  const chatContainerRef = useRef<HTMLDivElement>(null);

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

  const [viewportHeight, setViewportHeight] = useState<string>('85vh');
  const scrollYRef = useRef<number>(0);
  const scrollXRef = useRef<number>(0);

  // Lock body scroll on mobile (prevents background scrolling)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    // Save scroll position BEFORE locking (prevents content jump)
    scrollYRef.current = window.scrollY;
    scrollXRef.current = window.scrollX;
    const scrollY = scrollYRef.current;
    const scrollX = scrollXRef.current;
    
    const originalBodyStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      height: document.body.style.height,
      top: document.body.style.top,
      left: document.body.style.left,
    };
    
    // Lock body scroll while preserving scroll position
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    // CRITICAL: Prevent viewport from resizing
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';

    return () => {
      // Restore original styles
      document.body.style.overflow = originalBodyStyle.overflow;
      document.body.style.position = originalBodyStyle.position;
      document.body.style.width = originalBodyStyle.width;
      document.body.style.height = originalBodyStyle.height;
      document.body.style.top = originalBodyStyle.top;
      document.body.style.left = originalBodyStyle.left;
      document.body.style.touchAction = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';
      
      // Restore scroll position
      window.scrollTo(scrollX, scrollY);
    };
  }, []);

  // Keep fixed height - don't adjust when keyboard opens
  // The contentEditable div prevents browser from pushing the window
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      setViewportHeight('85vh');
      return;
    }

    // Use fixed height based on initial viewport
    // Don't adjust when keyboard opens - contentEditable prevents browser push
    const initialHeight = window.innerHeight * 0.85;
    setViewportHeight(`${initialHeight}px`);
  }, []);

  return (
    <div 
      ref={chatContainerRef}
      data-chat-page-container
      id="chat-root"
      className="bg-white overflow-hidden"
      style={{
        boxSizing: 'border-box',
        position: 'fixed',
        bottom: 0,
        top: 'auto',
        left: 0,
        right: 0,
        width: '100%',
        height: typeof window !== 'undefined' && window.innerWidth < 768 ? viewportHeight : '85vh',
        maxHeight: typeof window !== 'undefined' && window.innerWidth < 768 ? viewportHeight : '85vh',
        // Force bottom positioning - never moves up
        willChange: 'auto',
        transform: 'none !important',
        translate: 'none',
        overflow: 'hidden',
        zIndex: 9999,
        background: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        // Fixed positioning - never moves, contentEditable prevents browser push
        touchAction: 'none',
        WebkitOverflowScrolling: 'touch',
        // CRITICAL: Prevent browser from moving this element
        isolation: 'isolate',
        contain: 'layout style paint size',
        // Force no transforms
        translate: 'none',
        scale: 'none',
        rotate: 'none',
        // Prevent viewport adjustments
        viewportFit: 'auto',
      } as React.CSSProperties}
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



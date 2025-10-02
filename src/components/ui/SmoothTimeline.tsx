'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SmoothTimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  className?: string;
}

export function SmoothTimeline({ currentTime, duration, onSeek, className = '' }: SmoothTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayTime = isDragging ? dragTime : currentTime;

  // Smooth updates without transitions
  useEffect(() => {
    if (progressRef.current && scrubberRef.current) {
      setIsUpdating(true);
      progressRef.current.style.width = `${progress}%`;
      scrubberRef.current.style.left = `${progress}%`;
      
      // Re-enable transitions after a brief moment
      setTimeout(() => setIsUpdating(false), 50);
    }
  }, [progress]);

  const calculateTimeFromPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    return Math.max(0, Math.min(duration, newTime));
  }, [duration]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!containerRef.current) return;
    
    setIsDragging(true);
    const newTime = calculateTimeFromPosition(e.clientX);
    setDragTime(newTime);
    onSeek(newTime);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    e.preventDefault();
    const newTime = calculateTimeFromPosition(e.clientX);
    setDragTime(newTime);
  }, [isDragging, calculateTimeFromPosition]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    onSeek(dragTime);
  }, [isDragging, dragTime, onSeek]);

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const newTime = calculateTimeFromPosition(e.clientX);
    onSeek(newTime);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('selectstart', (e) => e.preventDefault());
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('selectstart', (e) => e.preventDefault());
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`timeline-container ${isDragging ? 'dragging' : ''} ${isUpdating ? 'updating' : ''} ${className}`}>
      {/* Clickable background track */}
      <div 
        ref={containerRef}
        className="absolute inset-0 cursor-pointer"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Progress bar */}
      <div 
        ref={progressRef}
        className="timeline-progress"
      />
      
      {/* Scrubber */}
      <div
        ref={scrubberRef}
        className={`timeline-scrubber ${isHovering ? 'timeline-scrubber-hover' : ''}`}
        onMouseDown={handleMouseDown}
      />
      
      {/* Time display */}
      <div className="flex justify-between text-xs text-white/70 mt-1">
        <span>{formatTime(displayTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

"use client"

import React, { useRef, useState, ReactNode } from 'react'

interface PinchZoomPanProps {
  children: ReactNode
  className?: string
  minScale?: number
  maxScale?: number
  onScaleChange?: (scale: number) => void
}

export function PinchZoomPan({ 
  children, 
  className = '', 
  minScale = 1, 
  maxScale = 5,
  onScaleChange 
}: PinchZoomPanProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [lastScale, setLastScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isPinching, setIsPinching] = useState(false)
  const [lastDistance, setLastDistance] = useState<number | null>(null)

  const getDistance = (touches: TouchList): number => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const getMidpoint = (touches: TouchList): { x: number; y: number } => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture
      setIsPinching(true)
      const distance = getDistance(e.touches)
      setLastDistance(distance)
      setLastScale(scale)
    } else if (e.touches.length === 1 && scale > 1) {
      // Single touch drag (only when zoomed)
      setIsDragging(true)
      setLastPos({ 
        x: e.touches[0].clientX - pos.x, 
        y: e.touches[0].clientY - pos.y 
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault() // Prevent page scroll
    
    if (e.touches.length === 2 && isPinching) {
      // Pinch zoom
      const distance = getDistance(e.touches)
      if (lastDistance !== null) {
        const scaleChange = distance / lastDistance
        const newScale = Math.max(minScale, Math.min(lastScale * scaleChange, maxScale))
        setScale(newScale)
        if (onScaleChange) {
          onScaleChange(newScale)
        }
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Pan (drag) when zoomed
      const newX = e.touches[0].clientX - lastPos.x
      const newY = e.touches[0].clientY - lastPos.y
      
      // Clamp position to keep image within bounds
      if (containerRef.current) {
        const container = containerRef.current
        const containerRect = container.getBoundingClientRect()
        const maxX = (containerRect.width * (scale - 1)) / 2
        const maxY = (containerRect.height * (scale - 1)) / 2
        
        setPos({
          x: Math.min(maxX, Math.max(-maxX, newX)),
          y: Math.min(maxY, Math.max(-maxY, newY))
        })
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false)
      setLastDistance(null)
    }
    if (e.touches.length === 0) {
      setIsDragging(false)
      // Reset position if scale goes back to 1
      if (scale <= 1) {
        setPos({ x: 0, y: 0 })
      }
    }
  }

  const handleDoubleClick = () => {
    // Reset zoom on double tap
    if (scale > 1) {
      setScale(1)
      setPos({ x: 0, y: 0 })
      if (onScaleChange) {
        onScaleChange(1)
      }
    } else {
      setScale(2)
      if (onScaleChange) {
        onScaleChange(2)
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      style={{
        overflow: 'hidden',
        touchAction: 'none',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <div
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging || isPinching ? 'none' : 'transform 0.1s ease-out',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}


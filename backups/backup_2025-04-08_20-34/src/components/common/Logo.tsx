import { cn } from '@/lib/utils'
import Image from 'next/image'

interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
}

export function Logo({
  className,
  size = 'md',
  showText = true
}: LogoProps) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  }

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* P+ Square Logo */}
      <div className={cn(
        'relative rounded-lg transform transition-transform hover:scale-105',
        'bg-gradient-to-br from-pink-50 via-pink-100 to-pink-200',
        'shadow-[4px_4px_10px_0px_rgba(0,0,0,0.1),-4px_-4px_10px_0px_rgba(255,255,255,0.9)]',
        'border border-pink-100/20',
        'overflow-hidden',
        sizes[size]
      )}>
        <Image
          src="/assets/logos/p-plus-square.svg"
          alt="P+"
          fill
          className="object-contain p-1.5 filter 
            drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)] 
            drop-shadow-[2px_4px_6px_rgba(0,0,0,0.2)] 
            drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]
            [transform:translateZ(30px)_perspective(100px)] 
            hover:[transform:translateZ(40px)_perspective(100px)_rotateX(10deg)] 
            transition-all duration-300 ease-out"
          priority
        />
      </div>
      
      {/* Optional Text */}
      {showText && (
        <span className={cn("font-medium text-gray-900", textSizes[size])}>
          primePlus<sup>+</sup>
        </span>
      )}
    </div>
  )
} 
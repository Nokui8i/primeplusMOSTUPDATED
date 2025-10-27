'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createTip } from '@/lib/services/tip.service';
import { useAuth } from '@/lib/firebase/auth';
import { Sparkles, Zap, DollarSign } from 'lucide-react';

interface TipButtonProps {
  creatorId: string;
  creatorName: string;
  context?: {
    type: 'post' | 'message' | 'profile';
    id?: string;
    mediaType?: 'image' | 'video';
  };
  variant?: 'default' | 'outline' | 'ghost' | 'icon';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100];

export function TipButton({
  creatorId,
  creatorName,
  context,
  variant = 'ghost',
  size = 'sm',
  className,
  showLabel = true,
}: TipButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalAmount = selectedAmount !== null ? selectedAmount : parseFloat(customAmount) || 0;

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be logged in to send a tip');
      return;
    }

    if (finalAmount <= 0) {
      toast.error('Please enter a valid tip amount');
      return;
    }

    if (user.uid === creatorId) {
      toast.error('You cannot tip yourself');
      return;
    }

    setIsSubmitting(true);

    try {
      await createTip({
        creatorId,
        tipperId: user.uid,
        amount: finalAmount,
        currency: 'USD',
        context,
      });

      toast.success(`Tip of $${finalAmount.toFixed(2)} sent to ${creatorName}!`, {
        icon: '💰',
        duration: 3000,
      });

      // Reset form
      setSelectedAmount(null);
      setCustomAmount('');
      setOpen(false);
    } catch (error) {
      console.error('Error sending tip:', error);
      toast.error('Failed to send tip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAmount = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  return (
    <div className="flex items-center gap-1" style={{ transform: 'translateY(0px)' }}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button 
            className="cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div 
              className="w-[24px] h-[24px] rounded-full relative flex items-center justify-center transition-all duration-300 ease-out hover:scale-110 active:scale-95"
              style={{
                background: 'linear-gradient(145deg, rgba(91, 173, 255, 1) 0%, rgba(59, 145, 235, 1) 100%)',
                boxShadow: `
                  inset 0 1px 3px rgba(255, 255, 255, 0.5),
                  inset 0 -1px 2px rgba(0, 0, 0, 0.2),
                  0 2px 6px rgba(91, 173, 255, 0.3),
                  0 1px 2px rgba(0, 0, 0, 0.1)
                `,
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale'
              }}
            >
              {/* Glossy highlight overlay */}
              <div 
                className="absolute top-[2px] left-1/2 -translate-x-1/2 w-[15px] h-[6px] rounded-full pointer-events-none transition-opacity duration-300 group-active:opacity-30"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0) 100%)',
                  filter: 'blur(1px)',
                  opacity: 0.6
                }}
              ></div>
              
              {/* P+ text with premium styling */}
              <span 
                className="relative z-10 text-white font-black transition-all duration-300 group-active:scale-90"
                style={{ 
                  fontSize: '9px',
                  letterSpacing: '0.2px',
                  textShadow: `
                    0 1px 2px rgba(0, 0, 0, 0.4),
                    0 0 4px rgba(255, 255, 255, 0.3)
                  `,
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  fontWeight: 900
                }}
              >
                P+
              </span>
            </div>
          </button>
        </PopoverTrigger>
      
      <PopoverContent 
        className="w-[380px] p-4 animate-in fade-in-0 zoom-in-95 data-[side=top]:slide-in-from-bottom-2 duration-200"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 248, 255, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '18px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 9999,
          pointerEvents: 'auto',
        }}
        align="center"
        side="top"
        sideOffset={8}
        onInteractOutside={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-bold text-gray-800 flex items-center gap-1 mb-3">
          <svg 
            className="h-4 w-4" 
            viewBox="0 0 24 24" 
            fill="none"
            style={{ color: 'rgb(91, 173, 255)' }}
          >
            <defs>
              <radialGradient id="coinGradientTitle" cx="40%" cy="40%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                <stop offset="50%" stopColor="currentColor" stopOpacity="0.2" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
              </radialGradient>
              
              <radialGradient id="coinShadowTitle" cx="50%" cy="50%">
                <stop offset="70%" stopColor="currentColor" stopOpacity="0" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
              </radialGradient>
            </defs>
            
            <circle cx="12" cy="12" r="10.5" fill="url(#coinShadowTitle)" />
            <circle cx="12" cy="12" r="10" fill="url(#coinGradientTitle)" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <circle cx="12" cy="12" r="8.8" stroke="currentColor" strokeWidth="0.3" fill="none" opacity="0.5" />
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="0.3" fill="none" opacity="0.3" />
            
            {[0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((angle) => {
              const radian = (angle * Math.PI) / 180;
              const x1 = 12 + 9.2 * Math.cos(radian);
              const y1 = 12 + 9.2 * Math.sin(radian);
              const x2 = 12 + 10 * Math.cos(radian);
              const y2 = 12 + 10 * Math.sin(radian);
              return (
                <line
                  key={angle}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  strokeWidth="0.4"
                  opacity="0.4"
                />
              );
            })}
            
            <ellipse cx="10" cy="9" rx="3" ry="2" fill="currentColor" opacity="0.15" />
            
            <text 
              x="12" 
              y="15.8" 
              textAnchor="middle" 
              fontSize="9.5" 
              fontWeight="900" 
              fill="currentColor"
              opacity="0.95"
              style={{ letterSpacing: '0.5px' }}
            >
              P+
            </text>
          </svg>
          Send a Tip to {creatorName}
        </div>

        <div>
          {/* Quick Amount Selection */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-700 mb-1">Select Amount</label>
            <div className="flex justify-center gap-1">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleQuickAmount(amount);
                  }}
                  className={`
                    relative overflow-hidden text-center font-bold transition-all
                    ${
                      selectedAmount === amount
                        ? 'text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                  style={{
                    background: selectedAmount === amount 
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(34, 211, 238, 0.9) 100%)'
                      : 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '12px',
                    boxShadow: selectedAmount === amount 
                      ? '0 4px 12px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.3) inset'
                      : '0 2px 6px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                    fontSize: '11px',
                    minWidth: '52px',
                    padding: '6px 8px',
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount */}
          <div className="mt-2 flex items-center justify-center gap-2">
            <label className="text-[9px] font-medium text-gray-500">or</label>
            <div className="relative" style={{ width: '120px' }}>
              <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className="pl-7 text-center"
                style={{
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
                  fontSize: '10px',
                  padding: '5px 8px',
                  height: '30px',
                }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-1.5 mt-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSubmit();
            }}
            disabled={finalAmount <= 0 || isSubmitting}
            className="profile-btn"
            style={{
              opacity: (finalAmount <= 0 || isSubmitting) ? 0.6 : 1,
              cursor: (finalAmount <= 0 || isSubmitting) ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (finalAmount > 0 && !isSubmitting) {
                e.currentTarget.style.backgroundSize = '200% auto';
                e.currentTarget.style.boxShadow = 'rgba(14, 165, 233, 0.5) 0px 0px 12px 0px';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundSize = '100% auto';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {isSubmitting ? (
              <>
                <Sparkles className="inline-block w-3 h-3 mr-1 animate-spin" />
                SENDING...
              </>
            ) : (
              <>
                <Zap className="inline-block w-3 h-3 mr-1" />
                SEND ${finalAmount.toFixed(2)} TIP
              </>
            )}
          </button>
        </div>
      </PopoverContent>
      </Popover>
      
      <span className="text-[9px] font-semibold text-gray-700 dark:text-gray-300">
        Tip
      </span>
    </div>
  );
}


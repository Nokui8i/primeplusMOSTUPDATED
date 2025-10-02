import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  id?: string;
  size?: 'sm' | 'default';
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, id, size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange && onCheckedChange(!checked)}
        className={
          cn(
            'relative inline-flex items-center transition-colors focus:outline-none border shadow-sm',
            size === 'sm'
              ? 'w-8 h-4'
              : 'w-11 h-6',
            checked
              ? 'bg-brand-pink-main border-brand-pink-main'
              : 'bg-gray-300 border-gray-400 dark:bg-gray-700 dark:border-gray-600',
            'focus:ring-2 focus:ring-brand-pink-main',
            'active:scale-95',
            props.className
          )
        }
        {...props}
      >
        <span
          className={
            cn(
              'inline-block rounded-full bg-white shadow transform transition-all duration-200',
              size === 'sm'
                ? 'w-3 h-3 translate-x-1'
                : 'w-5 h-5 translate-x-1',
              checked
                ? size === 'sm'
                  ? 'translate-x-4'
                  : 'translate-x-5'
                : '',
              'ring-0',
              'group-focus:ring-2 group-focus:ring-brand-pink-main',
              'active:scale-110'
            )
          }
        />
      </button>
    );
  }
);

Switch.displayName = SwitchPrimitives.Root.displayName 
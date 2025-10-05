"use client";

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SimpleToastProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  duration?: number;
  onClose?: () => void;
}

export function SimpleToast({ 
  title, 
  description, 
  action, 
  duration = 5000,
  onClose 
}: SimpleToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300); // Wait for animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed bottom-4 left-4 z-[9999] bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          {description && (
            <p className="text-xs text-gray-600 mt-1">{description}</p>
          )}
          {action && (
            <div className="mt-2">
              {action}
            </div>
          )}
        </div>
        <button
          onClick={handleClose}
          className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Toast manager for global state
class ToastManager {
  private toasts: Array<{ id: string; props: SimpleToastProps }> = [];
  private listeners: Array<(toasts: Array<{ id: string; props: SimpleToastProps }>) => void> = [];

  addToast(props: SimpleToastProps): string {
    const id = Math.random().toString(36).substr(2, 9);
    this.toasts.push({ id, props });
    this.notifyListeners();
    return id;
  }

  removeToast(id: string) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: (toasts: Array<{ id: string; props: SimpleToastProps }>) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.toasts]));
  }
}

const toastManager = new ToastManager();

export function useSimpleToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; props: SimpleToastProps }>>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToasts);
    return unsubscribe;
  }, []);

  const toast = (props: SimpleToastProps) => {
    return toastManager.addToast(props);
  };

  return { toast, toasts };
}

export function SimpleToaster() {
  const { toasts } = useSimpleToast();

  return (
    <>
      {toasts.map(({ id, props }) => (
        <SimpleToast
          key={id}
          {...props}
          onClose={() => toastManager.removeToast(id)}
        />
      ))}
    </>
  );
}

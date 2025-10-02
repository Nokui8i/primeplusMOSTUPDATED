import { XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { ReactNode } from 'react';
import { NotificationType } from '@/contexts/NotificationContext';

interface NotificationStyle {
  icon: typeof CheckCircleIcon | typeof ExclamationCircleIcon | typeof InformationCircleIcon | typeof ExclamationTriangleIcon;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const notificationStyles: Record<NotificationType, NotificationStyle> = {
  success: {
    icon: CheckCircleIcon,
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-400'
  },
  error: {
    icon: ExclamationCircleIcon,
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
    borderColor: 'border-red-400'
  },
  warning: {
    icon: ExclamationTriangleIcon,
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-800',
    borderColor: 'border-yellow-400'
  },
  info: {
    icon: InformationCircleIcon,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-400'
  }
} as const;

interface NotificationProps {
  type: NotificationType;
  message: string | ReactNode;
  onClose: () => void;
}

export function NotificationContainer({ type, message, onClose }: NotificationProps) {
  const style = notificationStyles[type];
  const Icon = style.icon;

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-lg border ${style.bgColor} ${style.textColor} ${style.borderColor}`}>
      <Icon className="h-5 w-5 mr-3" />
      <div className="mr-3">{message}</div>
      <button
        onClick={onClose}
        className="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 inline-flex h-8 w-8 hover:bg-gray-100 hover:text-gray-900"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
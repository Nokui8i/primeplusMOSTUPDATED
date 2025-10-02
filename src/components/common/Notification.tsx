import { XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon, ChatBubbleLeftIcon, AtSymbolIcon, UserPlusIcon } from '@heroicons/react/24/solid';
import { ReactNode } from 'react';
import { NotificationType } from '@/contexts/NotificationContext';

interface NotificationStyle {
  icon: typeof HeartIcon | typeof ChatBubbleLeftIcon | typeof AtSymbolIcon | typeof UserPlusIcon;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const notificationStyles: Record<NotificationType, NotificationStyle> = {
  like: {
    icon: HeartIcon,
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-800',
    borderColor: 'border-pink-400'
  },
  comment: {
    icon: ChatBubbleLeftIcon,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-800',
    borderColor: 'border-blue-400'
  },
  mention: {
    icon: AtSymbolIcon,
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-800',
    borderColor: 'border-purple-400'
  },
  follow: {
    icon: UserPlusIcon,
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
    borderColor: 'border-green-400'
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
    <div className={`fixed top-4 right-4 z-50 flex items-center p-4 rounded-lg border shadow-lg ${style.bgColor} ${style.textColor} ${style.borderColor}`}>
      <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
      <div className="mr-3 text-sm font-medium">{message}</div>
      <button
        onClick={onClose}
        className="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 inline-flex h-8 w-8 hover:bg-gray-100 hover:text-gray-900"
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
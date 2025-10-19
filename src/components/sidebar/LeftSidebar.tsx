'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const navigationItems: any[] = [
];

export function LeftSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-800 p-4">
      <nav className="space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium ${
                pathname === item.href
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
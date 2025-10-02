import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface SidebarItem {
  href: string;
  label: string;
  icon: ReactNode;
}

interface SidebarProps {
  items: SidebarItem[];
}

const Sidebar = ({ items }: SidebarProps) => {
  const pathname = usePathname();

  return (
    <div className="h-full w-64 bg-white border-r border-[#E2E8F0] flex flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center space-x-2">
          <img src="/logo.svg" alt="Logo" className="h-8 w-8" />
          <span className="text-xl font-bold text-[#1E293B]">PrimePlus</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'text-white bg-gradient-to-r from-[#2B55FF] to-[#4169E1]'
                  : 'text-[#64748B] hover:text-[#2B55FF] hover:bg-[#F8FAFC]'
              }`}
            >
              {item.icon}
              <span className="ml-3">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar; 
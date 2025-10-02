import { useState } from 'react';
import { FiMenu, FiBell, FiUser } from 'react-icons/fi';

interface DashboardHeaderProps {
  title: string;
  onMenuClick: () => void;
}

const DashboardHeader = ({ title, onMenuClick }: DashboardHeaderProps) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header className="bg-white shadow-sm p-4 flex justify-between items-center border-b border-[#E2E8F0]">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#2B55FF] transition-colors duration-200"
        >
          <FiMenu className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-[#1E293B]">{title}</h1>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#2B55FF] transition-colors duration-200 relative"
        >
          <FiBell className="w-5 h-5" />
        </button>

        <button
          onClick={() => setShowProfile(!showProfile)}
          className="flex items-center space-x-2 p-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#2B55FF] transition-colors duration-200"
        >
          <FiUser className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default DashboardHeader; 
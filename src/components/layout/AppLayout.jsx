import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileBottomNav from './MobileBottomNav';

const AppLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < 1100 : false
  ));

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((value) => !value)}
      />
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${isSidebarCollapsed ? 'md:ml-[76px]' : 'md:ml-[240px]'}`}>
        <TopBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 pb-24 sm:p-5 sm:pb-24 md:p-6 md:pb-6 flex flex-col">
          <Outlet />
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;

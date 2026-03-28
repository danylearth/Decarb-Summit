import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar />
      <main className="md:ml-64 transition-all duration-300">
        <Outlet />
      </main>
      <div className="md:hidden">
        <BottomNav />
      </div>
      {/* Background Decorative Elements */}
      <div className="fixed -top-24 -right-24 w-96 h-96 bg-primary-accent/5 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed top-1/2 -left-48 w-[500px] h-[500px] bg-surface-container-high/20 blur-[150px] rounded-full pointer-events-none z-0" />
    </div>
  );
}

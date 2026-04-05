import { NavLink, useLocation } from 'react-router-dom';
import { Layers, Library, Network, User, CalendarDays } from 'lucide-react';
import { cn } from '../components/UI';
import { useUser } from '../context/UserContext';

export function Sidebar() {
  const location = useLocation();
  const { user: currentUser } = useUser();

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const isProfilePath = pathSegments[0] === 'profile';
  const profileId = pathSegments[1];
  
  const isPublicProfile = isProfilePath && profileId && profileId !== 'settings' && profileId !== 'personal' && profileId !== 'membership' && profileId !== currentUser?.id;

  const navItems = [
    { to: '/feed', icon: Layers, label: 'Feed' },
    { to: '/schedule', icon: CalendarDays, label: 'Schedule' },
    { 
      to: '/connections', 
      icon: Network, 
      label: 'Connections',
      isActiveOverride: isPublicProfile
    },
    { 
      to: '/profile', 
      icon: User, 
      label: 'Profile',
      isActiveOverride: location.pathname === '/profile' || (location.pathname.startsWith('/profile/') && !isPublicProfile)
    },
  ];

  return (
    <nav className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 p-6 border-r border-white/5 bg-surface-container-low z-50">
      <div className="mb-10 px-4">
        <h1 className="text-xl font-black uppercase tracking-[0.2em] text-primary-accent">Platform</h1>
      </div>
      <div className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => {
              const active = item.isActiveOverride !== undefined ? item.isActiveOverride : isActive;
              return cn(
                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300",
                active 
                  ? "bg-primary-accent text-on-primary-accent shadow-lg shadow-primary-accent/20" 
                  : "text-on-surface-variant/60 hover:text-primary-accent hover:bg-surface-container"
              );
            }}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-bold uppercase tracking-widest text-sm">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

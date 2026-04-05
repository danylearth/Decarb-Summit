import { NavLink, useLocation } from 'react-router-dom';
import { Layers, Library, Network, User, CalendarDays } from 'lucide-react';
import { cn } from '../components/UI';
import { useUser } from '../context/UserContext';

export function BottomNav() {
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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 flex items-center justify-evenly px-2 pb-10 pt-4 bg-background/60 backdrop-blur-xl border-t border-white/5 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,7,57,0.5)]">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => {
            const active = item.isActiveOverride !== undefined ? item.isActiveOverride : isActive;
            return cn(
              "flex flex-col items-center justify-center transition-all duration-300 min-w-[64px]",
              active 
                ? "bg-primary-accent text-on-primary-accent rounded-full px-4 py-3 scale-105 shadow-lg shadow-primary-accent/20" 
                : "text-on-surface-variant/60 hover:text-primary-accent px-2"
            );
          }}
        >
          <item.icon className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

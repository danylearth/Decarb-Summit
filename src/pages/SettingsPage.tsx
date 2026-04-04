import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Avatar, Card, cn } from '../components/UI';
import { User, CreditCard, Bell, Eye, Lock, LogOut, ChevronRight, Edit2, Bookmark, Play, FileText, Lightbulb, ArrowLeft, Linkedin, Twitter, BarChart } from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Resource } from '../types';

export function SettingsPage() {
  const { user, membership, preferences, togglePreference, signOut } = useUser();
  const navigate = useNavigate();
  const [savedResources, setSavedResources] = useState<Resource[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);

  useEffect(() => {
    if (!user) return;

    const savedRef = collection(db, 'users', user.id, 'saved_resources');
    const q = query(savedRef, orderBy('savedAt', 'desc'));

    const unsub = onSnapshot(q, async (snapshot) => {
      try {
        const resources = await Promise.all(
          snapshot.docs.map(async (d) => {
            const resourceId = d.data().resourceId;
            const resDoc = await getDoc(doc(db, 'resources', resourceId));
            if (resDoc.exists()) {
              return { id: resDoc.id, ...resDoc.data() } as Resource;
            }
            return null;
          })
        );
        setSavedResources(resources.filter((r): r is Resource => r !== null));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.id}/saved_resources`);
      } finally {
        setLoadingSaved(false);
      }
    });

    return () => unsub();
  }, [user]);

  const accountItems = [
    { icon: User, label: 'Personal Information', sub: 'Bio, contact data, and social links', path: '/profile/personal' },
    { icon: CreditCard, label: 'Membership Plan', sub: `Current: ${membership.plan}`, path: '/profile/membership' },
    ...(user.isAdmin ? [{ icon: BarChart, label: 'Admin Dashboard', sub: 'Manage platform backend', path: '/admin' }] : []),
  ];

  const sections = [
    {
      title: 'Account Settings',
      items: accountItems
    },
    {
      title: 'Social Presence',
      items: [
        { icon: Linkedin, label: 'LinkedIn', sub: user.linkedin || 'Not connected', path: '/profile/personal' },
        { icon: Twitter, label: 'X (Twitter)', sub: user.twitter || 'Not connected', path: '/profile/personal' },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { 
          icon: Bell, 
          label: 'Push Notifications', 
          sub: 'Alerts on networking matches', 
          toggle: true, 
          active: preferences.pushNotifications,
          onToggle: () => togglePreference('pushNotifications')
        },
        { 
          icon: Eye, 
          label: 'Public Profile', 
          sub: 'Visible to community search', 
          toggle: true, 
          active: preferences.publicProfile,
          onToggle: () => togglePreference('publicProfile')
        },
      ]
    },
    {
      title: 'Security',
      items: [
        { icon: Lock, label: 'Two-Factor Auth', sub: 'Enhanced account protection', badge: 'Secure' },
      ]
    }
  ];

  return (
    <motion.main 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto px-6 pt-12 pb-32"
    >
      <header className="flex items-center justify-between mb-12">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-container rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface-variant/60">Settings</h1>
        <div className="w-10" />
      </header>

      {/* Profile Hero */}
      <section className="flex flex-col items-center mb-12">
        <div className="relative group">
          <div className="absolute inset-0 bg-primary-accent blur-2xl opacity-20 rounded-full group-hover:opacity-40 transition-opacity" />
          <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary-accent to-transparent mb-6 relative z-10">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-full h-full object-cover rounded-full border-4 border-background shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <div 
            onClick={() => navigate('/profile/personal')}
            className="absolute bottom-6 right-0 bg-primary-accent text-on-primary-accent p-2 rounded-full shadow-lg z-20 cursor-pointer hover:scale-110 transition-transform"
          >
            <Edit2 className="w-4 h-4" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-1">{user.name}</h1>
        <p className="text-on-surface-variant font-medium tracking-wide text-sm mb-4">{user.role}</p>
        
        <div className="flex items-center gap-2 bg-primary-accent/10 border border-primary-accent/20 px-4 py-1.5 rounded-full">
          <span className="w-2 h-2 bg-primary-accent rounded-full animate-pulse" />
          <span className="text-primary-accent text-[12px] font-bold tracking-wider uppercase">Live Connection</span>
        </div>
      </section>

      {/* Settings Sections */}
      <div className="space-y-10">
        {/* Saved Resources Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/60">Saved Insights</h2>
            <div className="h-px flex-1 ml-4 bg-white/5" />
          </div>
          
          {loadingSaved ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : savedResources.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {savedResources.map((res) => (
                <Card 
                  key={res.id}
                  onClick={() => navigate(`/resources/${res.id}`)}
                  className="p-3 bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer border border-white/5 flex items-center gap-4"
                >
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                    <img src={res.image} alt={res.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {res.type === 'Video' ? <Play className="w-3 h-3 text-primary-accent" /> : 
                       res.type === 'Report' ? <FileText className="w-3 h-3 text-primary-accent" /> : 
                       <Lightbulb className="w-3 h-3 text-primary-accent" />}
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary-accent">{res.type}</span>
                    </div>
                    <h3 className="text-sm font-bold text-on-surface truncate">{res.title}</h3>
                    <p className="text-[10px] text-on-surface-variant/60 truncate">By {res.author}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-on-surface-variant/20" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-xl p-8 border border-dashed border-white/10 text-center">
              <Bookmark className="w-8 h-8 text-on-surface-variant/20 mx-auto mb-3" />
              <p className="text-sm font-bold text-on-surface-variant/40">No saved insights yet</p>
              <p className="text-[12px] text-on-surface-variant/20 mt-1">Articles you save will appear here</p>
            </div>
          )}
        </section>

        {sections.map((section) => (
          <section key={section.title}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/60">{section.title}</h2>
              <div className="h-px flex-1 ml-4 bg-white/5" />
            </div>
            <div className="space-y-3">
              {section.items.map((item) => (
                <div 
                  key={item.label} 
                  onClick={() => {
                    if (item.toggle && (item as any).onToggle) {
                      (item as any).onToggle();
                    } else if (item.path) {
                      navigate(item.path);
                    }
                  }}
                  className="flex items-center justify-between p-5 bg-surface-container-low rounded-xl group hover:bg-surface-container transition-colors cursor-pointer border border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-surface-container-highest rounded-full text-primary-accent">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{item.label}</p>
                      <p className="text-[12px] text-on-surface-variant/70">{item.sub}</p>
                    </div>
                  </div>
                  
                  {item.toggle ? (
                    <div className={cn(
                      "w-12 h-6 rounded-full relative p-1 flex items-center transition-colors",
                      item.active ? "bg-primary-accent justify-end" : "bg-surface-container-highest justify-start"
                    )}>
                      <div className={cn("w-4 h-4 rounded-full", item.active ? "bg-on-primary-accent" : "bg-on-surface-variant/50")} />
                    </div>
                  ) : item.badge ? (
                    <span className="text-primary-accent font-bold text-[10px] uppercase tracking-widest px-3 py-1 bg-primary-accent/10 rounded-full">
                      {item.badge}
                    </span>
                  ) : (
                    <ChevronRight className="w-5 h-5 text-on-surface-variant/40 group-hover:text-primary-accent transition-colors" />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <div
          onClick={signOut}
          className="flex items-center justify-center p-5 group cursor-pointer"
        >
          <div className="flex items-center gap-2 text-red-400 hover:opacity-80 transition-opacity">
            <LogOut className="w-4 h-4" />
            <p className="text-sm font-extrabold tracking-widest uppercase">Sign Out</p>
          </div>
        </div>

        {/* Dev: Reset onboarding for testing */}
        <div
          onClick={async () => {
            if (!auth.currentUser) return;
            if (!confirm('Reset onboarding? You will go through the setup flow again.')) return;
            try {
              await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                onboarded: false,
                name: auth.currentUser.displayName || 'User',
                handle: auth.currentUser.email?.split('@')[0] || 'user',
                role: 'Community Member',
                company: '',
                bio: '',
                tags: [],
              });
              localStorage.clear();
              sessionStorage.clear();
              window.location.href = '/';
            } catch (err) {
              console.error('Reset failed:', err);
              alert('Reset failed — check console');
            }
          }}
          className="flex items-center justify-center p-5 mb-20 group cursor-pointer opacity-40 hover:opacity-100 transition-opacity"
        >
          <p className="text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Reset Onboarding (Dev)</p>
        </div>
      </div>
    </motion.main>
  );
}

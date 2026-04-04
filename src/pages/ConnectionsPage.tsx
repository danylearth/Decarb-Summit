import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot, limit, where, orderBy, doc, getDoc } from 'firebase/firestore';
// Real data from Firestore - no mock fallbacks
import { Avatar, Button, cn } from '../components/UI';
import { X, Star, Sparkles, ChevronRight, SlidersHorizontal, Search, Filter, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '../types';
import { useUser } from '../context/UserContext';

interface Conversation {
  id: string;
  otherUser: User;
  lastMessage: string;
  timestamp: string;
  isUnread: boolean;
  rawTimestamp: any;
}

export function ConnectionsPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'discovery' | 'messages'>('discovery');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const navigate = useNavigate();

  // React to search param changes (used by tutorial)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'messages') setActiveTab('messages');
    else if (tab === 'discovery') setActiveTab('discovery');
    if (searchParams.get('filters') === 'true') setIsFilterModalOpen(true);
  }, [searchParams]);
  const { user: currentUser } = useUser();
  const [discoveryUsers, setDiscoveryUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [filters, setFilters] = useState({
    role: '',
    company: '',
    selectedTags: [] as string[]
  });

  const availableTags = ['Carbon Capture', 'SaaS Scaleup', 'Venture Capital', 'Renewables', 'Hydrogen', 'Policy', 'Circular Economy'];

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'users'), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setDiscoveryUsers([]);
        setCurrentIndex(0);
        setLoading(false);
        return;
      }
      let users = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as User))
        .filter(u => u.id !== currentUser?.id);

      // Client-side filtering for better UX in prototype
      if (filters.role) {
        users = users.filter(u => u.role.toLowerCase().includes(filters.role.toLowerCase()));
      }
      if (filters.company) {
        users = users.filter(u => u.company.toLowerCase().includes(filters.company.toLowerCase()));
      }
      if (filters.selectedTags.length > 0) {
        users = users.filter(u => 
          filters.selectedTags.every(tag => u.tags?.includes(tag))
        );
      }

      setDiscoveryUsers(users);
      setCurrentIndex(0);
      setLoading(false);
    }, (err) => {
      setError('Failed to load connections. Please try again.');
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [currentUser, filters]);

  // Fetch real conversations from Firestore
  useEffect(() => {
    if (!currentUser?.id) return;

    const messagesRef = collection(db, 'messages');
    
    // Listen to all messages where the user is a participant
    const q = query(
      messagesRef, 
      where('participants', 'array-contains', currentUser.id), 
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convMap = new Map<string, any>();

      snapshot.docs.forEach(d => {
        const data = d.data();
        const otherUserId = data.senderId === currentUser.id ? data.receiverId : data.senderId;

        if (!convMap.has(otherUserId)) {
          convMap.set(otherUserId, {
            id: d.id,
            lastMessage: data.text || (data.voiceNote ? "Voice Note" : "Attachment"),
            timestamp: data.timestamp,
            otherUserId
          });
        }
      });

      const uniqueConvs = Array.from(convMap.values());

      // Fetch real user data for each conversation partner
      const formattedConvs = await Promise.all(uniqueConvs.map(async (c) => {
        let otherUser: User;
        try {
          const userDoc = await getDoc(doc(db, 'users', c.otherUserId));
          if (userDoc.exists()) {
            otherUser = { id: userDoc.id, ...userDoc.data() } as User;
          } else {
            otherUser = {
              id: c.otherUserId,
              name: 'User',
              avatar: `https://picsum.photos/seed/${c.otherUserId}/200/200`,
              role: 'Professional',
              company: 'Unknown',
              handle: 'user',
              tags: []
            } as User;
          }
        } catch {
          otherUser = {
            id: c.otherUserId,
            name: 'User',
            avatar: `https://picsum.photos/seed/${c.otherUserId}/200/200`,
            role: 'Professional',
            company: 'Unknown',
            handle: 'user',
            tags: []
          } as User;
        }

        return {
          id: c.id,
          otherUser,
          lastMessage: c.lastMessage,
          timestamp: c.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Just now',
          rawTimestamp: c.timestamp,
          isUnread: false
        } as Conversation;
      }));

      setConversations(formattedConvs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const activeUser = discoveryUsers[currentIndex];

  const handleRemove = () => {
    if (!activeUser) return;
    const newUsers = discoveryUsers.filter(u => u.id !== activeUser.id);
    setDiscoveryUsers(newUsers);
    if (currentIndex >= newUsers.length && newUsers.length > 0) {
      setCurrentIndex(0);
    }
  };

  const handleStar = () => {
    if (!activeUser) return;
    navigate(`/chat/${activeUser.id}`);
  };

  const handleNext = () => {
    if (currentIndex < discoveryUsers.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0); // Loop back for demo purposes
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col pb-32 max-w-6xl mx-auto">
      {/* Header & Toggle */}
      <div className="px-6 pt-12 pb-6 sticky top-0 z-40 bg-background/80 backdrop-blur-md">
        <div className="flex justify-between items-center mb-6 h-16">
          <AnimatePresence mode="wait">
            {isMessageSearchOpen && activeTab === 'messages' ? (
              <motion.div 
                key="search-input"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '100%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex-1 mr-4 relative"
              >
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                <input 
                  autoFocus
                  type="text"
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Search catalysts..."
                  className="w-full bg-surface-container rounded-full py-3 pl-12 pr-5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none transition-all"
                />
              </motion.div>
            ) : (
              <motion.div
                key="header-text"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary-accent mb-1">Network</p>
                <h1 className="text-4xl font-extrabold tracking-tighter">Connections</h1>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => {
              if (activeTab === 'discovery') {
                setIsFilterModalOpen(true);
              } else {
                setIsMessageSearchOpen(!isMessageSearchOpen);
                if (isMessageSearchOpen) setMessageSearch('');
              }
            }}
            className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center cursor-pointer hover:bg-surface-container-highest transition-colors shrink-0"
          >
            {activeTab === 'discovery' ? (
              <SlidersHorizontal className="w-5 h-5 text-primary-accent" />
            ) : isMessageSearchOpen ? (
              <X className="w-5 h-5 text-primary-accent" />
            ) : (
              <Search className="w-5 h-5 text-primary-accent" />
            )}
          </button>
        </div>

        <div className="bg-surface-container-low p-1.5 rounded-full flex items-center w-full shadow-inner md:hidden">
          <button 
            onClick={() => setActiveTab('discovery')}
            className={`flex-1 py-3 rounded-full font-bold text-xs tracking-widest uppercase transition-all duration-300 ${
              activeTab === 'discovery' ? 'bg-primary-accent text-on-primary-accent shadow-lg' : 'text-on-surface/50'
            }`}
          >
            Match
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-3 rounded-full font-bold text-xs tracking-widest uppercase transition-all duration-300 ${
              activeTab === 'messages' ? 'bg-primary-accent text-on-primary-accent shadow-lg' : 'text-on-surface/50'
            }`}
          >
            Conversations
          </button>
        </div>
      </div>

      {/* Desktop: side-by-side layout */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-6 px-6 flex-1">
        {/* Discovery column */}
        <div className="flex flex-col">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface/60 mb-6">Requests</h2>
          <div className="flex-1 relative flex items-start justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-4 pt-20">
                <div className="w-8 h-8 animate-spin text-primary-accent"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="60 40"/></svg></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center text-center pt-20 space-y-4">
                <div className="w-14 h-14 rounded-full bg-red-400/10 flex items-center justify-center">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <p className="text-sm text-red-400 font-medium">{error}</p>
              </div>
            ) : activeUser ? (
              <motion.div
                key={activeUser.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative w-full h-[500px] rounded-xl overflow-hidden shadow-2xl bg-surface-container group"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${activeUser.avatar})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-95" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tight text-white leading-none">{activeUser.name}</h2>
                    <p className="text-primary-accent font-bold text-lg">{activeUser.role} @ {activeUser.company}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeUser.tags?.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-surface-container-highest/90 backdrop-blur-md rounded-full text-xs font-bold text-on-surface-variant">{tag}</span>
                    ))}
                  </div>
                  <p className="text-white/80 text-sm line-clamp-2 font-medium">{activeUser.bio || "No bio provided."}</p>
                  <div className="pt-4 flex items-center justify-between gap-4">
                    <button onClick={handleRemove} className="w-14 h-14 rounded-full bg-surface-container-highest/40 backdrop-blur-xl border border-white/5 flex items-center justify-center active:scale-90 transition-all">
                      <X className="w-7 h-7 text-red-400" />
                    </button>
                    <Button onClick={() => navigate(`/chat/${activeUser.id}`)} className="flex-1 py-4 text-sm uppercase tracking-widest">OFFER</Button>
                    <button onClick={handleStar} className="w-14 h-14 rounded-full bg-surface-container-highest/40 backdrop-blur-xl border border-white/5 flex items-center justify-center active:scale-90 transition-all">
                      <Star className="w-7 h-7 text-primary-accent" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center pt-20">
                <p className="text-on-surface-variant font-medium italic">No more catalysts found.</p>
                <Button onClick={() => setCurrentIndex(0)} className="mt-4 text-xs uppercase tracking-widest">Refresh</Button>
              </div>
            )}
          </div>
        </div>
        {/* Conversations column */}
        <div className="flex flex-col overflow-y-auto max-h-[calc(100vh-200px)]">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface/60 mb-6">Conversations</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 mb-6">
            {discoveryUsers.slice(0, 8).map((u) => (
              <div key={u.id} onClick={() => navigate(`/chat/${u.id}`)} className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform">
                <Avatar src={u.avatar} alt={u.name} size="lg" isOnline={(u as any).isOnline} hasStory />
                <span className="text-[10px] font-bold text-on-surface">{u.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {conversations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-on-surface-variant font-medium text-sm">No conversations yet.</p>
                <p className="text-on-surface-variant/60 text-xs mt-1">Start by sending an offer to someone.</p>
              </div>
            ) : conversations.map((conv: any) => (
              <div key={conv.id} onClick={() => navigate(`/chat/${conv.otherUser.id}`)} className="group relative p-4 rounded-xl bg-surface-container-low/40 hover:bg-surface-container transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <Avatar src={conv.otherUser.avatar} alt={conv.otherUser.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h3 className="font-bold text-on-surface truncate text-sm">{conv.otherUser.name}</h3>
                      <span className="text-[10px] font-bold text-on-surface/40">{conv.timestamp}</span>
                    </div>
                    <p className="text-xs text-on-surface/60 truncate">{conv.lastMessage}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: tabbed layout */}
      <AnimatePresence mode="wait">
        {activeTab === 'discovery' ? (
          <motion.div
            key="discovery"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 px-4 flex flex-col md:hidden"
          >
            {/* Discovery Card */}
            <div className="flex-1 relative flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-accent" />
                  <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest">Finding Catalysts...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-red-400/10 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-red-400" />
                  </div>
                  <p className="text-sm text-red-400 font-medium">{error}</p>
                </div>
              ) : activeUser ? (
                <>
                  <div className="absolute inset-x-8 top-4 h-[500px] bg-surface-container-highest/20 rounded-xl -rotate-2 transform scale-95 opacity-50" />
                  <div className="absolute inset-x-6 top-2 h-[500px] bg-surface-container-high/40 rounded-xl rotate-1 transform scale-98 opacity-70" />
                  
                  <motion.div 
                    key={activeUser.id}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="relative w-full max-w-md h-[550px] rounded-xl overflow-hidden shadow-2xl bg-surface-container group"
                  >
                    <div 
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                      style={{ backgroundImage: `url(${activeUser.avatar})` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-95" />
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h2 className="text-4xl font-black tracking-tight text-white leading-none drop-shadow-lg">{activeUser.name}</h2>
                          {activeUser.isVerified && (
                            <span className="bg-primary-accent/20 text-primary-accent px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">Verified</span>
                          )}
                        </div>
                        <p className="text-primary-accent font-bold text-lg drop-shadow-md">{activeUser.role} @ {activeUser.company}</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {activeUser.tags?.map(tag => (
                          <span key={tag} className="px-4 py-1.5 bg-surface-container-highest/90 backdrop-blur-md rounded-full text-xs font-bold text-on-surface-variant shadow-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      <p className="text-white/80 text-sm line-clamp-2 leading-relaxed font-medium drop-shadow-sm">
                        {activeUser.bio || "No bio provided."}
                      </p>

                      <div className="pt-4 flex items-center justify-between gap-4">
                        <button 
                          onClick={handleRemove}
                          className="w-16 h-16 rounded-full bg-surface-container-highest/40 backdrop-blur-xl border border-white/5 flex items-center justify-center group active:scale-90 transition-all"
                        >
                          <X className="w-8 h-8 text-red-400 transition-transform group-hover:scale-110" />
                        </button>
                        <Button 
                          onClick={() => navigate(`/chat/${activeUser.id}`)}
                          className="flex-1 py-4 text-sm uppercase tracking-widest"
                        >
                          OFFER
                        </Button>
                        <button 
                          onClick={handleStar}
                          className="w-16 h-16 rounded-full bg-surface-container-highest/40 backdrop-blur-xl border border-white/5 flex items-center justify-center group active:scale-90 transition-all"
                        >
                          <Star className="w-8 h-8 text-primary-accent transition-transform group-hover:scale-110" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-on-surface-variant font-medium italic">No more catalysts found in your area.</p>
                  <Button onClick={() => setCurrentIndex(0)} className="mt-4 text-xs uppercase tracking-widest">Refresh</Button>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="messages"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="px-6 space-y-12 md:hidden"
          >
            {/* Active Matches */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface/60">Active Matches</h2>
                <span className="text-[10px] font-bold text-primary-accent px-2 py-1 rounded bg-primary-accent/10">{discoveryUsers.length} ONLINE</span>
              </div>
              <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-2">
                {discoveryUsers.map((user) => (
                  <div 
                    key={user.id} 
                    onClick={() => navigate(`/chat/${user.id}`)}
                    className="flex-shrink-0 flex flex-col items-center gap-3 cursor-pointer active:scale-95 transition-transform"
                  >
                    <Avatar src={user.avatar} alt={user.name} size="xl" isOnline={user.isOnline} hasStory />
                    <span className="text-xs font-bold text-on-surface">{user.name.split(' ')[0]} {user.name.split(' ')[1]?.[0]}.</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Messages */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface/60">Recent Messages</h2>
                {!isMessageSearchOpen && (
                  <button onClick={() => setIsMessageSearchOpen(true)}>
                    <Search className="w-5 h-5 text-on-surface/40 hover:text-primary-accent transition-colors" />
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {(() => {
                  const displayConversations = conversations;

                  const filteredConversations = displayConversations.filter(conv => 
                    conv.otherUser.name.toLowerCase().includes(messageSearch.toLowerCase()) ||
                    conv.lastMessage.toLowerCase().includes(messageSearch.toLowerCase())
                  );

                  if (filteredConversations.length === 0) {
                    return (
                      <div className="text-center py-12 bg-surface-container-low/20 rounded-2xl border border-dashed border-white/5">
                        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mx-auto mb-4">
                          <Search className="w-6 h-6 text-on-surface-variant/40" />
                        </div>
                        <p className="text-on-surface-variant font-medium italic text-sm">
                          {messageSearch ? `No conversations found matching "${messageSearch}"` : 'No conversations yet. Start by sending an offer to someone.'}
                        </p>
                        {messageSearch && (
                        <button
                          onClick={() => setMessageSearch('')}
                          className="mt-4 text-xs font-black uppercase tracking-widest text-primary-accent hover:underline"
                        >
                          Clear Search
                        </button>
                        )}
                      </div>
                    );
                  }

                  return filteredConversations.map((conv) => (
                    <div 
                      key={conv.id} 
                      onClick={() => navigate(`/chat/${conv.otherUser.id}`)}
                      className={cn(
                        "group relative p-5 rounded-xl transition-all cursor-pointer",
                        conv.isUnread ? "bg-surface-container-low" : "bg-surface-container-low/40 hover:bg-surface-container"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative flex-shrink-0">
                          <Avatar src={conv.otherUser.avatar} alt={conv.otherUser.name} size="md" />
                          {conv.isUnread && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-accent rounded-full shadow-[0_0_12px_rgba(198,238,98,0.8)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className={cn("truncate", conv.isUnread ? "font-extrabold text-on-surface" : "font-bold text-on-surface")}>
                              {conv.otherUser.name}
                            </h3>
                            <span className={cn("text-[10px] font-bold uppercase", conv.isUnread ? "text-primary-accent" : "text-on-surface/40")}>
                              {conv.timestamp}
                            </span>
                          </div>
                          <p className={cn("text-sm leading-tight truncate", conv.isUnread ? "font-bold text-on-surface" : "text-on-surface/60")}>
                            {conv.lastMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-surface-container-low rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-black tracking-tight text-white">Filters</h3>
                <button onClick={() => setIsFilterModalOpen(false)} className="text-on-surface-variant hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Role Filter */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Role</label>
                  <input 
                    type="text"
                    value={filters.role}
                    onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g. Director, Architect..."
                    className="w-full bg-surface-container rounded-2xl py-4 px-5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary-accent outline-none transition-all"
                  />
                </div>

                {/* Company Filter */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Company</label>
                  <input 
                    type="text"
                    value={filters.company}
                    onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="e.g. Decarb Global, EcoLogix..."
                    className="w-full bg-surface-container rounded-2xl py-4 px-5 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-primary-accent outline-none transition-all"
                  />
                </div>

                {/* Tags Filter */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Interests & Expertise</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map(tag => {
                      const isSelected = filters.selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            setFilters(prev => ({
                              ...prev,
                              selectedTags: isSelected 
                                ? prev.selectedTags.filter(t => t !== tag)
                                : [...prev.selectedTags, tag]
                            }));
                          }}
                          className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold transition-all",
                            isSelected 
                              ? "bg-primary-accent text-on-primary-accent shadow-lg scale-105" 
                              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-highest"
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 shrink-0 bg-surface-container-low flex gap-4">
                <Button 
                  variant="outline"
                  onClick={() => setFilters({ role: '', company: '', selectedTags: [] })}
                  className="flex-1 rounded-full text-xs uppercase tracking-widest"
                >
                  Reset
                </Button>
                <Button 
                  onClick={() => setIsFilterModalOpen(false)}
                  className="flex-1 rounded-full text-xs uppercase tracking-widest"
                >
                  Apply Filters
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

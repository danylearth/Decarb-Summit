import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Avatar, Button } from '../components/UI';
import { ArrowLeft, Settings, MessageSquare, Plus, CheckCircle2, Linkedin, Twitter, Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '../types';

export function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useUser();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const targetUserId = userId || currentUser?.id;
  const isOwnProfile = targetUserId === currentUser?.id;

  useEffect(() => {
    if (isOwnProfile || !targetUserId) return;
    setProfileLoading(true);
    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          setProfileUser({ id: userDoc.id, ...userDoc.data() } as User);
        } else {
          setNotFound(true);
        }
      } catch (err) {
        setProfileError('Failed to load profile. Please try again.');
        setProfileLoading(false);
        handleFirestoreError(err, OperationType.GET, `users/${targetUserId}`);
        return;
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [targetUserId, isOwnProfile]);

  const user = isOwnProfile ? currentUser : profileUser;

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-accent" />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-sm text-red-400 font-medium">{profileError}</p>
        <Button onClick={() => navigate(-1)} variant="outline" className="rounded-full">Go Back</Button>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-on-surface-variant font-medium">User not found.</p>
        <Button onClick={() => navigate(-1)} variant="outline" className="rounded-full">Go Back</Button>
      </div>
    );
  }

  if (!user) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background pb-32 pt-12"
    >
      <main className="px-6 max-w-4xl mx-auto">
        {/* Back Button - Floating or Simple */}
        <button 
          onClick={() => navigate(-1)} 
          className="mb-8 p-2 hover:bg-surface-container rounded-full transition-colors inline-flex items-center gap-2 text-on-surface-variant/60 hover:text-on-surface"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>

        {/* Profile Hero */}
        <section className="flex flex-col md:flex-row md:items-start md:gap-12 items-center text-center md:text-left mb-10">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative mb-6"
          >
            <Avatar src={user.avatar} alt={user.name} size="2xl" className="shadow-2xl" />
            {user.isVerified && (
              <div className="absolute bottom-2 right-2 bg-primary-accent text-on-primary-accent p-1 rounded-full shadow-lg z-20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-3xl font-black tracking-tighter text-white mb-1">{user.name}</h2>
            <p className="text-primary-accent font-bold uppercase tracking-widest text-xs mb-4">{user.role} @ {user.company}</p>

            <div className="mb-8" />

            <div className="flex gap-3 w-full max-w-xs mx-auto md:mx-0">
              {!isOwnProfile ? (
                <Button 
                  onClick={() => navigate(`/chat/${user.id}`)}
                  className="flex-1 rounded-full gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  OFFER
                </Button>
              ) : (
                <Button 
                  onClick={() => navigate('/profile/settings')}
                  variant="outline"
                  className="flex-1 rounded-full gap-2 border-primary-accent/30 text-primary-accent"
                >
                  <Settings className="w-4 h-4" />
                  SETTINGS
                </Button>
              )}
            </div>
          </motion.div>
        </section>

        {/* Bio & Details */}
        <motion.section 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-8"
        >
          <div className="text-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">About</h3>
            <p className="text-on-surface-variant leading-relaxed text-sm font-medium max-w-lg mx-auto">
              {user.bio || "No bio provided yet. This catalyst is busy decarbonizing the world."}
            </p>
          </div>

          <div className="text-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">Expertise</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {(user.tags || ['Decarbonization', 'Industrial Tech', 'Sustainability']).map(tag => (
                <span key={tag} className="px-4 py-2 bg-surface-container rounded-full text-[10px] font-bold uppercase tracking-widest text-on-surface border border-white/5">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {(user.linkedin || user.twitter) && (
            <div className="text-center">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4">Social</h3>
              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                {user.linkedin && (
                  <a 
                    href={user.linkedin.startsWith('http') ? user.linkedin : `https://${user.linkedin}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 p-4 bg-surface-container-low rounded-xl border border-white/5 hover:bg-surface-container transition-colors"
                  >
                    <Linkedin className="w-5 h-5 text-primary-accent" />
                    <span className="text-xs font-bold text-on-surface">LinkedIn</span>
                  </a>
                )}
                {user.twitter && (
                  <a 
                    href={user.twitter.startsWith('http') ? user.twitter : `https://${user.twitter}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 p-4 bg-surface-container-low rounded-xl border border-white/5 hover:bg-surface-container transition-colors"
                  >
                    <Twitter className="w-5 h-5 text-primary-accent" />
                    <span className="text-xs font-bold text-on-surface">X</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </motion.section>
      </main>
    </motion.div>
  );
}

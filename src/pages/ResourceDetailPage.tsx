import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, query, limit, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Resource } from '../types';
import { Button, Card, cn } from '../components/UI';
import { ArrowLeft, Play, Share2, Clock, Calendar, User, Bookmark, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUser } from '../context/UserContext';

export function ResourceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const [resource, setResource] = useState<Resource | null>(null);
  const [related, setRelated] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    
    // Scroll to top when ID changes
    window.scrollTo(0, 0);

    const fetchResource = async () => {
      try {
        const docRef = doc(db, 'resources', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setResource({ id: docSnap.id, ...docSnap.data() } as Resource);
        }
      } catch (err) {
        setError('Failed to load resource. Please try again.');
        setLoading(false);
        handleFirestoreError(err, OperationType.GET, `resources/${id}`);
        return;
      }
      setLoading(false);
    };

    fetchResource();

    // Check if saved
    const savedRef = doc(db, 'users', user.id, 'saved_resources', id);
    const unsubSaved = onSnapshot(savedRef, (doc) => {
      setIsSaved(doc.exists());
    }, () => {
      // Non-critical: silently fail save status check
    });

    // Fetch related
    const q = query(collection(db, 'resources'), limit(3));
    const unsubRelated = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Resource))
        .filter(r => r.id !== id);
      setRelated(data);
    }, () => {
      // Non-critical: silently fail related resources
    });

    return () => {
      unsubSaved();
      unsubRelated();
    };
  }, [id, user]);

  const handleSave = async () => {
    if (!user || !id) return;
    try {
      const savedRef = doc(db, 'users', user.id, 'saved_resources', id);
      if (isSaved) {
        await deleteDoc(savedRef);
      } else {
        await setDoc(savedRef, {
          resourceId: id,
          savedAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}/saved_resources/${id}`);
    }
  };

  const handleShare = async () => {
    if (!resource) return;
    const shareData = {
      title: `Decarb Connect: ${resource.title}`,
      text: resource.description,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 3000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-sm text-red-400 font-medium">{error}</p>
        <Button onClick={() => navigate('/resources')}>Back to Resources</Button>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-4 text-white">Resource Not Found</h1>
        <Button onClick={() => navigate('/resources')}>Back to Resources</Button>
      </div>
    );
  }

  const isVideo = resource.type === 'Video';

  return (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-32"
    >
      {/* Hero Section */}
      <section className="relative h-[60vh] min-h-[400px] w-full overflow-hidden">
        <img 
          src={resource.image} 
          alt={resource.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        
        <div className="absolute top-12 left-6 z-30">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-background/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform hover:bg-background/40"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-0 left-0 w-full p-6 z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-primary-accent text-on-primary-accent text-[10px] font-black uppercase tracking-widest">
                {resource.type}
              </span>
              <div className="flex items-center gap-2 text-white/60 text-xs font-medium">
                <Clock className="w-3 h-3" />
                <span>{resource.duration || '12 min read'}</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-[0.9] text-white mb-6">
              {resource.title}
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-white/10">
                  <img src={`https://picsum.photos/seed/${resource.author}/100/100`} alt={resource.author} className="w-full h-full object-cover" />
                </div>
                <span className="text-sm font-bold text-white">{resource.author}</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <Calendar className="w-3 h-3" />
                <span>March 15, 2026</span>
              </div>
            </div>
          </div>
        </div>

        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-20 h-20 rounded-full bg-primary-accent text-on-primary-accent flex items-center justify-center shadow-2xl shadow-primary-accent/40 pointer-events-auto"
            >
              <Play className="w-8 h-8 fill-current ml-1" />
            </motion.button>
          </div>
        )}
      </section>

      {/* Content Section */}
      <section className="max-w-2xl mx-auto px-6 mt-12">
        <div className="flex items-center justify-between mb-10 pb-6 border-b border-white/5">
          <div className="flex gap-2">
            <Button 
              variant={isSaved ? "primary" : "outline"} 
              size="sm" 
              className={cn("rounded-full", isSaved && "bg-primary-accent text-on-primary-accent border-primary-accent")}
              onClick={handleSave}
            >
              <Bookmark className={cn("w-4 h-4", isSaved && "fill-current")} />
              {isSaved ? 'Saved' : 'Save'}
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showShareToast && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 bg-primary-accent text-on-primary-accent px-6 py-3 rounded-full shadow-2xl flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-widest">Link copied to clipboard</span>
            </motion.div>
          )}
        </AnimatePresence>

        <article className="prose prose-invert prose-p:text-on-surface-variant prose-p:leading-relaxed prose-headings:font-black prose-headings:tracking-tight">
          <p className="text-lg text-on-surface-variant leading-relaxed whitespace-pre-line">
            {resource.description}
          </p>
        </article>

        {/* Related Resources */}
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant/60">Related Insights</h3>
            <div className="h-px flex-1 ml-4 bg-white/5" />
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {related.map(r => (
              <motion.div
                key={r.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card 
                  className="flex gap-4 p-3 cursor-pointer hover:bg-surface-container transition-colors group"
                  onClick={() => navigate(`/resources/${r.id}`)}
                >
                  <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0">
                    <img src={r.image} alt={r.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-accent mb-1">{r.type}</span>
                    <h4 className="text-sm font-bold leading-tight mb-2">{r.title}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-on-surface-variant/60">
                      <User className="w-3 h-3" />
                      <span>{r.author}</span>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center">
                    <ChevronRight className="w-5 h-5 text-on-surface-variant/20 group-hover:text-primary-accent transition-colors" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </motion.main>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Resource } from '../types';
import { Card } from '../components/UI';
import { Play, Download, FileText, BarChart3, Clock, ChevronRight, Search, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function ResourcesPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = collection(db, 'resources');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setResources([]);
        setLoading(false);
        return;
      }
      const resourcesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Resource[];
      setResources(resourcesData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'resources');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredResources = resources.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const videoMasterclasses = filteredResources.filter(r => r.type === 'Video');
  const industryReports = filteredResources.filter(r => r.type === 'Report');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.main 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="px-6 pt-12 pb-32 max-w-5xl mx-auto"
    >
      <header className="mb-10 flex justify-between items-start h-24">
        <AnimatePresence mode="wait">
          {isSearchOpen ? (
            <motion.div 
              key="search-input"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '100%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-1 mr-4 relative mt-4"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search resources..."
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
              <span className="text-primary-accent font-bold text-[10px] tracking-[0.2em] uppercase">KNOWLEDGE ECOSYSTEM</span>
              <h1 className="text-5xl md:text-6xl font-extrabold tracking-tighter mt-2 leading-tight text-white">
                Resources
              </h1>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => {
            setIsSearchOpen(!isSearchOpen);
            if (isSearchOpen) setSearchQuery('');
          }}
          className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center cursor-pointer hover:bg-surface-container-highest transition-colors shrink-0 mt-4"
        >
          {isSearchOpen ? (
            <X className="w-5 h-5 text-primary-accent" />
          ) : (
            <Search className="w-5 h-5 text-primary-accent" />
          )}
        </button>
      </header>

      <section className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold tracking-tight text-white">Video Masterclasses</h2>
          <span className="text-primary-accent text-sm font-medium cursor-pointer">View all</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videoMasterclasses.map((video) => (
            <div 
              key={video.id} 
              onClick={() => navigate(`/resources/${video.id}`)}
              className="group relative overflow-hidden bg-surface-container-low rounded-xl aspect-[16/10] flex flex-col justify-end p-6 border border-white/5 cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10" />
              <img 
                src={video.image} 
                alt={video.title} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="relative z-20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-primary-accent/20 backdrop-blur-md text-primary-accent px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase">
                    {video.category}
                  </span>
                  <span className="text-white/60 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {video.duration}
                  </span>
                </div>
                <h3 className="text-2xl font-bold leading-tight mb-2 group-hover:text-primary-accent transition-colors text-white">{video.title}</h3>
                <p className="text-on-surface-variant text-sm line-clamp-2">{video.description}</p>
              </div>
              <div className="absolute top-6 right-6 z-20 bg-primary-accent text-on-primary-accent w-12 h-12 rounded-full flex items-center justify-center shadow-lg">
                <Play className="w-5 h-5 fill-current" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-bold tracking-tight mb-6 text-white">Industry Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {industryReports.map((report) => (
            <div 
              key={report.id} 
              onClick={() => navigate(`/resources/${report.id}`)}
              className="bg-surface-container-low p-5 rounded-2xl flex items-center gap-6 group hover:bg-surface-container transition-all cursor-pointer border border-white/5"
            >
              <div className="w-16 h-20 bg-surface-container-highest rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary-accent group-hover:text-on-primary-accent transition-colors">
                <FileText className="w-8 h-8" />
              </div>
              <div className="flex-grow">
                <div className="text-[10px] text-primary-accent font-bold tracking-widest uppercase mb-1">{report.category}</div>
                <h4 className="text-lg font-bold leading-tight text-white">{report.title}</h4>
                <p className="text-on-surface-variant text-sm mt-1">{report.description}</p>
              </div>
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-primary-accent hover:text-on-primary-accent hover:border-transparent transition-all">
                <Download className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {resources.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-16 h-16 rounded-full bg-primary-accent/10 flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-primary-accent" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Resources Yet</h2>
          <p className="text-on-surface-variant text-sm max-w-xs">
            Resources will appear here once they're published. Check back soon for video masterclasses and industry reports.
          </p>
        </div>
      )}
    </motion.main>
  );
}

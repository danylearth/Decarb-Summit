import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card } from '../components/UI';
import { ArrowLeft, Save, User, Mail, Briefcase, Building2, AlignLeft, Linkedin, Twitter } from 'lucide-react';
import { motion } from 'motion/react';

export function PersonalInfoPage() {
  const { user, updateUser, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: 'alex.sterling@decarb.global', // Mock email
    role: user?.role || '',
    company: user?.company || '',
    avatar: user?.avatar || '',
    bio: user?.bio || 'Passionate about driving industrial decarbonization through innovative CCUS solutions.',
    linkedin: user?.linkedin || '',
    twitter: user?.twitter || '',
  });
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      navigate('/onboarding');
    }
  }, [user, userLoading, navigate]);

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSave = () => {
    updateUser({
      name: formData.name,
      role: formData.role,
      company: formData.company,
      avatar: formData.avatar,
      bio: formData.bio,
      linkedin: formData.linkedin,
      twitter: formData.twitter,
    });
    navigate('/profile');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setFormData(prev => ({ ...prev, avatar: base64 }));
        // Save immediately as requested
        setIsAvatarSaving(true);
        try {
          await updateUser({ avatar: base64 });
        } catch (err) {
          console.error('Failed to save avatar:', err);
        } finally {
          setIsAvatarSaving(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.main 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-md mx-auto px-6 pt-12 pb-32"
    >
      <header className="flex items-center gap-4 mb-10">
        <button onClick={() => navigate('/profile')} className="text-on-surface active:scale-95 transition-transform">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Personal Information</h1>
      </header>

      <div className="space-y-6">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary-accent/20 group-hover:border-primary-accent transition-colors">
              <img src={formData.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                {isAvatarSaving ? 'Saving...' : 'Change'}
              </span>
              <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={isAvatarSaving} />
            </label>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Profile Picture</p>
        </div>

        <Card className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary-accent">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                type="text" 
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary-accent outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary-accent">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                type="email" 
                value={formData.email}
                readOnly
                className="w-full bg-surface-container-lowest/50 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm text-on-surface-variant/60 outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary-accent">Role</label>
            <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                type="text" 
                value={formData.role}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary-accent outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary-accent">Company</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                type="text" 
                value={formData.company}
                onChange={e => setFormData(prev => ({ ...prev, company: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary-accent outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary-accent">Bio</label>
            <div className="relative">
              <AlignLeft className="absolute left-4 top-4 w-4 h-4 text-on-surface-variant/40" />
              <textarea 
                rows={4}
                value={formData.bio}
                onChange={e => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary-accent outline-none resize-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary-accent">LinkedIn Profile</label>
            <div className="relative">
              <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                type="text" 
                placeholder="https://linkedin.com/in/..."
                value={formData.linkedin}
                onChange={e => setFormData(prev => ({ ...prev, linkedin: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary-accent outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-primary-accent">X (Twitter) Profile</label>
            <div className="relative">
              <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
              <input 
                type="text" 
                placeholder="https://x.com/..."
                value={formData.twitter}
                onChange={e => setFormData(prev => ({ ...prev, twitter: e.target.value }))}
                className="w-full bg-surface-container-lowest border border-white/5 rounded-xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary-accent outline-none"
              />
            </div>
          </div>
        </Card>

        <Button onClick={handleSave} className="w-full py-4">
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>
    </motion.main>
  );
}

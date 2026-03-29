import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card } from '../components/UI';
import { motion, AnimatePresence } from 'motion/react';
import { User, Briefcase, Hash, CheckCircle, ArrowRight, ArrowLeft, Share2, Linkedin, Twitter } from 'lucide-react';

const STEPS = [
  { id: 'profile', title: 'Profile Basics', icon: User },
  { id: 'professional', title: 'Professional Context', icon: Briefcase },
  { id: 'social', title: 'Social Presence', icon: Share2 },
  { id: 'interests', title: 'Interests', icon: Hash },
  { id: 'complete', title: 'All Set!', icon: CheckCircle },
];

const INTEREST_TAGS = [
  'Carbon Capture', 'Renewable Energy', 'Circular Economy', 
  'Green Finance', 'Policy & Regulation', 'Sustainable Transport',
  'ESG Reporting', 'Nature-based Solutions', 'Hydrogen'
];

export function OnboardingPage({ onComplete }: { onComplete?: () => void }) {
  const { user, updateUser } = useUser();
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = sessionStorage.getItem('onboarding_step');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isFinishing, setIsFinishing] = useState(false);
  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem('onboarding_form');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      name: user?.name || '',
      handle: user?.handle || '',
      role: user?.role || '',
      company: user?.company || '',
      bio: user?.bio || '',
      tags: user?.tags || [] as string[],
      linkedin: user?.linkedin || '',
      twitter: user?.twitter || '',
    };
  });

  // Persist step and form data to survive remounts
  const updateStep = (step: number) => {
    setCurrentStep(step);
    sessionStorage.setItem('onboarding_step', String(step));
  };

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => {
      const next = { ...prev, ...updates };
      sessionStorage.setItem('onboarding_form', JSON.stringify(next));
      return next;
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      updateStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      updateStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    const dataToSave = { ...formData, onboarded: true };
    console.log('[Onboarding] Saving data:', JSON.stringify(dataToSave));
    try {
      await updateUser(dataToSave);
      console.log('[Onboarding] Save complete, transitioning...');
      sessionStorage.removeItem('onboarding_step');
      sessionStorage.removeItem('onboarding_form');
      onComplete?.();
    } catch (err) {
      console.error('[Onboarding] Save FAILED:', err);
      setIsFinishing(false);
    }
  };

  const handleSkip = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await updateUser({
        onboarded: true,
      });
      sessionStorage.removeItem('onboarding_step');
      sessionStorage.removeItem('onboarding_form');
      onComplete?.();
    } catch (err) {
      console.error('Error skipping onboarding:', err);
      setIsFinishing(false);
    }
  };

  const toggleTag = (tag: string) => {
    const newTags = formData.tags.includes(tag)
      ? formData.tags.filter((t: string) => t !== tag)
      : [...formData.tags, tag];
    updateFormData({ tags: newTags });
  };

  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="flex justify-end mb-4">
          <button 
            onClick={handleSkip}
            className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 hover:text-primary-accent transition-colors"
          >
            Skip Onboarding
          </button>
        </div>
        {/* Progress Bar */}
        <div className="flex gap-2 mb-12">
          {STEPS.map((s, idx) => (
            <div 
              key={s.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx <= currentStep ? 'bg-primary-accent' : 'bg-surface-container-highest'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-8 md:p-12 border-white/5 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-primary-accent/10 flex items-center justify-center text-primary-accent">
                  <step.icon className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white">{step.title}</h1>
                  <p className="text-on-surface-variant text-sm">Step {currentStep + 1} of {STEPS.length}</p>
                </div>
              </div>

              {step.id === 'profile' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Full Name</label>
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={e => updateFormData({ name: e.target.value })}
                      className="w-full bg-surface-container-highest border-none rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all"
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Handle</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">@</span>
                      <input 
                        type="text"
                        value={formData.handle}
                        onChange={e => updateFormData({ handle: e.target.value })}
                        className="w-full bg-surface-container-highest border-none rounded-xl p-4 pl-8 text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all"
                        placeholder="username"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step.id === 'professional' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Role</label>
                    <input 
                      type="text"
                      value={formData.role}
                      onChange={e => updateFormData({ role: e.target.value })}
                      className="w-full bg-surface-container-highest border-none rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all"
                      placeholder="e.g. Sustainability Lead"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Company</label>
                    <input 
                      type="text"
                      value={formData.company}
                      onChange={e => updateFormData({ company: e.target.value })}
                      className="w-full bg-surface-container-highest border-none rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all"
                      placeholder="e.g. CarbonZero Inc."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Bio</label>
                    <textarea 
                      value={formData.bio}
                      onChange={e => updateFormData({ bio: e.target.value })}
                      className="w-full bg-surface-container-highest border-none rounded-xl p-4 text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all h-32 resize-none"
                      placeholder="Tell the community about your mission..."
                    />
                  </div>
                </div>
              )}

              {step.id === 'social' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">LinkedIn Profile</label>
                    <div className="relative">
                      <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input 
                        type="text"
                        value={formData.linkedin}
                        onChange={e => updateFormData({ linkedin: e.target.value })}
                        className="w-full bg-surface-container-highest border-none rounded-xl p-4 pl-12 text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all"
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">X (Twitter) Profile</label>
                    <div className="relative">
                      <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/40" />
                      <input 
                        type="text"
                        value={formData.twitter}
                        onChange={e => updateFormData({ twitter: e.target.value })}
                        className="w-full bg-surface-container-highest border-none rounded-xl p-4 pl-12 text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all"
                        placeholder="https://x.com/..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {step.id === 'interests' && (
                <div className="space-y-6">
                  <p className="text-on-surface-variant text-sm mb-4">Select topics or add your own to personalize your feed.</p>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_TAGS.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                          formData.tags.includes(tag)
                            ? 'bg-primary-accent border-primary-accent text-on-primary-accent'
                            : 'bg-surface-container-highest border-white/5 text-on-surface-variant hover:border-primary-accent/50'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                    {/* Custom tags added by user */}
                    {formData.tags.filter((t: string) => !INTEREST_TAGS.includes(t)).map((tag: string) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className="px-4 py-2 rounded-full text-xs font-bold transition-all border bg-primary-accent border-primary-accent text-on-primary-accent"
                      >
                        {tag} ×
                      </button>
                    ))}
                  </div>
                  {/* Custom tag input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Add Custom Skill</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Battery Storage"
                        className="flex-1 bg-surface-container-highest border-none rounded-xl p-3 text-sm text-on-surface focus:ring-2 focus:ring-primary-accent outline-none transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val && !formData.tags.includes(val)) {
                              updateFormData({ tags: [...formData.tags, val] });
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                          const val = input.value.trim();
                          if (val && !formData.tags.includes(val)) {
                            updateFormData({ tags: [...formData.tags, val] });
                            input.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-primary-accent text-on-primary-accent rounded-xl text-xs font-bold uppercase tracking-widest"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step.id === 'complete' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-primary-accent/10 rounded-full flex items-center justify-center text-primary-accent mx-auto mb-6">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white mb-2">You're ready to go!</h2>
                  <p className="text-on-surface-variant">Welcome to the Decarb community. Your profile is set up and ready for networking.</p>
                </div>
              )}

              <div className="flex items-center justify-between mt-12">
                <button 
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-opacity ${
                    currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-on-surface-variant hover:text-white'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <Button 
                  onClick={handleNext}
                  disabled={isFinishing}
                  className="rounded-full px-8 flex items-center gap-2"
                >
                  {isFinishing ? (
                    <div className="w-4 h-4 border-2 border-on-primary-accent border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {currentStep === STEPS.length - 1 ? 'Finish' : 'Next'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

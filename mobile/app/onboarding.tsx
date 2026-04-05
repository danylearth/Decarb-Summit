import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '../context/UserContext';

const STEPS = ['Profile Basics', 'Professional Context', 'Social Presence', 'Interests', 'All Set!'];

const INTEREST_TAGS = [
  'Carbon Capture', 'Renewable Energy', 'Circular Economy',
  'Green Finance', 'Policy & Regulation', 'Sustainable Transport',
  'ESG Reporting', 'Nature-based Solutions', 'Hydrogen',
];

export default function OnboardingScreen() {
  const { user, updateUser } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: user?.name || '',
    handle: user?.handle || '',
    role: user?.role || '',
    company: user?.company || '',
    bio: user?.bio || '',
    tags: (user?.tags || []) as string[],
    linkedin: user?.linkedin || '',
    twitter: user?.twitter || '',
  });

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleTag = (tag: string) => {
    update('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await updateUser({ ...form, onboarded: true });
      router.replace('/');
    } catch {
      setError('Failed to save profile. Please try again.');
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateUser({ onboarded: true });
      router.replace('/');
    } catch {
      setError('Failed to complete setup.');
      setSaving(false);
    }
  };

  const inputClass = 'bg-surface-container-highest rounded-xl p-4 text-on-surface text-sm';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View className="w-full max-w-xl self-center">
          {/* Skip */}
          <View className="items-end mb-4">
            <Pressable onPress={handleSkip}>
              <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">
                Skip Onboarding
              </Text>
            </Pressable>
          </View>

          {/* Progress */}
          <View className="flex-row gap-2 mb-10">
            {STEPS.map((_, i) => (
              <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary-accent' : 'bg-surface-container-highest'}`} />
            ))}
          </View>

          {/* Card */}
          <View className="bg-surface-container-low rounded-3xl border border-white/5 p-8">
            <Text className="text-2xl font-black tracking-tight text-white mb-1">{STEPS[step]}</Text>
            <Text className="text-on-surface-variant text-sm mb-8">Step {step + 1} of {STEPS.length}</Text>

            {step === 0 && (
              <View className="gap-5">
                <View className="gap-2">
                  <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">Full Name</Text>
                  <TextInput value={form.name} onChangeText={v => update('name', v)} placeholder="e.g. Jane Doe" placeholderTextColor="rgba(148,163,184,0.4)" className={inputClass} />
                </View>
                <View className="gap-2">
                  <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">Handle</Text>
                  <TextInput value={form.handle} onChangeText={v => update('handle', v)} placeholder="username" placeholderTextColor="rgba(148,163,184,0.4)" autoCapitalize="none" className={inputClass} />
                </View>
              </View>
            )}

            {step === 1 && (
              <View className="gap-5">
                <View className="gap-2">
                  <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">Role</Text>
                  <TextInput value={form.role} onChangeText={v => update('role', v)} placeholder="e.g. Sustainability Lead" placeholderTextColor="rgba(148,163,184,0.4)" className={inputClass} />
                </View>
                <View className="gap-2">
                  <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">Company</Text>
                  <TextInput value={form.company} onChangeText={v => update('company', v)} placeholder="e.g. CarbonZero Inc." placeholderTextColor="rgba(148,163,184,0.4)" className={inputClass} />
                </View>
                <View className="gap-2">
                  <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">Bio</Text>
                  <TextInput value={form.bio} onChangeText={v => update('bio', v)} placeholder="Tell the community about your mission..." placeholderTextColor="rgba(148,163,184,0.4)" multiline numberOfLines={4} className={`${inputClass} min-h-[120px]`} textAlignVertical="top" />
                </View>
              </View>
            )}

            {step === 2 && (
              <View className="gap-5">
                <View className="gap-2">
                  <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">LinkedIn Profile</Text>
                  <TextInput value={form.linkedin} onChangeText={v => update('linkedin', v)} placeholder="https://linkedin.com/in/..." placeholderTextColor="rgba(148,163,184,0.4)" autoCapitalize="none" className={inputClass} />
                </View>
                <View className="gap-2">
                  <Text className="text-on-surface-variant/60 text-[10px] font-black uppercase tracking-widest">X (Twitter) Profile</Text>
                  <TextInput value={form.twitter} onChangeText={v => update('twitter', v)} placeholder="https://x.com/..." placeholderTextColor="rgba(148,163,184,0.4)" autoCapitalize="none" className={inputClass} />
                </View>
              </View>
            )}

            {step === 3 && (
              <View className="gap-5">
                <Text className="text-on-surface-variant text-sm">Select topics to personalize your feed.</Text>
                <View className="flex-row flex-wrap gap-2">
                  {INTEREST_TAGS.map(tag => (
                    <Pressable key={tag} onPress={() => toggleTag(tag)}
                      className={`px-4 py-2 rounded-full border ${form.tags.includes(tag) ? 'bg-primary-accent border-primary-accent' : 'bg-surface-container-highest border-white/5'}`}
                    >
                      <Text className={`text-xs font-bold ${form.tags.includes(tag) ? 'text-background' : 'text-on-surface-variant'}`}>{tag}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {step === 4 && (
              <View className="items-center py-8">
                <View className="w-20 h-20 bg-primary-accent/10 rounded-full items-center justify-center mb-6">
                  <Text className="text-primary-accent text-4xl">✓</Text>
                </View>
                <Text className="text-2xl font-black tracking-tight text-white mb-2">You're ready to go!</Text>
                <Text className="text-on-surface-variant text-center">Welcome to the Decarb community.</Text>
              </View>
            )}

            {error ? <Text className="text-red-400 text-xs text-center mt-4">{error}</Text> : null}

            {/* Navigation */}
            <View className="flex-row items-center justify-between mt-10">
              {step > 0 ? (
                <Pressable onPress={() => setStep(step - 1)}>
                  <Text className="text-on-surface-variant text-xs font-black uppercase tracking-widest">Back</Text>
                </Pressable>
              ) : <View />}
              <Pressable onPress={handleNext} disabled={saving} className="bg-primary-accent rounded-full px-8 py-3 active:opacity-80">
                <Text className="text-background text-xs font-black uppercase tracking-widest">
                  {saving ? 'Saving...' : step === STEPS.length - 1 ? 'Finish' : 'Next'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

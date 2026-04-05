import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useUser } from '../context/UserContext';

export default function LoginScreen() {
  const { signIn, signInWithLinkedIn, signInWithMagicLink, signInDemo } = useUser();
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setMagicLinkLoading(true);
    setError('');
    try {
      await signInWithMagicLink(email.trim());
      setMagicLinkSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center items-center px-8">
          {/* Logo */}
          <View className="items-center mb-12">
            <Text
              style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 48, letterSpacing: -2, color: '#c6ee62' }}
            >
              DECARB
            </Text>
            <Text
              style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 16, color: '#94a3b8', marginTop: 12, textAlign: 'center', letterSpacing: 0.5 }}
            >
              The exclusive network for industrial decarbonization leaders.
            </Text>
          </View>

          {/* Auth buttons */}
          <View className="w-full max-w-sm" style={{ gap: 16 }}>
            {/* Google */}
            <Pressable
              onPress={signIn}
              className="w-full rounded-full items-center justify-center active:scale-95"
              style={{
                backgroundColor: '#c6ee62',
                paddingVertical: 18,
                shadowColor: '#c6ee62',
                shadowOffset: { width: 0, height: 20 },
                shadowOpacity: 0.3,
                shadowRadius: 40,
              }}
            >
              <Text
                style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: '#1a2e05', letterSpacing: 3, textTransform: 'uppercase' }}
              >
                Continue with Google
              </Text>
            </Pressable>

            {/* LinkedIn */}
            <Pressable
              onPress={signInWithLinkedIn}
              className="w-full rounded-full items-center justify-center active:scale-95"
              style={{
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                paddingVertical: 18,
              }}
            >
              <Text
                style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: '#e2e8f0', letterSpacing: 3, textTransform: 'uppercase' }}
              >
                Continue with LinkedIn
              </Text>
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center" style={{ gap: 16, paddingVertical: 8 }}>
              <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <Text
                style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: 'rgba(148,163,184,0.5)', letterSpacing: 4, textTransform: 'uppercase' }}
              >
                or
              </Text>
              <View className="flex-1" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </View>

            {magicLinkSent ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(198,238,98,0.2)',
                  backgroundColor: 'rgba(198,238,98,0.05)',
                  borderRadius: 16,
                  padding: 24,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#e2e8f0' }}>
                  Check your email
                </Text>
                <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 20 }}>
                  We sent a sign-in link to{' '}
                  <Text style={{ color: '#e2e8f0', fontFamily: 'PlusJakartaSans_500Medium' }}>{email}</Text>
                </Text>
                <Pressable onPress={() => { setMagicLinkSent(false); setEmail(''); }}>
                  <Text
                    style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#c6ee62', letterSpacing: 2, textTransform: 'uppercase', marginTop: 8 }}
                  >
                    Use a different email
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(148,163,184,0.5)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{
                    fontFamily: 'PlusJakartaSans_400Regular',
                    fontSize: 14,
                    color: '#e2e8f0',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    backgroundColor: '#080e3d',
                    borderRadius: 999,
                    paddingHorizontal: 24,
                    paddingVertical: 16,
                  }}
                />
                {error ? (
                  <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</Text>
                ) : null}
                <Pressable
                  onPress={handleMagicLink}
                  disabled={magicLinkLoading}
                  className="w-full rounded-full items-center justify-center active:scale-95"
                  style={{
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    paddingVertical: 18,
                  }}
                >
                  {magicLinkLoading ? (
                    <ActivityIndicator size="small" color="#c6ee62" />
                  ) : (
                    <Text
                      style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: '#e2e8f0', letterSpacing: 3, textTransform: 'uppercase' }}
                    >
                      Sign in with Email
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* Demo Mode */}
          <Pressable onPress={signInDemo} className="items-center active:opacity-80" style={{ marginTop: 32, paddingVertical: 16 }}>
            <Text
              style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: '#c6ee62', letterSpacing: 3, textTransform: 'uppercase' }}
            >
              Enter Demo Mode
            </Text>
            <Text
              style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 10, color: 'rgba(148,163,184,0.4)', marginTop: 4 }}
            >
              Explore the app with sample data
            </Text>
          </Pressable>

          {/* Footer */}
          <Text
            style={{
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              fontSize: 10,
              color: 'rgba(148,163,184,0.3)',
              letterSpacing: 4,
              textTransform: 'uppercase',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            Industrial Decarbonization Network © 2026
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

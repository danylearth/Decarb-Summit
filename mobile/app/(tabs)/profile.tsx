import { View, Text, Pressable, ScrollView, Image, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '../../context/UserContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, membership, preferences, togglePreference, signOut } = useUser();

  if (!user) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Profile Hero — matches web SettingsPage */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 }}>
          {/* Avatar with glow */}
          <View style={{ marginBottom: 24 }}>
            <View style={{
              width: 128, height: 128, borderRadius: 64,
              padding: 4,
              borderWidth: 1,
              borderColor: 'rgba(198,238,98,0.3)',
            }}>
              <Image
                source={{ uri: user.avatar || `https://picsum.photos/seed/${user.id}/200/200` }}
                style={{ width: '100%', height: '100%', borderRadius: 60, borderWidth: 4, borderColor: '#020617' }}
              />
            </View>
          </View>

          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: '#e2e8f0', letterSpacing: -1, marginBottom: 4 }}>
            {user.name}
          </Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#94a3b8', letterSpacing: 0.5, marginBottom: 16 }}>
            {user.role}
          </Text>

          {/* Live badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(198,238,98,0.1)', borderWidth: 1, borderColor: 'rgba(198,238,98,0.2)',
            paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, marginBottom: 32,
          }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#c6ee62' }} />
            <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#c6ee62', letterSpacing: 2, textTransform: 'uppercase' }}>
              Live Connection
            </Text>
          </View>
        </View>

        {/* Bio */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 }}>
            About
          </Text>
          <Text style={{ fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 22, maxWidth: 400, alignSelf: 'center' }}>
            {user.bio || "No bio provided yet. This catalyst is busy decarbonizing the world."}
          </Text>
        </View>

        {/* Tags */}
        {user.tags && user.tags.length > 0 && (
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 }}>
              Expertise
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {user.tags.map(tag => (
                <View key={tag} style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#080e3d', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#e2e8f0', letterSpacing: 2, textTransform: 'uppercase' }}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Social */}
        {(user.linkedin || user.twitter) && (
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 10, color: 'rgba(148,163,184,0.4)', letterSpacing: 3, textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 }}>
              Social
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
              {user.linkedin && (
                <Pressable
                  onPress={() => Linking.openURL(user.linkedin!.startsWith('http') ? user.linkedin! : `https://${user.linkedin}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#050a30', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#c6ee62' }}>in</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#e2e8f0' }}>LinkedIn</Text>
                </Pressable>
              )}
              {user.twitter && (
                <Pressable
                  onPress={() => Linking.openURL(user.twitter!.startsWith('http') ? user.twitter! : `https://${user.twitter}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#050a30', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}
                >
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 16, color: '#c6ee62' }}>𝕏</Text>
                  <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#e2e8f0' }}>X</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Settings sections — matches web SettingsPage */}
        <View style={{ paddingHorizontal: 24 }}>
          {/* Account */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: 'rgba(148,163,184,0.6)', letterSpacing: 3, textTransform: 'uppercase' }}>Account Settings</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 16 }} />
            </View>
            {[
              { icon: '👤', label: 'Personal Information', sub: 'Bio, contact data, and social links' },
              { icon: '💳', label: 'Membership Plan', sub: `Current: ${membership.plan}` },
            ].map(item => (
              <Pressable key={item.label} style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 20, backgroundColor: '#050a30', borderRadius: 16, marginBottom: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#111b57', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  <View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#e2e8f0' }}>{item.label}</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>{item.sub}</Text>
                  </View>
                </View>
                <Text style={{ color: 'rgba(148,163,184,0.4)', fontSize: 20 }}>›</Text>
              </Pressable>
            ))}
          </View>

          {/* Preferences */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 12, color: 'rgba(148,163,184,0.6)', letterSpacing: 3, textTransform: 'uppercase' }}>Preferences</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 16 }} />
            </View>
            {[
              { icon: '🔔', label: 'Push Notifications', sub: 'Alerts on networking matches', key: 'pushNotifications' as const, value: preferences.pushNotifications },
              { icon: '👁', label: 'Public Profile', sub: 'Visible to community search', key: 'publicProfile' as const, value: preferences.publicProfile },
            ].map(item => (
              <View key={item.label} style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 20, backgroundColor: '#050a30', borderRadius: 16, marginBottom: 12,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#111b57', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  <View>
                    <Text style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, color: '#e2e8f0' }}>{item.label}</Text>
                    <Text style={{ fontFamily: 'PlusJakartaSans_400Regular', fontSize: 12, color: 'rgba(148,163,184,0.7)' }}>{item.sub}</Text>
                  </View>
                </View>
                <Switch
                  value={item.value}
                  onValueChange={() => togglePreference(item.key)}
                  trackColor={{ false: '#111b57', true: '#c6ee62' }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>

          {/* Sign Out */}
          <Pressable onPress={signOut} style={{ alignItems: 'center', paddingVertical: 20, marginTop: 16 }}>
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 13, color: '#f87171', letterSpacing: 3, textTransform: 'uppercase' }}>
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

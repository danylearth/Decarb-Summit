import { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import type { Resource } from '../../lib/types';
import { DEMO_RESOURCES } from '../../lib/demoData';

export default function ResourcesScreen() {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Check if we're in demo by looking at resources — no context needed here
    (async () => {
      const { data, error } = await supabase.from('resources').select('*').order('created_at', { ascending: false });
      if (error || !data || data.length === 0) {
        // Fallback to demo data if Supabase returns nothing
        setResources(DEMO_RESOURCES);
      } else {
        setResources(data as Resource[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = resources.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const videos = filtered.filter(r => r.type === 'Video');
  const reports = filtered.filter(r => r.type === 'Report');

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-16 pb-4 flex-row items-start justify-between">
        {searchOpen ? (
          <View className="flex-1 mr-3">
            <TextInput
              autoFocus
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search resources..."
              placeholderTextColor="rgba(148,163,184,0.4)"
              className="bg-surface-container rounded-full py-3 px-5 text-sm text-on-surface"
            />
          </View>
        ) : (
          <View>
            <Text className="text-primary-accent font-bold text-[10px] tracking-widest uppercase">Knowledge Ecosystem</Text>
            <Text className="text-5xl font-black tracking-tighter text-white mt-1">Resources</Text>
          </View>
        )}
        <Pressable
          onPress={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(''); }}
          className="w-12 h-12 rounded-full bg-surface-container-high items-center justify-center mt-2"
        >
          <Text className="text-primary-accent text-lg">{searchOpen ? '✕' : '🔍'}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#c6ee62" />
        </View>
      ) : resources.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-xl font-bold text-white mb-2">No Resources Yet</Text>
          <Text className="text-on-surface-variant text-sm text-center">Resources will appear here once they're published.</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Videos */}
          {videos.length > 0 && (
            <View className="mb-8">
              <Text className="text-lg font-bold text-white mb-4">Video Masterclasses</Text>
              {videos.map(video => (
                <Pressable
                  key={video.id}
                  className="mb-4 rounded-xl overflow-hidden bg-surface-container-low border border-white/5 active:opacity-80"
                >
                  {video.image && (
                    <Image source={{ uri: video.image }} className="w-full" style={{ aspectRatio: 16/10 }} resizeMode="cover" />
                  )}
                  <View className="p-4">
                    <View className="flex-row items-center gap-2 mb-2">
                      <View className="bg-primary-accent/20 rounded-full px-3 py-1">
                        <Text className="text-primary-accent text-[10px] font-bold uppercase tracking-wider">{video.category}</Text>
                      </View>
                      {video.duration && <Text className="text-white/60 text-xs">{video.duration}</Text>}
                    </View>
                    <Text className="text-lg font-bold text-white mb-1">{video.title}</Text>
                    <Text className="text-on-surface-variant text-sm" numberOfLines={2}>{video.description}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Reports */}
          {reports.length > 0 && (
            <View className="mb-8">
              <Text className="text-lg font-bold text-white mb-4">Industry Reports</Text>
              {reports.map(report => (
                <Pressable
                  key={report.id}
                  className="mb-3 flex-row items-center gap-4 p-4 bg-surface-container-low rounded-xl border border-white/5 active:opacity-80"
                >
                  <View className="w-14 h-18 bg-surface-container-highest rounded-lg items-center justify-center">
                    <Text className="text-2xl">📄</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-primary-accent text-[10px] font-bold uppercase tracking-widest mb-1">{report.category}</Text>
                    <Text className="text-base font-bold text-white">{report.title}</Text>
                    <Text className="text-on-surface-variant text-sm mt-1" numberOfLines={1}>{report.description}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {filtered.length === 0 && searchQuery && (
            <View className="items-center py-20">
              <Text className="text-xl font-bold text-white mb-2">No results found</Text>
              <Text className="text-on-surface-variant text-sm">No resources match "{searchQuery}"</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

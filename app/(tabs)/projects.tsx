import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Project } from '@/types';
import { MapPin, Plus } from 'lucide-react-native';

const TABS = ['All', 'In Progress', 'Completed'];

const PROJECT_IMAGES = [
  'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?w=400&auto=compress',
  'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?w=400&auto=compress',
  'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg?w=400&auto=compress',
  'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?w=400&auto=compress',
  'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?w=400&auto=compress',
  'https://images.pexels.com/photos/259588/pexels-photo-259588.jpeg?w=400&auto=compress',
];

export default function ProjectsScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(data);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const filtered = activeTab === 'All' ? projects : projects.filter((p) => p.status === activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Portfolio</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/new-project')}>
          <Plus size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#1A56DB" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
          {filtered.map((project) => {
            const imgIndex = Math.abs(project.id.charCodeAt(0) % PROJECT_IMAGES.length);
            const imgUrl = project.coverPhoto || PROJECT_IMAGES[imgIndex];
            return (
              <TouchableOpacity
                key={project.id}
                style={styles.gridCard}
                onPress={() => router.push(`/project/${project.id}` as any)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: imgUrl }} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.cardOverlay}>
                  <Text style={styles.cardName} numberOfLines={1}>{project.projectName}</Text>
                  <View style={styles.cardLocation}>
                    <MapPin size={10} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.cardLocationText} numberOfLines={1}>{project.siteLocation}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, project.status === 'Completed' ? styles.completedBadge : styles.progressBadge]}>
                  <Text style={styles.statusText}>{project.status}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.addPhotosCard} onPress={() => router.push('/new-project')}>
            <Plus size={28} color="#1A56DB" />
            <Text style={styles.addPhotosText}>Add Photos</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A56DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 4,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  activeTab: { backgroundColor: '#1A56DB' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  activeTabText: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },
  gridCard: {
    width: '47%',
    aspectRatio: 0.85,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  cardImage: { width: '100%', height: '100%' },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  cardName: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cardLocation: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  cardLocationText: { fontSize: 10, color: 'rgba(255,255,255,0.8)', flex: 1 },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  completedBadge: { backgroundColor: '#059669' },
  progressBadge: { backgroundColor: '#D97706' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  addPhotosCard: {
    width: '47%',
    aspectRatio: 0.85,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  addPhotosText: { fontSize: 13, color: '#1A56DB', fontWeight: '500', marginTop: 8 },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Project } from '@/types';
import { MapPin } from 'lucide-react-native';

const STATUS_COLORS: Record<string, string> = {
  'In Progress': '#D97706',
  'Completed': '#059669',
  'Planning': '#6B7280',
};

const STATUS_BG: Record<string, string> = {
  'In Progress': '#FEF3C7',
  'Completed': '#ECFDF5',
  'Planning': '#F3F4F6',
};

const PROJECT_IMAGES = [
  'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?w=200&auto=compress',
  'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?w=200&auto=compress',
  'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg?w=200&auto=compress',
  'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?w=200&auto=compress',
];

interface Props {
  project: Project;
  onPress?: () => void;
}

export default function ProjectCard({ project, onPress }: Props) {
  const imgIndex = Math.abs(project.id.charCodeAt(0) % PROJECT_IMAGES.length);
  const imgUrl = project.coverPhoto || PROJECT_IMAGES[imgIndex];
  const progress = project.overallProgress ?? 0;
  const status = project.status || 'Planning';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: imgUrl }} style={styles.thumbnail} resizeMode="cover" />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{project.projectName}</Text>
        <View style={styles.locationRow}>
          <MapPin size={11} color="#9CA3AF" />
          <Text style={styles.location} numberOfLines={1}>{project.siteLocation}</Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={[styles.badge, { backgroundColor: STATUS_BG[status] }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[status] }]}>{status}</Text>
          </View>
        </View>
      </View>
      <View style={styles.progressCircle}>
        <Text style={styles.progressText}>{progress}%</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  thumbnail: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F3F4F6' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  location: { fontSize: 12, color: '#9CA3AF', flex: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  progressCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#1A56DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  progressText: { fontSize: 11, fontWeight: '700', color: '#1A56DB' },
});

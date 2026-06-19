import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Project } from '@/types';
import { ChevronRight } from 'lucide-react-native';

const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#DBEAFE', text: '#1A56DB' },
  in_progress: { bg: '#FEF3C7', text: '#D97706' },
  upcoming: { bg: '#F3F4F6', text: '#6B7280' },
};

export default function TasksScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(data.filter((p) => p.status !== 'Completed'));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tasks & Phases</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#1A56DB" style={{ marginTop: 60 }} />
      ) : projects.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>No active projects</Text>
          <Text style={styles.emptyDesc}>Active project phases will appear here.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {projects.map((project) => (
            <View key={project.id} style={styles.projectSection}>
              <TouchableOpacity
                style={styles.projectHeader}
                onPress={() => router.push(`/project/${project.id}` as any)}
              >
                <View>
                  <Text style={styles.projectName}>{project.projectName}</Text>
                  <Text style={styles.projectLocation}>{project.siteLocation}</Text>
                </View>
                <View style={styles.projectProgress}>
                  <Text style={styles.progressPct}>{project.overallProgress ?? 0}%</Text>
                  <ChevronRight size={16} color="#6B7280" />
                </View>
              </TouchableOpacity>

              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBarFill, { width: `${project.overallProgress ?? 0}%` as any }]} />
              </View>

              {(project.phases || []).map((phase) => {
                const colors = PHASE_COLORS[phase.status];
                return (
                  <View key={phase.name} style={styles.phaseRow}>
                    <View style={[styles.phaseDot, { backgroundColor: colors.text }]} />
                    <Text style={styles.phaseName}>{phase.name}</Text>
                    <View style={[styles.phaseBadge, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.phaseBadgeText, { color: colors.text }]}>
                        {phase.status === 'in_progress' ? 'In Progress' : phase.status === 'completed' ? 'Done' : 'Upcoming'}
                      </Text>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                style={styles.viewBtn}
                onPress={() => router.push(`/project/${project.id}/progress` as any)}
              >
                <Text style={styles.viewBtnText}>View Progress Details</Text>
                <ChevronRight size={14} color="#1A56DB" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  content: { padding: 16, gap: 14 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  projectSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  projectName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  projectLocation: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  projectProgress: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressPct: { fontSize: 16, fontWeight: '700', color: '#1A56DB' },
  progressBarContainer: { height: 6, backgroundColor: '#EFF6FF', borderRadius: 3, marginBottom: 12 },
  progressBarFill: { height: 6, backgroundColor: '#1A56DB', borderRadius: 3 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseName: { flex: 1, fontSize: 13, color: '#374151' },
  phaseBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  phaseBadgeText: { fontSize: 11, fontWeight: '600' },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  viewBtnText: { fontSize: 13, color: '#1A56DB', fontWeight: '500', marginRight: 4 },
});

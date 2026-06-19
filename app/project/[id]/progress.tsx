import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, PhaseStatus } from '@/types';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

const CIRCLE_RADIUS = 60;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

function CircularProgress({ progress }: { progress: number }) {
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress / 100);

  return (
    <View style={styles.circleContainer}>
      <Svg width={160} height={160} viewBox="0 0 160 160">
        <Circle cx={80} cy={80} r={CIRCLE_RADIUS} stroke="#EFF6FF" strokeWidth={14} fill="none" />
        <Circle
          cx={80}
          cy={80}
          r={CIRCLE_RADIUS}
          stroke="#1A56DB"
          strokeWidth={14}
          fill="none"
          strokeDasharray={CIRCLE_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
      </Svg>
      <View style={styles.circleLabel}>
        <Text style={styles.circlePercent}>{progress}%</Text>
        <Text style={styles.circleStatus}>In Progress</Text>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const handlePhaseProgress = async (idx: number, progress: number) => {
    if (!project) return;
    const updatedPhases = project.phases.map((p, i) => {
      if (i !== idx) return p;
      const status = progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'upcoming';
      return { ...p, progress, status };
    });
    const overall = Math.round(updatedPhases.reduce((s, p) => s + p.progress, 0) / updatedPhases.length);
    const projectStatus = overall === 100 ? 'Completed' : overall > 0 ? 'In Progress' : 'Planning';
    await updateDoc(doc(db, 'projects', id), {
      phases: updatedPhases,
      overallProgress: overall,
      status: projectStatus,
      updatedAt: new Date(),
    });
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;
  if (!project) return <View style={styles.loader}><Text>Project not found.</Text></View>;

  const phases = project.phases || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Overall Progress</Text>
        <CircularProgress progress={project.overallProgress ?? 0} />

        <Text style={styles.sectionLabel}>Phase Progress</Text>
        {phases.map((phase, idx) => (
          <View key={phase.name} style={styles.phaseCard}>
            <View style={styles.phaseHeader}>
              <Text style={styles.phaseName}>{phase.name}</Text>
              <Text style={styles.phasePercent}>{phase.progress}%</Text>
            </View>
            <View style={styles.barContainer}>
              <View style={[styles.barFill, { width: `${phase.progress}%` as any, backgroundColor: phase.status === 'completed' ? '#1A56DB' : phase.status === 'in_progress' ? '#D97706' : '#E5E7EB' }]} />
            </View>
            <View style={styles.progressButtons}>
              {[0, 25, 50, 75, 100].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.progressBtn, phase.progress === val && styles.progressBtnActive]}
                  onPress={() => handlePhaseProgress(idx, val)}
                >
                  <Text style={[styles.progressBtnText, phase.progress === val && styles.progressBtnTextActive]}>
                    {val}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.nextBtn} onPress={() => router.push(`/project/${id}/notify` as any)}>
          <Text style={styles.nextBtnText}>Notify Customer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 20, paddingBottom: 100 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12, marginTop: 8 },
  circleContainer: { alignItems: 'center', marginBottom: 24, position: 'relative' },
  circleLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  circlePercent: { fontSize: 32, fontWeight: '800', color: '#111827' },
  circleStatus: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  phaseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  phaseName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  phasePercent: { fontSize: 14, fontWeight: '700', color: '#1A56DB' },
  barContainer: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  progressButtons: { flexDirection: 'row', gap: 6 },
  progressBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  progressBtnActive: { backgroundColor: '#1A56DB' },
  progressBtnText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  progressBtnTextActive: { color: '#fff' },
  bottomBar: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  nextBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

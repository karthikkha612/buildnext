import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, PhaseStatus } from '@/types';
import { formatDate } from '@/lib/formatting';
import { ArrowLeft } from 'lucide-react-native';

const STATUS_COLORS: Record<string, { circle: string; line: string; text: string; bg: string }> = {
  completed: { circle: '#1A56DB', line: '#1A56DB', text: '#1A56DB', bg: '#DBEAFE' },
  in_progress: { circle: '#D97706', line: '#E5E7EB', text: '#D97706', bg: '#FEF3C7' },
  upcoming: { circle: '#E5E7EB', line: '#E5E7EB', text: '#9CA3AF', bg: '#F9FAFB' },
};

export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<PhaseStatus[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() } as Project;
        setProject(p);
        setPhases(p.phases || []);
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const updatePhaseDate = (idx: number, field: 'startDate' | 'endDate', value: string) => {
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', id!), { phases, updatedAt: new Date() });
      router.push(`/project/${id}` as any);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Project Phases</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {phases.map((phase, idx) => {
          const colors = STATUS_COLORS[phase.status];
          const isLast = idx === phases.length - 1;
          return (
            <View key={phase.name} style={styles.phaseRow}>
              {/* Timeline line */}
              <View style={styles.timelineCol}>
                <View style={[styles.circle, { backgroundColor: colors.circle, borderColor: colors.circle }]}>
                  <Text style={styles.circleNum}>{idx + 1}</Text>
                </View>
                {!isLast && <View style={[styles.line, { backgroundColor: colors.line }]} />}
              </View>

              {/* Phase content */}
              <View style={styles.phaseContent}>
                <View style={styles.phaseHeader}>
                  <Text style={[styles.phaseName, { color: phase.status === 'upcoming' ? '#6B7280' : '#111827' }]}>
                    {phase.name}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                    <Text style={[styles.badgeText, { color: colors.text }]}>
                      {phase.status === 'in_progress' ? 'In Progress' : phase.status === 'completed' ? 'Completed' : 'Upcoming'}
                    </Text>
                  </View>
                </View>
                <View style={styles.dateRow}>
                  <TextInput
                    style={styles.dateInput}
                    value={phase.startDate}
                    onChangeText={(v) => updatePhaseDate(idx, 'startDate', v)}
                    placeholder="Start YYYY-MM-DD"
                    placeholderTextColor="#D1D5DB"
                  />
                  <Text style={styles.dateSep}>→</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={phase.endDate}
                    onChangeText={(v) => updatePhaseDate(idx, 'endDate', v)}
                    placeholder="End YYYY-MM-DD"
                    placeholderTextColor="#D1D5DB"
                  />
                </View>
                {(phase.startDate || phase.endDate) && (
                  <Text style={styles.dateDisplay}>
                    {phase.startDate ? formatDate(phase.startDate) : '?'} - {phase.endDate ? formatDate(phase.endDate) : '?'}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Project</Text>}
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
  content: { padding: 20 },
  phaseRow: { flexDirection: 'row', marginBottom: 0 },
  timelineCol: { width: 40, alignItems: 'center' },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  circleNum: { fontSize: 11, fontWeight: '700', color: '#fff' },
  line: { width: 2, flex: 1, minHeight: 20, marginVertical: 4 },
  phaseContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  phaseName: { fontSize: 14, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 8,
    fontSize: 12,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  dateSep: { fontSize: 14, color: '#9CA3AF' },
  dateDisplay: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  bottomBar: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

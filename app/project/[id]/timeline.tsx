import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, PhaseStatus } from '@/types';
import { ArrowLeft, Calendar } from 'lucide-react-native';

const DateTimePicker = require('@react-native-community/datetimepicker').default;

const STATUS_COLORS: Record<string, { circle: string; text: string; bg: string }> = {
  completed: { circle: '#1A56DB', text: '#1A56DB', bg: '#DBEAFE' },
  in_progress: { circle: '#D97706', text: '#D97706', bg: '#FEF3C7' },
  upcoming: { circle: '#9CA3AF', text: '#9CA3AF', bg: '#F9FAFB' },
};

export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<PhaseStatus[]>([]);
  const [saving, setSaving] = useState(false);

  // Date picker state
  const [activePicker, setActivePicker] = useState<{ idx: number; field: 'startDate' | 'endDate' } | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

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

  const openPicker = (idx: number, field: 'startDate' | 'endDate') => {
    const phase = phases[idx];
    const existingDate = field === 'startDate' ? phase.startDate : phase.endDate;
    setPickerDate(existingDate ? new Date(existingDate) : new Date());
    setActivePicker({ idx, field });
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setActivePicker(null);
    }
    if (date && activePicker) {
      const dateStr = date.toISOString().split('T')[0];
      setPhases((prev) =>
        prev.map((p, i) =>
          i === activePicker.idx ? { ...p, [activePicker.field]: dateStr } : p
        )
      );
      if (Platform.OS === 'android') setActivePicker(null);
    }
  };

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select date';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
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
            <View key={`${phase.name}-${idx}`} style={styles.phaseRow}>
              <View style={styles.timelineCol}>
                <View style={[styles.circle, { backgroundColor: colors.circle }]}>
                  <Text style={styles.circleNum}>{idx + 1}</Text>
                </View>
                {!isLast && <View style={styles.line} />}
              </View>

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

                {/* Date pickers */}
                <View style={styles.dateRow}>
                  <TouchableOpacity
                    style={styles.datePicker}
                    onPress={() => openPicker(idx, 'startDate')}
                  >
                    <Calendar size={12} color="#6B7280" />
                    <Text style={[styles.datePickerText, !phase.startDate && styles.datePickerPlaceholder]}>
                      {phase.startDate ? formatDisplay(phase.startDate) : 'Start date'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.dateSep}>→</Text>

                  <TouchableOpacity
                    style={styles.datePicker}
                    onPress={() => openPicker(idx, 'endDate')}
                  >
                    <Calendar size={12} color="#6B7280" />
                    <Text style={[styles.datePickerText, !phase.endDate && styles.datePickerPlaceholder]}>
                      {phase.endDate ? formatDisplay(phase.endDate) : 'End date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Date Picker Modal */}
      {activePicker !== null && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                Select {activePicker.field === 'startDate' ? 'Start' : 'End'} Date
              </Text>
              <TouchableOpacity
                style={styles.pickerDoneBtn}
                onPress={() => setActivePicker(null)}
              >
                <Text style={styles.pickerDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              textColor="#111827"
            />
          </View>
        </View>
      )}

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Timeline</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 20 },
  phaseRow: { flexDirection: 'row', marginBottom: 0 },
  timelineCol: { width: 40, alignItems: 'center' },
  circle: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  circleNum: { fontSize: 11, fontWeight: '700', color: '#fff' },
  line: { width: 2, flex: 1, minHeight: 20, marginVertical: 4, backgroundColor: '#E5E7EB' },
  phaseContent: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  phaseName: { fontSize: 14, fontWeight: '700', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff',
  },
  datePickerText: { fontSize: 11, color: '#111827', fontWeight: '500', flex: 1 },
  datePickerPlaceholder: { color: '#D1D5DB' },
  dateSep: { fontSize: 14, color: '#9CA3AF' },
  pickerOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    top: 0, justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, paddingBottom: 32, overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  pickerDoneBtn: {
    backgroundColor: '#1A56DB', paddingHorizontal: 16,
    paddingVertical: 8, borderRadius: 8,
  },
  pickerDoneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  bottomBar: {
    padding: 20, paddingBottom: 32, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: '#059669', borderRadius: 12, height: 52,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
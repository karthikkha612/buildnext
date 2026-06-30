import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, updateDoc, getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, LabourEntry } from '@/types';
import { ArrowLeft, Plus, X, Trash2, Calendar } from 'lucide-react-native';

const DateTimePicker = require('@react-native-community/datetimepicker').default;

const LABOUR_ROLES = [
  'Mason', 'Helper', 'Electrician', 'Plumber',
  'Carpenter', 'Painter', 'Welder', 'Supervisor', 'Other',
];

const today = () => new Date().toISOString().split('T')[0];

export default function LabourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<LabourEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form fields
  const [date, setDate] = useState(today());
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [role, setRole] = useState(LABOUR_ROLES[0]);
  const [workers, setWorkers] = useState('');
  const [costPerWorker, setCostPerWorker] = useState('');
  const [notes, setNotes] = useState('');

  const totalCost = (parseFloat(workers) || 0) * (parseFloat(costPerWorker) || 0);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'projects', id)).then((snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
    });

    const unsub = onSnapshot(
      collection(db, 'projects', id, 'labour'),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as LabourEntry));
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(data);
        setLoading(false);
      }
    );
    return unsub;
  }, [id]);

  // Recalculate total labour cost and update project estimate
  const updateProjectEstimate = async (updatedEntries: LabourEntry[]) => {
    if (!project) return;
    const labourTotal = updatedEntries.reduce((s, e) => s + e.totalCost, 0);
    const materialCost = project.estimate?.materialCost || 0;
    const constructionCost = project.estimate?.constructionCost || 0;
    const otherExpenses = project.estimate?.otherExpenses || 0;
    const newTotal = constructionCost + materialCost + labourTotal + otherExpenses;

    await updateDoc(doc(db, 'projects', id!), {
      labourCostTotal: labourTotal,
      'estimate.laborCost': labourTotal,
      'estimate.total': newTotal,
      updatedAt: new Date(),
    });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setModalError('');
    setDate(today());
    setDateObj(new Date());
    setRole(LABOUR_ROLES[0]);
    setWorkers('');
    setCostPerWorker('');
    setNotes('');
  };

  const handleAdd = async () => {
    if (!workers.trim() || parseInt(workers) <= 0) {
      setModalError('Enter a valid number of workers.'); return;
    }
    if (!costPerWorker.trim() || parseFloat(costPerWorker) <= 0) {
      setModalError('Enter a valid cost per worker.'); return;
    }
    setModalError('');
    setSaving(true);
    try {
      const entry: Omit<LabourEntry, 'id'> = {
        projectId: id!,
        date,
        role,
        numberOfWorkers: parseInt(workers),
        costPerWorker: parseFloat(costPerWorker),
        totalCost,
        notes: notes.trim(),
        createdAt: new Date(),
      };
      await addDoc(collection(db, 'projects', id!, 'labour'), entry);
      // Update project estimate with new labour cost
      const updatedEntries = [...entries, { ...entry, id: 'temp' }];
      await updateProjectEstimate(updatedEntries);
      handleCloseModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entryId: string, entryTotal: number) => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this labour entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDoc(doc(db, 'projects', id!, 'labour', entryId));
            const updatedEntries = entries.filter((e) => e.id !== entryId);
            await updateProjectEstimate(updatedEntries);
          },
        },
      ]
    );
  };

  const totalLabourCost = entries.reduce((s, e) => s + e.totalCost, 0);
  const materialCost = project?.estimate?.materialCost || 0;
  const constructionCost = project?.estimate?.constructionCost || 0;
  const otherExpenses = project?.estimate?.otherExpenses || 0;
  const grandTotal = constructionCost + materialCost + totalLabourCost + otherExpenses;

  const formatCurrency = (val: number) =>
    `₹${val.toLocaleString('en-IN')}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Labour Management</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Labour Cost</Text>
          <Text style={[styles.summaryValue, { color: '#D97706' }]}>
            {formatCurrency(totalLabourCost)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Material Cost</Text>
          <Text style={[styles.summaryValue, { color: '#1A56DB' }]}>
            {formatCurrency(materialCost)}
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Grand Total</Text>
          <Text style={[styles.summaryValue, { color: '#059669' }]}>
            {formatCurrency(grandTotal)}
          </Text>
        </View>
      </View>

      {/* Estimate Breakdown */}
      <View style={styles.breakdownCard}>
        <Text style={styles.breakdownTitle}>Estimate Breakdown</Text>
        {[
          { label: 'Construction Cost', value: constructionCost, color: '#374151' },
          { label: 'Material Cost', value: materialCost, color: '#1A56DB' },
          { label: 'Labour Cost', value: totalLabourCost, color: '#D97706' },
          { label: 'Other Expenses', value: otherExpenses, color: '#6B7280' },
        ].map((item) => (
          <View key={item.label} style={styles.breakdownRow}>
            <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
            <Text style={styles.breakdownLabel}>{item.label}</Text>
            <Text style={[styles.breakdownValue, { color: item.color }]}>
              {formatCurrency(item.value)}
            </Text>
          </View>
        ))}
        <View style={styles.breakdownTotal}>
          <Text style={styles.breakdownTotalLabel}>Grand Project Estimate</Text>
          <Text style={styles.breakdownTotalValue}>{formatCurrency(grandTotal)}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Labour History</Text>

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👷</Text>
            <Text style={styles.emptyTitle}>No labour entries yet</Text>
            <Text style={styles.emptyDesc}>Tap + to add labour records for this project.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyBtnText}>+ Add Labour Entry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          entries.map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={styles.entryDateRow}>
                  <Calendar size={12} color="#9CA3AF" />
                  <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(entry.id, entry.totalCost)}
                  style={styles.deleteBtn}
                >
                  <Trash2 size={14} color="#DC2626" />
                </TouchableOpacity>
              </View>

              <View style={styles.entryBody}>
                <View style={styles.entryRoleBadge}>
                  <Text style={styles.entryRoleText}>{entry.role}</Text>
                </View>
                <View style={styles.entryStats}>
                  <View style={styles.entryStat}>
                    <Text style={styles.entryStatLabel}>Workers</Text>
                    <Text style={styles.entryStatValue}>{entry.numberOfWorkers}</Text>
                  </View>
                  <View style={styles.entryStatDivider} />
                  <View style={styles.entryStat}>
                    <Text style={styles.entryStatLabel}>Per Worker</Text>
                    <Text style={styles.entryStatValue}>{formatCurrency(entry.costPerWorker)}</Text>
                  </View>
                  <View style={styles.entryStatDivider} />
                  <View style={styles.entryStat}>
                    <Text style={styles.entryStatLabel}>Total</Text>
                    <Text style={[styles.entryStatValue, { color: '#D97706' }]}>
                      {formatCurrency(entry.totalCost)}
                    </Text>
                  </View>
                </View>
              </View>

              {entry.notes ? (
                <Text style={styles.entryNotes}>📝 {entry.notes}</Text>
              ) : null}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus size={20} color="#fff" />
        <Text style={styles.fabText}>Add Labour Entry</Text>
      </TouchableOpacity>

      {/* Add Labour Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Labour Entry</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {modalError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{modalError}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Date Picker */}
              <Text style={styles.fieldLabel}>Date *</Text>
              <TouchableOpacity
                style={styles.datePicker}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} color="#6B7280" />
                <Text style={styles.datePickerText}>{formatDate(date)}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <View style={styles.pickerContainer}>
                  {Platform.OS === 'ios' ? (
                    <>
                      <DateTimePicker
                        value={dateObj}
                        mode="date"
                        display="spinner"
                        onChange={(_: any, d?: Date) => {
                          if (d) { setDateObj(d); setDate(d.toISOString().split('T')[0]); }
                        }}
                      />
                      <TouchableOpacity
                        style={styles.pickerDoneBtn}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.pickerDoneBtnText}>Done</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <DateTimePicker
                      value={dateObj}
                      mode="date"
                      display="default"
                      onChange={(_: any, d?: Date) => {
                        setShowDatePicker(false);
                        if (d) { setDateObj(d); setDate(d.toISOString().split('T')[0]); }
                      }}
                    />
                  )}
                </View>
              )}

              {/* Role */}
              <Text style={styles.fieldLabel}>Labour Role *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.roleScroll}
              >
                {LABOUR_ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, role === r && styles.roleChipActive]}
                    onPress={() => setRole(r)}
                  >
                    <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Workers */}
              <Text style={styles.fieldLabel}>Number of Workers *</Text>
              <TextInput
                style={[styles.fieldInput, modalError && !workers && styles.fieldInputError]}
                value={workers}
                onChangeText={(v) => { setWorkers(v.replace(/\D/g, '')); setModalError(''); }}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor="#9CA3AF"
              />

              {/* Cost per worker */}
              <Text style={styles.fieldLabel}>Cost Per Worker (₹/day) *</Text>
              <TextInput
                style={[styles.fieldInput, modalError && !costPerWorker && styles.fieldInputError]}
                value={costPerWorker}
                onChangeText={(v) => { setCostPerWorker(v); setModalError(''); }}
                keyboardType="numeric"
                placeholder="e.g. 800"
                placeholderTextColor="#9CA3AF"
              />

              {/* Auto-calculated total */}
              {(parseFloat(workers) > 0 && parseFloat(costPerWorker) > 0) && (
                <View style={styles.totalPreview}>
                  <Text style={styles.totalPreviewLabel}>Total Cost</Text>
                  <Text style={styles.totalPreviewValue}>{formatCurrency(totalCost)}</Text>
                </View>
              )}

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>Add Labour Entry</Text>
                }
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8,
  },
  summaryCard: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10,
    padding: 10, alignItems: 'center',
  },
  summaryLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '500', marginBottom: 4 },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  breakdownCard: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  breakdownTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 10 },
  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  breakdownDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  breakdownLabel: { flex: 1, fontSize: 13, color: '#6B7280' },
  breakdownValue: { fontSize: 13, fontWeight: '600' },
  breakdownTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 10, marginTop: 4,
  },
  breakdownTotalLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  breakdownTotalValue: { fontSize: 16, fontWeight: '800', color: '#059669' },
  content: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  emptyBtn: { backgroundColor: '#1A56DB', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  entryCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
    shadowRadius: 4, elevation: 2,
  },
  entryHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  entryDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  entryDate: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  deleteBtn: { padding: 4 },
  entryBody: { gap: 8 },
  entryRoleBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EFF6FF',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  entryRoleText: { fontSize: 12, fontWeight: '700', color: '#1A56DB' },
  entryStats: {
    flexDirection: 'row', backgroundColor: '#F8FAFC',
    borderRadius: 8, padding: 10,
  },
  entryStat: { flex: 1, alignItems: 'center' },
  entryStatLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  entryStatValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  entryStatDivider: { width: 1, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  entryNotes: { fontSize: 12, color: '#6B7280', marginTop: 8, fontStyle: 'italic' },
  fab: {
    position: 'absolute', bottom: 24, left: 20, right: 20,
    backgroundColor: '#1A56DB', borderRadius: 12, height: 50,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalErrorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 8,
    padding: 10, marginBottom: 12,
  },
  modalErrorText: { color: '#DC2626', fontSize: 12, fontWeight: '500' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  fieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, height: 44,
    paddingHorizontal: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
  },
  fieldInputError: { borderColor: '#DC2626' },
  notesInput: { height: 80, paddingTop: 10, textAlignVertical: 'top' },
  datePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    height: 44, paddingHorizontal: 12, backgroundColor: '#F9FAFB',
  },
  datePickerText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  pickerContainer: {
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 6, overflow: 'hidden',
  },
  pickerDoneBtn: { backgroundColor: '#1A56DB', padding: 10, alignItems: 'center' },
  pickerDoneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  roleScroll: { marginBottom: 4 },
  roleChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#F3F4F6', marginRight: 8,
  },
  roleChipActive: { backgroundColor: '#1A56DB' },
  roleChipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  roleChipTextActive: { color: '#fff' },
  totalPreview: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FEF3C7', borderRadius: 8, padding: 12, marginTop: 12,
  },
  totalPreviewLabel: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  totalPreviewValue: { fontSize: 16, fontWeight: '800', color: '#D97706' },
  saveBtn: {
    backgroundColor: '#1A56DB', borderRadius: 10, height: 50,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, Payment } from '@/types';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react-native';

const DateTimePicker = require('@react-native-community/datetimepicker').default;

type FieldErrors = { date?: string; milestone?: string; amount?: string };

export default function ProjectPaymentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit modal shared state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(''); // stored as YYYY-MM-DD
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [milestone, setMilestone] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Track which row is mid-toggle/delete so we can show a small spinner without blocking the rest of the UI
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'projects', id)).then((snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
    });

    const unsub = onSnapshot(collection(db, 'projects', id, 'payments'), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(data);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const totalEstimate = project?.estimate?.total || 0;
  const totalPaid = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const remaining = totalEstimate - totalPaid;

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const resetForm = () => {
    setEditingId(null);
    setDate('');
    setDateObj(new Date());
    setMilestone('');
    setAmount('');
    setStatus('Paid');
    setErrors({});
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (payment: Payment) => {
    setEditingId(payment.id);
    setDate(payment.date);
    setDateObj(payment.date && !Number.isNaN(new Date(payment.date).getTime()) ? new Date(payment.date) : new Date());
    setMilestone(payment.milestone);
    setAmount(String(payment.amount));
    setStatus(payment.status);
    setErrors({});
    setModalVisible(true);
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!date.trim()) next.date = 'Date is required.';

    if (!milestone.trim()) next.milestone = 'Milestone is required.';

    const numericAmount = parseFloat(amount);
    if (!amount.trim()) next.amount = 'Amount is required.';
    else if (Number.isNaN(numericAmount) || numericAmount <= 0) next.amount = 'Amount must be a number greater than 0.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!id) return;

    setSaving(true);
    try {
      const payload = {
        date,
        milestone: milestone.trim(),
        amount: parseFloat(amount),
        status,
        updatedAt: new Date(),
      };

      if (editingId) {
        // EDIT: write to the existing payment doc — this is the fix for
        // "Save Changes" not persisting: editingId must be the Firestore
        // doc id of the payment being edited, set in openEditModal above,
        // and updateDoc must target that exact doc path.
        await updateDoc(doc(db, 'projects', id, 'payments', editingId), payload);
        Alert.alert('Saved', 'Payment updated successfully.');
      } else {
        await addDoc(collection(db, 'projects', id, 'payments'), {
          ...payload,
          projectId: id,
          createdAt: new Date(),
        });
        Alert.alert('Saved', 'Payment added successfully.');
      }
      setModalVisible(false);
      resetForm();
    } catch (e) {
      Alert.alert('Error', 'Could not save payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (payment: Payment) => {
    Alert.alert(
      'Delete Payment',
      `Remove "${payment.milestone}" (${formatCurrency(payment.amount)})? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setBusyId(payment.id);
            try {
              await deleteDoc(doc(db, 'projects', id, 'payments', payment.id));
              // If the deleted payment happened to be open in the edit modal, close it.
              if (editingId === payment.id) {
                setModalVisible(false);
                resetForm();
              }
            } catch (e) {
              Alert.alert('Error', 'Could not delete payment. Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (payment: Payment) => {
    if (!id) return;
    const nextStatus = payment.status === 'Paid' ? 'Pending' : 'Paid';
    setBusyId(payment.id);
    try {
      await updateDoc(doc(db, 'projects', id, 'payments', payment.id), {
        status: nextStatus,
        updatedAt: new Date(),
      });
    } catch (e) {
      Alert.alert('Error', 'Could not update status. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments</Text>
        <TouchableOpacity style={styles.addIconBtn} onPress={openAddModal}>
          <Plus size={20} color="#1A56DB" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        {[
          { label: 'Total Estimate', value: totalEstimate, color: '#111827' },
          { label: 'Paid Amount', value: totalPaid, color: '#059669' },
          { label: 'Remaining', value: remaining, color: '#DC2626' },
        ].map((item) => (
          <View key={item.label} style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: item.color }]} numberOfLines={1}>
              ₹{(item.value / 100000).toFixed(2)}L
            </Text>
            <Text style={styles.summaryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#1A56DB" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          <Text style={styles.listTitle}>Payment History</Text>
          <Text style={styles.listHint}>Tap a payment to edit · Long-press to delete</Text>
          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyTitle}>No payments recorded</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <TouchableOpacity
                key={payment.id}
                style={styles.paymentCard}
                onPress={() => openEditModal(payment)}
                onLongPress={() => handleDelete(payment)}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={styles.paymentDate}>{formatDate(payment.date)}</Text>
                  <Text style={styles.paymentMilestone}>{payment.milestone}</Text>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                  {busyId === payment.id ? (
                    <ActivityIndicator size="small" color="#1A56DB" />
                  ) : (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(payment);
                      }}
                      style={[styles.badge, payment.status === 'Paid' ? styles.paidBadge : styles.pendingBadge]}
                    >
                      <Text style={[styles.badgeText, payment.status === 'Paid' ? styles.paidText : styles.pendingText]}>
                        {payment.status}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(payment);
                  }}
                  style={styles.deleteBtn}
                >
                  <Trash2 size={15} color="#DC2626" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Plus size={20} color="#fff" />
        <Text style={styles.fabText}>Add Payment</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Payment' : 'Add Payment'}</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Date — calendar picker, not free text */}
              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity
                style={[styles.dateBtn, errors.date && styles.fieldInputError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateBtnIcon}>📅</Text>
                <Text style={[styles.dateBtnText, !date && styles.dateBtnPlaceholder]}>
                  {date ? formatDisplayDate(date) : 'Select date'}
                </Text>
              </TouchableOpacity>
              {errors.date && <Text style={styles.errorText}>{errors.date}</Text>}

              {showDatePicker && (
                <View style={styles.pickerContainer}>
                  {Platform.OS === 'ios' ? (
                    <>
                      <DateTimePicker
                        value={dateObj}
                        mode="date"
                        display="spinner"
                        onChange={(_: any, selected: Date | undefined) => {
                          if (selected) {
                            setDateObj(selected);
                            setDate(selected.toISOString().split('T')[0]);
                          }
                        }}
                      />
                      <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.doneBtnText}>Done</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <DateTimePicker
                      value={dateObj}
                      mode="date"
                      display="default"
                      onChange={(_: any, selected: Date | undefined) => {
                        setShowDatePicker(false);
                        if (selected) {
                          setDateObj(selected);
                          setDate(selected.toISOString().split('T')[0]);
                        }
                      }}
                    />
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>Milestone</Text>
              <TextInput
                style={[styles.fieldInput, errors.milestone && styles.fieldInputError]}
                value={milestone}
                onChangeText={setMilestone}
                placeholder="Milestone"
                placeholderTextColor="#9CA3AF"
              />
              {errors.milestone && <Text style={styles.errorText}>{errors.milestone}</Text>}

              <Text style={styles.fieldLabel}>Amount (₹)</Text>
              <TextInput
                style={[styles.fieldInput, errors.amount && styles.fieldInputError]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Amount (₹)"
                placeholderTextColor="#9CA3AF"
              />
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.statusRow}>
                {(['Paid', 'Pending'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statusChip, status === s && styles.statusChipActive]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editingId ? 'Save Changes' : 'Add Payment'}</Text>
                )}
              </TouchableOpacity>

              {editingId && (
                <TouchableOpacity
                  style={styles.deleteFullBtn}
                  onPress={() => {
                    const payment = payments.find((p) => p.id === editingId);
                    if (payment) {
                      setModalVisible(false);
                      handleDelete(payment);
                    }
                  }}
                >
                  <Trash2 size={16} color="#DC2626" />
                  <Text style={styles.deleteFullBtnText}>Delete Payment</Text>
                </TouchableOpacity>
              )}
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
  addIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 15, fontWeight: '700' },
  summaryLabel: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  list: { padding: 16, paddingBottom: 100 },
  listTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  listHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentDate: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  paymentMilestone: { fontSize: 14, fontWeight: '600', color: '#111827' },
  paymentRight: { alignItems: 'flex-end', gap: 6 },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  paidBadge: { backgroundColor: '#ECFDF5' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  paidText: { color: '#059669' },
  pendingText: { color: '#D97706' },
  deleteBtn: { padding: 6, marginLeft: 8 },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#1A56DB',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  fieldInputError: { borderColor: '#DC2626' },
  errorText: { fontSize: 11, color: '#DC2626', marginTop: 4 },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
  },
  dateBtnIcon: { fontSize: 16 },
  dateBtnText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  dateBtnPlaceholder: { color: '#9CA3AF', fontWeight: '400' },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 8,
    overflow: 'hidden',
  },
  doneBtn: { backgroundColor: '#1A56DB', padding: 12, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusChip: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  statusChipActive: { backgroundColor: '#1A56DB' },
  statusChipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  statusChipTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  deleteFullBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 44,
    marginTop: 12,
  },
  deleteFullBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 14 },
});
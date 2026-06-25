import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import {
  collection, query, where, onSnapshot,
  addDoc, getDocs, updateDoc, deleteDoc, doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Payment, Project } from '@/types';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { Plus, X, Pencil, Trash2, Calendar } from 'lucide-react-native';

const DateTimePicker = require('@react-native-community/datetimepicker').default;

type PaymentWithProject = Payment & { projectName: string; projectId: string };

const EMPTY_FORM = {
  selectedProject: '',
  milestone: '',
  amount: '',
  date: '',
  status: 'Paid' as 'Paid' | 'Pending',
};

export default function PaymentsScreen() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentWithProject | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedProject, setSelectedProject] = useState('');
  const [milestone, setMilestone] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [dateObj, setDateObj] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [status, setStatus] = useState<'Paid' | 'Pending'>('Paid');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const projectList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(projectList);

      const allPayments: PaymentWithProject[] = [];
      for (const proj of projectList) {
        const pSnap = await getDocs(collection(db, 'projects', proj.id, 'payments'));
        pSnap.docs.forEach((pd) => {
          allPayments.push({
            id: pd.id,
            ...pd.data(),
            projectName: proj.projectName,
            projectId: proj.id,
          } as PaymentWithProject);
        });
      }
      allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(allPayments);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  const totalEstimate = projects.reduce((s, p) => s + (p.estimate?.total || 0), 0);
  const totalPaid = payments.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  const remaining = totalEstimate - totalPaid;

  // ── Open modal for Add ──────────────────────────────────────────────────────
  const openAddModal = () => {
    setEditingPayment(null);
    setSelectedProject('');
    setMilestone('');
    setAmount('');
    setDate('');
    setDateObj(new Date());
    setStatus('Paid');
    setErrors({});
    setModalVisible(true);
  };

  // ── Open modal for Edit ─────────────────────────────────────────────────────
  const openEditModal = (payment: PaymentWithProject) => {
    setEditingPayment(payment);
    setSelectedProject(payment.projectId);
    setMilestone(payment.milestone);
    setAmount(payment.amount.toString());
    setDate(payment.date);
    setDateObj(payment.date ? new Date(payment.date) : new Date());
    setStatus(payment.status);
    setErrors({});
    setModalVisible(true);
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedProject) {
      newErrors.project = 'Please select a project.';
    }
    if (!date.trim()) {
      newErrors.date = 'Date is required.';
    } else {
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        newErrors.date = 'Please enter a valid date.';
      }
    }
    if (!milestone.trim()) {
      newErrors.milestone = 'Milestone is required.';
    }
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required.';
    } else if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Please enter a valid amount greater than 0.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Add payment ─────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'projects', selectedProject, 'payments'), {
        projectId: selectedProject,
        date,
        milestone: milestone.trim(),
        amount: parseFloat(amount),
        status,
        createdAt: new Date(),
      });
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Could not add payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit payment ────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!validate() || !editingPayment) return;
    setSaving(true);
    try {
      await updateDoc(
        doc(db, 'projects', editingPayment.projectId, 'payments', editingPayment.id),
        {
          date,
          milestone: milestone.trim(),
          amount: parseFloat(amount),
          status,
          updatedAt: new Date(),
        }
      );
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Could not update payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete payment ──────────────────────────────────────────────────────────
  const handleDelete = (payment: PaymentWithProject) => {
    Alert.alert(
      'Delete Payment',
      `Are you sure you want to delete "${payment.milestone}" payment of ${formatCurrency(payment.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'projects', payment.projectId, 'payments', payment.id));
            } catch (e) {
              Alert.alert('Error', 'Could not delete payment.');
            }
          },
        },
      ]
    );
  };

  // ── Toggle status directly on card ─────────────────────────────────────────
  const handleToggleStatus = async (payment: PaymentWithProject) => {
    const newStatus = payment.status === 'Paid' ? 'Pending' : 'Paid';
    try {
      await updateDoc(
        doc(db, 'projects', payment.projectId, 'payments', payment.id),
        { status: newStatus, updatedAt: new Date() }
      );
    } catch (e) {
      Alert.alert('Error', 'Could not update status.');
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const closeModal = () => {
    setModalVisible(false);
    setErrors({});
    setEditingPayment(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Plus size={18} color="#fff" />
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
            <Text style={[styles.summaryValue, { color: item.color }]}>
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
          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptyDesc}>Tap "Add Payment" to record your first payment</Text>
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentMain}>
                  <View style={styles.paymentLeft}>
                    <Text style={styles.paymentDate}>{formatDate(payment.date)}</Text>
                    <Text style={styles.paymentMilestone}>{payment.milestone}</Text>
                    <Text style={styles.paymentProject}>{payment.projectName}</Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                    {/* Tap badge to toggle status */}
                    <TouchableOpacity
                      onPress={() => handleToggleStatus(payment)}
                      style={[styles.badge, payment.status === 'Paid' ? styles.paidBadge : styles.pendingBadge]}
                    >
                      <Text style={[styles.badgeText, payment.status === 'Paid' ? styles.paidText : styles.pendingText]}>
                        {payment.status}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Edit / Delete actions */}
                <View style={styles.paymentActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(payment)}
                  >
                    <Pencil size={13} color="#1A56DB" />
                    <Text style={styles.actionBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <View style={styles.actionDivider} />
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(payment)}
                  >
                    <Trash2 size={13} color="#DC2626" />
                    <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Plus size={20} color="#fff" />
        <Text style={styles.fabText}>Add Payment</Text>
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPayment ? 'Edit Payment' : 'Add Payment'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              {/* Project selector — only for new payments */}
              {!editingPayment && (
                <>
                  <Text style={styles.fieldLabel}>Project *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectPicker}>
                    {projects.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.projectChip, selectedProject === p.id && styles.projectChipActive]}
                        onPress={() => {
                          setSelectedProject(p.id);
                          setErrors(prev => ({ ...prev, project: '' }));
                        }}
                      >
                        <Text style={[styles.projectChipText, selectedProject === p.id && styles.projectChipTextActive]}>
                          {p.projectName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {errors.project ? <Text style={styles.errorText}>{errors.project}</Text> : null}
                </>
              )}

              {/* Editing — show project name as read only */}
              {editingPayment && (
                <>
                  <Text style={styles.fieldLabel}>Project</Text>
                  <View style={styles.readOnlyField}>
                    <Text style={styles.readOnlyText}>{editingPayment.projectName}</Text>
                  </View>
                </>
              )}

              {/* Date picker */}
              <Text style={styles.fieldLabel}>Date *</Text>
              <TouchableOpacity
                style={[styles.dateBtn, errors.date && styles.fieldError]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} color="#6B7280" />
                <Text style={[styles.dateBtnText, !date && styles.dateBtnPlaceholder]}>
                  {date ? formatDisplayDate(date) : 'Select date'}
                </Text>
              </TouchableOpacity>
              {errors.date ? <Text style={styles.errorText}>{errors.date}</Text> : null}

              {showDatePicker && (
                <View style={styles.pickerContainer}>
                  {Platform.OS === 'ios' ? (
                    <>
                      <DateTimePicker
                        value={dateObj}
                        mode="date"
                        display="spinner"
                        onChange={(_: any, d: Date | undefined) => {
                          if (d) {
                            setDateObj(d);
                            setDate(d.toISOString().split('T')[0]);
                            setErrors(prev => ({ ...prev, date: '' }));
                          }
                        }}
                      />
                      <TouchableOpacity style={styles.pickerDoneBtn} onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.pickerDoneBtnText}>Done</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <DateTimePicker
                      value={dateObj}
                      mode="date"
                      display="default"
                      onChange={(_: any, d: Date | undefined) => {
                        setShowDatePicker(false);
                        if (d) {
                          setDateObj(d);
                          setDate(d.toISOString().split('T')[0]);
                          setErrors(prev => ({ ...prev, date: '' }));
                        }
                      }}
                    />
                  )}
                </View>
              )}

              {/* Milestone */}
              <Text style={styles.fieldLabel}>Milestone *</Text>
              <TextInput
                style={[styles.fieldInput, errors.milestone && styles.fieldError]}
                value={milestone}
                onChangeText={(t) => {
                  setMilestone(t);
                  setErrors(prev => ({ ...prev, milestone: '' }));
                }}
                placeholder="e.g. Foundation Completed"
                placeholderTextColor="#9CA3AF"
              />
              {errors.milestone ? <Text style={styles.errorText}>{errors.milestone}</Text> : null}

              {/* Amount */}
              <Text style={styles.fieldLabel}>Amount (₹) *</Text>
              <TextInput
                style={[styles.fieldInput, errors.amount && styles.fieldError]}
                value={amount}
                onChangeText={(t) => {
                  setAmount(t);
                  setErrors(prev => ({ ...prev, amount: '' }));
                }}
                keyboardType="numeric"
                placeholder="e.g. 50000"
                placeholderTextColor="#9CA3AF"
              />
              {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}

              {/* Status */}
              <Text style={styles.fieldLabel}>Status *</Text>
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

              {/* Save button */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={editingPayment ? handleEdit : handleAdd}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnText}>
                      {editingPayment ? 'Save Changes' : 'Add Payment'}
                    </Text>
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1A56DB', justifyContent: 'center', alignItems: 'center',
  },
  summary: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  list: { padding: 16, paddingBottom: 100 },
  listTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  paymentCard: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: 'hidden',
  },
  paymentMain: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 14,
  },
  paymentLeft: {},
  paymentDate: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  paymentMilestone: { fontSize: 14, fontWeight: '600', color: '#111827' },
  paymentProject: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  paymentRight: { alignItems: 'flex-end', gap: 6 },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  paidBadge: { backgroundColor: '#ECFDF5' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  paidText: { color: '#059669' },
  pendingText: { color: '#D97706' },
  paymentActions: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F9FAFB',
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#1A56DB' },
  actionDivider: { width: 1, backgroundColor: '#F3F4F6' },
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
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 14 },
  fieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    height: 44, paddingHorizontal: 12, fontSize: 14,
    color: '#111827', backgroundColor: '#F9FAFB',
  },
  fieldError: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  readOnlyField: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    height: 44, paddingHorizontal: 12, justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  readOnlyText: { fontSize: 14, color: '#6B7280' },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    height: 44, paddingHorizontal: 12, backgroundColor: '#F9FAFB',
  },
  dateBtnText: { fontSize: 14, color: '#111827' },
  dateBtnPlaceholder: { color: '#9CA3AF' },
  pickerContainer: {
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 6, overflow: 'hidden',
  },
  pickerDoneBtn: { backgroundColor: '#1A56DB', padding: 10, alignItems: 'center' },
  pickerDoneBtnText: { color: '#fff', fontWeight: '600' },
  projectPicker: { marginBottom: 4 },
  projectChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, backgroundColor: '#F3F4F6', marginRight: 8,
  },
  projectChipActive: { backgroundColor: '#1A56DB' },
  projectChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  projectChipTextActive: { color: '#fff' },
  statusRow: { flexDirection: 'row', gap: 10 },
  statusChip: {
    flex: 1, height: 40, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6',
  },
  statusChipActive: { backgroundColor: '#1A56DB' },
  statusChipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  statusChipTextActive: { color: '#fff' },
  saveBtn: {
    backgroundColor: '#1A56DB', borderRadius: 10, height: 50,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
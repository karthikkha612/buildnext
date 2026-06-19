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
} from 'react-native';
import { collection, query, where, onSnapshot, addDoc, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Payment, Project } from '@/types';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { Plus, X } from 'lucide-react-native';

export default function PaymentsScreen() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<(Payment & { projectName: string })[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [milestone, setMilestone] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<'Paid' | 'Pending'>('Paid');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const projectList = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
      setProjects(projectList);

      const allPayments: (Payment & { projectName: string })[] = [];
      for (const proj of projectList) {
        const pSnap = await import('firebase/firestore').then(({ getDocs }) =>
          getDocs(collection(db, 'projects', proj.id, 'payments'))
        );
        pSnap.docs.forEach((pd) => {
          allPayments.push({
            id: pd.id,
            ...pd.data(),
            projectName: proj.projectName,
          } as Payment & { projectName: string });
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

  const handleAdd = async () => {
    if (!selectedProject || !milestone || !amount || !date) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'projects', selectedProject, 'payments'), {
        projectId: selectedProject,
        date,
        milestone,
        amount: parseFloat(amount),
        status,
        createdAt: new Date(),
      });
      setModalVisible(false);
      setMilestone('');
      setAmount('');
      setDate('');
      setSelectedProject('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
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
            </View>
          ) : (
            payments.map((payment) => (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentLeft}>
                  <Text style={styles.paymentDate}>{formatDate(payment.date)}</Text>
                  <Text style={styles.paymentMilestone}>{payment.milestone}</Text>
                  <Text style={styles.paymentProject}>{payment.projectName}</Text>
                </View>
                <View style={styles.paymentRight}>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                  <View style={[styles.badge, payment.status === 'Paid' ? styles.paidBadge : styles.pendingBadge]}>
                    <Text style={[styles.badgeText, payment.status === 'Paid' ? styles.paidText : styles.pendingText]}>
                      {payment.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus size={20} color="#fff" />
        <Text style={styles.fabText}>Add Payment</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Payment</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Project</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.projectPicker}>
              {projects.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.projectChip, selectedProject === p.id && styles.projectChipActive]}
                  onPress={() => setSelectedProject(p.id)}
                >
                  <Text style={[styles.projectChipText, selectedProject === p.id && styles.projectChipTextActive]}>
                    {p.projectName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {[
              { label: 'Date (YYYY-MM-DD)', value: date, setter: setDate, keyboard: 'default' as any },
              { label: 'Milestone', value: milestone, setter: setMilestone, keyboard: 'default' as any },
              { label: 'Amount (₹)', value: amount, setter: setAmount, keyboard: 'numeric' as any },
            ].map((field) => (
              <View key={field.label}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={field.value}
                  onChangeText={field.setter}
                  keyboardType={field.keyboard}
                  placeholderTextColor="#9CA3AF"
                  placeholder={field.label}
                />
              </View>
            ))}

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

            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Payment</Text>}
            </TouchableOpacity>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A56DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  list: { padding: 16, paddingBottom: 100 },
  listTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
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
  paymentLeft: {},
  paymentDate: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  paymentMilestone: { fontSize: 14, fontWeight: '600', color: '#111827' },
  paymentProject: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  paymentRight: { alignItems: 'flex-end', gap: 6 },
  paymentAmount: { fontSize: 15, fontWeight: '700', color: '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  paidBadge: { backgroundColor: '#ECFDF5' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  paidText: { color: '#059669' },
  pendingText: { color: '#D97706' },
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
    paddingBottom: 40,
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
  projectPicker: { marginBottom: 4 },
  projectChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  projectChipActive: { backgroundColor: '#1A56DB' },
  projectChipText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  projectChipTextActive: { color: '#fff' },
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
});

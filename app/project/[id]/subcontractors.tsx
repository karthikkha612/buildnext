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
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, Subcontractor } from '@/types';
import { getInitials } from '@/lib/formatting';
import { ArrowLeft, Plus, X, Phone } from 'lucide-react-native';

const ROLES = ['Mason', 'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Other'];
const NAME_REGEX = /^[A-Za-z\s]+$/;
const PHONE_REGEX = /^\d{10}$/;

type FieldErrors = { name?: string; phone?: string; role?: string };

export default function SubcontractorsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const validate = (): boolean => {
    const next: FieldErrors = {};
    const trimmedName = name.trim();

    if (!trimmedName) next.name = 'Name is required.';
    else if (trimmedName.length < 2) next.name = 'Name must be at least 2 characters.';
    else if (!NAME_REGEX.test(trimmedName)) next.name = 'Name can only contain letters and spaces.';

    if (!phone.trim()) next.phone = 'Phone number is required.';
    else if (!PHONE_REGEX.test(phone.trim())) next.phone = 'Enter a valid 10-digit phone number.';

    if (!role) next.role = 'Please select a role.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 10));
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setRole('');
    setErrors({});
  };

  const handleAdd = async () => {
    if (!validate()) return;
    const newSub: Subcontractor = {
      id: Date.now().toString(),
      name: name.trim(),
      role,
      phone: phone.trim(),
      status: 'active',
    };
    const updated = [...(project?.subcontractors || []), newSub];
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', id!), { subcontractors: updated, updatedAt: new Date() });
      setModalVisible(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (subId: string) => {
    const updated = (project?.subcontractors || []).filter((s) => s.id !== subId);
    await updateDoc(doc(db, 'projects', id!), { subcontractors: updated, updatedAt: new Date() });
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;

  const subcontractors = project?.subcontractors || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subcontractors</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetForm(); setModalVisible(true); }}>
          <Plus size={16} color="#1A56DB" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {subcontractors.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👷</Text>
            <Text style={styles.emptyTitle}>No subcontractors added</Text>
            <Text style={styles.emptyDesc}>Add subcontractors working on this project.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => { resetForm(); setModalVisible(true); }}>
              <Text style={styles.emptyBtnText}>+ Add Subcontractor</Text>
            </TouchableOpacity>
          </View>
        ) : (
          subcontractors.map((sub) => (
            <View key={sub.id} style={styles.subCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(sub.name)}</Text>
              </View>
              <View style={styles.subInfo}>
                <Text style={styles.subName}>{sub.name}</Text>
                <Text style={styles.subRole}>{sub.role}</Text>
                <View style={styles.phoneRow}>
                  <Phone size={11} color="#9CA3AF" />
                  <Text style={styles.subPhone}>{sub.phone}</Text>
                </View>
              </View>
              <View style={styles.subRight}>
                <View style={[styles.badge, sub.status === 'active' ? styles.activeBadge : styles.pendingBadge]}>
                  <Text style={[styles.badgeText, sub.status === 'active' ? styles.activeText : styles.pendingText]}>
                    {sub.status === 'active' ? 'Active' : 'Pending'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(sub.id)} style={styles.removeBtn}>
                  <X size={14} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.nextBtn} onPress={() => router.push(`/project/${id}/timeline` as any)}>
          <Text style={styles.nextBtnText}>Next: Timeline</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Subcontractor</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={[styles.fieldInput, errors.name && styles.fieldInputError]}
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
              placeholder="Full Name"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={[styles.fieldInput, errors.phone && styles.fieldInputError]}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={10}
              placeholderTextColor="#9CA3AF"
              placeholder="Phone Number"
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

            <Text style={styles.fieldLabel}>Role</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleScroll}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, role === r && styles.roleChipActive]}
                  onPress={() => setRole(r)}
                >
                  <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}

            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Subcontractor</Text>}
            </TouchableOpacity>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1A56DB',
  },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#1A56DB' },
  content: { padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  emptyBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: '#1A56DB' },
  subInfo: { flex: 1, marginLeft: 12 },
  subName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  subRole: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  subPhone: { fontSize: 11, color: '#9CA3AF' },
  subRight: { alignItems: 'flex-end', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeBadge: { backgroundColor: '#ECFDF5' },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  activeText: { color: '#059669' },
  pendingText: { color: '#D97706' },
  removeBtn: { padding: 4 },
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
  fieldInputError: { borderColor: '#DC2626' },
  errorText: { fontSize: 11, color: '#DC2626', marginTop: 4 },
  roleScroll: { marginBottom: 4, marginTop: 2 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  roleChipActive: { backgroundColor: '#1A56DB' },
  roleChipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  roleChipTextActive: { color: '#fff' },
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
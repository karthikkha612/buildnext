import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project } from '@/types';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { ArrowLeft, MoreVertical, MapPin, SquarePen, Share2, X } from 'lucide-react-native';

const COVER_IMAGES = [
  'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?w=800&auto=compress',
  'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?w=800&auto=compress',
  'https://images.pexels.com/photos/1115804/pexels-photo-1115804.jpeg?w=800&auto=compress',
  'https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?w=800&auto=compress',
];

const NAV_ITEMS = [
  { label: 'Progress', route: 'progress', icon: '📊' },
  { label: 'Materials', route: 'materials', icon: '🧱' },
  { label: 'Subcontractors', route: 'subcontractors', icon: '👷' },
  { label: 'Timeline', route: 'timeline', icon: '📅' },
  { label: 'Notify Customer', route: 'notify', icon: '📣' },
  { label: 'Payments', route: 'payments', icon: '💰' },
  { label: 'Reports', route: 'reports', icon: '📋' },
];

export default function ProjectSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form fields
  const [projectName, setProjectName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [plotArea, setPlotArea] = useState('');
  const [projectType, setProjectType] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() } as Project;
        setProject(p);
        setProjectName(p.projectName || '');
        setSiteLocation(p.siteLocation || '');
        setPlotArea(p.plotArea?.toString() || '');
        setProjectType(p.projectType || '');
        setCustomerName(p.customerName || '');
        setCustomerPhone(p.customerPhone || '');
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const handleSaveEdit = async () => {
    if (!projectName.trim() || !siteLocation.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', id!), {
        projectName: projectName.trim(),
        siteLocation: siteLocation.trim(),
        plotArea: parseFloat(plotArea) || 0,
        projectType: projectType.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        updatedAt: new Date(),
      });
      setEditModal(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator size="large" color="#1A56DB" /></View>;
  if (!project) return <View style={styles.loader}><Text style={{ color: '#6B7280' }}>Project not found.</Text></View>;

  const imgIdx = Math.abs(id!.charCodeAt(0) % COVER_IMAGES.length);
  const coverImg = project.coverPhoto || COVER_IMAGES[imgIdx];
  const statusColor = project.status === 'Completed' ? '#059669' : project.status === 'In Progress' ? '#D97706' : '#6B7280';
  const statusBg = project.status === 'Completed' ? '#ECFDF5' : project.status === 'In Progress' ? '#FEF3C7' : '#F3F4F6';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.coverContainer}>
          <Image source={{ uri: coverImg }} style={styles.coverImage} resizeMode="cover" />
          <View style={styles.coverOverlay} />
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.moreBtn}>
            <MoreVertical size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.coverInfo}>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{project.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.projectName}>{project.projectName}</Text>
          <View style={styles.locationRow}>
            <MapPin size={14} color="#6B7280" />
            <Text style={styles.locationText}>{project.siteLocation}</Text>
          </View>

          <View style={styles.detailsCard}>
            {[
              { label: 'Start Date', value: formatDate(project.startDate) },
              { label: 'Expected Completion', value: formatDate(project.expectedCompletion) },
              { label: 'Project Type', value: project.projectType },
              { label: 'Plot Area', value: project.plotArea ? `${project.plotArea} Sq.Ft.` : '-' },
            ].map((item) => (
              <View key={item.label} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value || '-'}</Text>
              </View>
            ))}
          </View>

          <View style={styles.financialCard}>
            <Text style={styles.cardTitle}>Financials</Text>
            {[
              { label: 'Total Estimate', value: project.estimate?.total || 0, color: '#111827' },
              { label: 'Paid Amount', value: 0, color: '#059669' },
              { label: 'Remaining', value: project.estimate?.total || 0, color: '#DC2626' },
            ].map((item) => (
              <View key={item.label} style={styles.financialRow}>
                <Text style={styles.financialLabel}>{item.label}</Text>
                <Text style={[styles.financialValue, { color: item.color }]}>{formatCurrency(item.value)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.navGrid}>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.navItem}
                onPress={() => router.push(`/project/${id}/${item.route}` as any)}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text style={styles.navLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.editBtn} onPress={() => setEditModal(true)}>
          <SquarePen size={18} color="#1A56DB" />
          <Text style={styles.editBtnText}>Edit Project</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={() => router.push(`/project/${id}/reports` as any)}>
          <Share2 size={18} color="#fff" />
          <Text style={styles.shareBtnText}>Share Report</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Project</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <X size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: 'Project Name', value: projectName, setter: setProjectName },
                { label: 'Site Location', value: siteLocation, setter: setSiteLocation },
                { label: 'Plot Area (Sq.Ft)', value: plotArea, setter: setPlotArea, keyboard: 'numeric' as any },
                { label: 'Project Type', value: projectType, setter: setProjectType },
                { label: 'Customer Name', value: customerName, setter: setCustomerName },
                { label: 'Customer Phone', value: customerPhone, setter: setCustomerPhone, keyboard: 'phone-pad' as any },
              ].map((field) => (
                <View key={field.label}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={field.keyboard || 'default'}
                    placeholder={field.label}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              ))}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  coverContainer: { height: 220, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)' },
  backBtn: {
    position: 'absolute', top: 52, left: 16, width: 40, height: 40,
    borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  moreBtn: {
    position: 'absolute', top: 52, right: 16, width: 40, height: 40,
    borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  coverInfo: { position: 'absolute', bottom: 16, left: 16 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 100 },
  projectName: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  locationText: { fontSize: 14, color: '#6B7280' },
  detailsCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right', flex: 1, marginLeft: 16 },
  financialCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  financialRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  financialLabel: { fontSize: 13, color: '#6B7280' },
  financialValue: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  navItem: {
    width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  navIcon: { fontSize: 24 },
  navLabel: { fontSize: 11, fontWeight: '500', color: '#374151', textAlign: 'center' },
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 32,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, borderWidth: 1.5, borderColor: '#1A56DB', borderRadius: 10, gap: 8,
  },
  editBtnText: { color: '#1A56DB', fontWeight: '600', fontSize: 14 },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, backgroundColor: '#1A56DB', borderRadius: 10, gap: 8,
  },
  shareBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 12 },
  fieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, height: 44,
    paddingHorizontal: 12, fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
  },
  saveBtn: {
    backgroundColor: '#1A56DB', borderRadius: 10, height: 50,
    justifyContent: 'center', alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
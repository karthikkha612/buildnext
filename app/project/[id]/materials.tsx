import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, MATERIALS_STRUCTURE, MATERIALS_FINISHING, MATERIALS_OTHERS } from '@/types';
import { ArrowLeft, X } from 'lucide-react-native';

const MATERIAL_TABS = [
  { key: 'structure', label: 'Structure', items: MATERIALS_STRUCTURE },
  { key: 'finishing', label: 'Finishing', items: MATERIALS_FINISHING },
  { key: 'others', label: 'Others', items: MATERIALS_OTHERS },
];

export default function MaterialsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('structure');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() } as Project;
        setProject(p);
        setSelected(p.materials || []);
      }
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const toggleMaterial = (materialId: string) => {
    setSelected((prev) =>
      prev.includes(materialId) ? prev.filter((m) => m !== materialId) : [...prev, materialId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'projects', id!), { materials: selected, updatedAt: new Date() });
      router.push(`/project/${id}/subcontractors` as any);
    } finally {
      setSaving(false);
    }
  };

  const currentTab = MATERIAL_TABS.find((t) => t.key === activeTab)!;
  const allMaterials = MATERIAL_TABS.flatMap((t) => t.items);

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Material Selection</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.hint}>Tap materials to add to your list</Text>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {MATERIAL_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Material grid */}
        <View style={styles.grid}>
          {currentTab.items.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.materialCard, isSelected && styles.materialCardSelected]}
                onPress={() => toggleMaterial(item.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.materialIcon}>{item.icon}</Text>
                <Text style={[styles.materialLabel, isSelected && styles.materialLabelSelected]}>{item.label}</Text>
                {isSelected && (
                  <View style={styles.checkDot}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected tray */}
        {selected.length > 0 && (
          <View style={styles.tray}>
            <Text style={styles.trayTitle}>Selected Materials ({selected.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trayScroll}>
              {selected.map((matId) => {
                const mat = allMaterials.find((m) => m.id === matId);
                if (!mat) return null;
                return (
                  <View key={matId} style={styles.trayChip}>
                    <Text style={styles.trayIcon}>{mat.icon}</Text>
                    <Text style={styles.trayLabel}>{mat.label}</Text>
                    <TouchableOpacity onPress={() => toggleMaterial(matId)} style={styles.removeBtn}>
                      <X size={12} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.nextBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>Next: Subcontractors</Text>}
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
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  hint: { fontSize: 12, color: '#6B7280', textAlign: 'center', paddingVertical: 8, backgroundColor: '#F9FAFB' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#1A56DB' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  activeTabText: { color: '#1A56DB', fontWeight: '600' },
  content: { padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  materialCard: {
    width: '30%',
    aspectRatio: 0.9,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  materialCardSelected: { borderColor: '#1A56DB', backgroundColor: '#EFF6FF' },
  materialIcon: { fontSize: 32 },
  materialLabel: { fontSize: 12, fontWeight: '500', color: '#374151' },
  materialLabelSelected: { color: '#1A56DB', fontWeight: '600' },
  checkDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1A56DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tray: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  trayTitle: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 10 },
  trayScroll: {},
  trayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A56DB',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    gap: 4,
  },
  trayIcon: { fontSize: 14 },
  trayLabel: { fontSize: 12, fontWeight: '500', color: '#fff' },
  removeBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
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

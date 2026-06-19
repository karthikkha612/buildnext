import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project } from '@/types';
import { ArrowLeft, ChevronRight, Download } from 'lucide-react-native';

const REPORTS = [
  {
    id: 'project',
    icon: '📊',
    title: 'Project Report',
    description: 'Overall project summary',
  },
  {
    id: 'material',
    icon: '🧱',
    title: 'Material Usage Report',
    description: 'Material used and remaining',
  },
  {
    id: 'progress',
    icon: '📈',
    title: 'Work Progress Report',
    description: 'Phase wise progress',
  },
  {
    id: 'payment',
    icon: '💳',
    title: 'Payment Report',
    description: 'All payments and dues',
  },
  {
    id: 'subcontractor',
    icon: '👷',
    title: 'Subcontractor Report',
    description: 'Subcontractor work status',
  },
  {
    id: 'daily',
    icon: '📋',
    title: 'Daily Site Report',
    description: 'Daily activities on site',
  },
];

export default function ReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const handleDownload = async (reportId: string, reportTitle: string) => {
    setDownloading(reportId);
    setTimeout(() => {
      setDownloading(null);
      Alert.alert('Report Ready', `${reportTitle} has been generated successfully.`);
    }, 1500);
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      {project && (
        <View style={styles.projectBanner}>
          <Text style={styles.projectBannerName}>{project.projectName}</Text>
          <Text style={styles.projectBannerLocation}>{project.siteLocation}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {REPORTS.map((report) => (
          <TouchableOpacity
            key={report.id}
            style={styles.reportCard}
            onPress={() => handleDownload(report.id, report.title)}
            activeOpacity={0.8}
          >
            <View style={styles.reportIcon}>
              <Text style={styles.reportIconText}>{report.icon}</Text>
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <Text style={styles.reportDesc}>{report.description}</Text>
            </View>
            {downloading === report.id ? (
              <ActivityIndicator size="small" color="#1A56DB" />
            ) : (
              <ChevronRight size={18} color="#D1D5DB" />
            )}
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.downloadAllBtn}
          onPress={() => handleDownload('all', 'Complete Project Report')}
          disabled={downloading !== null}
        >
          {downloading === 'all' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Download size={18} color="#fff" />
              <Text style={styles.downloadAllBtnText}>Download Report</Text>
            </>
          )}
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
  projectBanner: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  projectBannerName: { fontSize: 13, fontWeight: '700', color: '#1A56DB' },
  projectBannerLocation: { fontSize: 11, color: '#6B7280' },
  content: { padding: 16 },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportIconText: { fontSize: 22 },
  reportInfo: { flex: 1 },
  reportTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reportDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  bottomBar: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  downloadAllBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 12,
    height: 52,
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
  downloadAllBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

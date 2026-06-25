import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, PhaseStatus, ProjectDocument } from '@/types';
import { ArrowLeft, FileText, Upload, CheckCircle, XCircle, Download } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

const CIRCLE_RADIUS = 60;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

function CircularProgress({ progress }: { progress: number }) {
  const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - progress / 100);
  return (
    <View style={styles.circleContainer}>
      <Svg width={160} height={160} viewBox="0 0 160 160">
        <Circle cx={80} cy={80} r={CIRCLE_RADIUS} stroke="#EFF6FF" strokeWidth={14} fill="none" />
        <Circle
          cx={80} cy={80} r={CIRCLE_RADIUS}
          stroke="#1A56DB" strokeWidth={14} fill="none"
          strokeDasharray={CIRCLE_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
        />
      </Svg>
      <View style={styles.circleLabel}>
        <Text style={styles.circlePercent}>{progress}%</Text>
        <Text style={styles.circleStatus}>Overall</Text>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  // ─── Document upload for Phase 0 ───────────────────────────────────────────
  const handleDocUpload = async (docId: string) => {
    if (!project) return;
    setUploading(docId);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const updatedDocs: ProjectDocument[] = (project.documents || []).map((d) =>
          d.id === docId
            ? { ...d, available: true, fileUri: asset.uri, fileName: asset.name, uploadedAt: new Date().toISOString() }
            : d
        );

        // Check if all previously missing docs are now uploaded
        const allUploaded = updatedDocs.every((d) => d.available);

        // Update phases — if all docs uploaded, mark Phase 0 as completed
        const updatedPhases = (project.phases || []).map((p, i) => {
          if (i === 0 && p.name === 'Document Collection') {
            return allUploaded
              ? { ...p, progress: 100, status: 'completed' as const }
              : { ...p, progress: Math.round((updatedDocs.filter(d => d.available).length / updatedDocs.length) * 100), status: 'in_progress' as const };
          }
          return p;
        });

        const overall = Math.round(updatedPhases.reduce((s, p) => s + p.progress, 0) / updatedPhases.length);
        const projectStatus = overall === 100 ? 'Completed' : overall > 0 ? 'In Progress' : 'Planning';

        await updateDoc(doc(db, 'projects', id!), {
          documents: updatedDocs,
          phases: updatedPhases,
          overallProgress: overall,
          status: projectStatus,
          updatedAt: new Date(),
        });

        if (allUploaded) {
          Alert.alert(
            '✅ All Documents Uploaded!',
            'Phase 0 — Document Collection is now complete. Construction phases are ready to begin!'
          );
        } else {
          Alert.alert('Uploaded!', `${asset.name} uploaded successfully.`);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick document. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  // ─── View / share an uploaded document ─────────────────────────────────────
  const handleViewDoc = async (document: ProjectDocument) => {
    if (!document.fileUri) return;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(document.fileUri, {
          dialogTitle: `View — ${document.name}`,
        });
      } else {
        Alert.alert('Cannot open', 'Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open document.');
    }
  };

  // ─── Phase progress for normal phases ──────────────────────────────────────
  const handlePhaseProgress = async (idx: number, progress: number) => {
    if (!project) return;
    const updatedPhases = project.phases.map((p, i) => {
      if (i !== idx) return p;
      const status = progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'upcoming';
      return { ...p, progress, status };
    });
    const overall = Math.round(updatedPhases.reduce((s, p) => s + p.progress, 0) / updatedPhases.length);
    const projectStatus = overall === 100 ? 'Completed' : overall > 0 ? 'In Progress' : 'Planning';
    await updateDoc(doc(db, 'projects', id!), {
      phases: updatedPhases,
      overallProgress: overall,
      status: projectStatus,
      updatedAt: new Date(),
    });
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;
  if (!project) return <View style={styles.loader}><Text>Project not found.</Text></View>;

  const phases = project.phases || [];
  const documents = project.documents || [];
  const isPhase0 = phases.length > 0 && phases[0].name === 'Document Collection';
  const phase0 = isPhase0 ? phases[0] : null;
  const phase0Complete = phase0?.status === 'completed';

  // Docs that were missing (not available at project creation OR still missing)
  const missingDocs = documents.filter((d) => !d.available || !d.fileName);
  const uploadedDocs = documents.filter((d) => d.available && d.fileName);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Progress Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Overall Progress</Text>
        <CircularProgress progress={project.overallProgress ?? 0} />

        {/* ── Phase 0 — Document Collection ── */}
        {isPhase0 && (
          <View style={[styles.phase0Card, phase0Complete && styles.phase0CardComplete]}>
            <View style={styles.phase0Header}>
              <View style={styles.phase0TitleRow}>
                <View style={[styles.phase0Badge, phase0Complete ? styles.phase0BadgeComplete : styles.phase0BadgePending]}>
                  <Text style={styles.phase0BadgeText}>Phase 0</Text>
                </View>
                <Text style={styles.phase0Title}>Document Collection</Text>
              </View>
              {phase0Complete
                ? <CheckCircle size={20} color="#059669" />
                : <XCircle size={20} color="#D97706" />
              }
            </View>

            {phase0Complete ? (
              <View style={styles.phase0DoneMsg}>
                <Text style={styles.phase0DoneMsgText}>
                  ✅ All documents collected. Construction phases are active!
                </Text>
              </View>
            ) : (
              <Text style={styles.phase0Subtitle}>
                Upload all missing documents to unlock construction phases.
              </Text>
            )}

            {/* Progress bar for Phase 0 */}
            <View style={styles.barContainer}>
              <View style={[styles.barFill, {
                width: `${phase0?.progress || 0}%` as any,
                backgroundColor: phase0Complete ? '#059669' : '#D97706',
              }]} />
            </View>
            <Text style={styles.phase0Progress}>
              {uploadedDocs.length} of {documents.length} documents uploaded ({phase0?.progress || 0}%)
            </Text>

            {/* Missing docs — upload section */}
            {!phase0Complete && missingDocs.length > 0 && (
              <View style={styles.missingDocsSection}>
                <Text style={styles.missingDocsSectionTitle}>📋 Missing Documents</Text>
                {missingDocs.map((document) => (
                  <View key={document.id} style={styles.missingDocRow}>
                    <View style={styles.missingDocIcon}>
                      <FileText size={16} color="#D97706" />
                    </View>
                    <Text style={styles.missingDocName} numberOfLines={1}>{document.name}</Text>
                    <TouchableOpacity
                      style={styles.uploadDocBtn}
                      onPress={() => handleDocUpload(document.id)}
                      disabled={uploading === document.id}
                    >
                      {uploading === document.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <>
                            <Upload size={12} color="#fff" />
                            <Text style={styles.uploadDocBtnText}>Upload</Text>
                          </>
                      }
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Uploaded docs — view section */}
            {uploadedDocs.length > 0 && (
              <View style={styles.uploadedDocsSection}>
                <Text style={styles.uploadedDocsSectionTitle}>✅ Uploaded Documents</Text>
                {uploadedDocs.map((document) => (
                  <TouchableOpacity
                    key={document.id}
                    style={styles.uploadedDocRow}
                    onPress={() => handleViewDoc(document)}
                  >
                    <View style={styles.uploadedDocIcon}>
                      <FileText size={16} color="#059669" />
                    </View>
                    <View style={styles.uploadedDocInfo}>
                      <Text style={styles.uploadedDocName} numberOfLines={1}>{document.name}</Text>
                      <Text style={styles.uploadedDocFile} numberOfLines={1}>📎 {document.fileName}</Text>
                    </View>
                    <Download size={16} color="#1A56DB" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Normal Construction Phases ── */}
        <Text style={styles.sectionLabel}>
          {isPhase0 ? 'Construction Phases' : 'Phase Progress'}
        </Text>

        {/* Lock construction phases if Phase 0 not complete */}
        {isPhase0 && !phase0Complete && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedBannerText}>
              🔒 Construction phases are locked until all documents are uploaded and Phase 0 is complete.
            </Text>
          </View>
        )}

        {phases
          .filter((_, idx) => !(idx === 0 && isPhase0)) // skip Phase 0 from this list
          .map((phase, idx) => {
            const realIdx = isPhase0 ? idx + 1 : idx;
            const isLocked = isPhase0 && !phase0Complete;
            return (
              <View key={phase.name} style={[styles.phaseCard, isLocked && styles.phaseCardLocked]}>
                <View style={styles.phaseHeader}>
                  <Text style={[styles.phaseName, isLocked && styles.phaseNameLocked]}>{phase.name}</Text>
                  <Text style={[styles.phasePercent, isLocked && { color: '#D1D5DB' }]}>
                    {isLocked ? '🔒' : `${phase.progress}%`}
                  </Text>
                </View>
                <View style={styles.barContainer}>
                  <View style={[styles.barFill, {
                    width: `${phase.progress}%` as any,
                    backgroundColor: isLocked ? '#E5E7EB' : phase.status === 'completed' ? '#1A56DB' : phase.status === 'in_progress' ? '#D97706' : '#E5E7EB',
                  }]} />
                </View>
                {!isLocked && (
                  <View style={styles.progressButtons}>
                    {[0, 25, 50, 75, 100].map((val) => (
                      <TouchableOpacity
                        key={val}
                        style={[styles.progressBtn, phase.progress === val && styles.progressBtnActive]}
                        onPress={() => handlePhaseProgress(realIdx, val)}
                      >
                        <Text style={[styles.progressBtnText, phase.progress === val && styles.progressBtnTextActive]}>
                          {val}%
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {isLocked && (
                  <Text style={styles.lockedPhaseHint}>Complete document collection to unlock</Text>
                )}
              </View>
            );
          })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => router.push(`/project/${id}/notify` as any)}
        >
          <Text style={styles.nextBtnText}>Notify Customer</Text>
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
  content: { padding: 20, paddingBottom: 100 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12, marginTop: 8 },
  circleContainer: { alignItems: 'center', marginBottom: 24, position: 'relative' },
  circleLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  circlePercent: { fontSize: 32, fontWeight: '800', color: '#111827' },
  circleStatus: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  // Phase 0 card
  phase0Card: {
    backgroundColor: '#FFF7ED', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1.5, borderColor: '#FED7AA',
  },
  phase0CardComplete: {
    backgroundColor: '#F0FDF4', borderColor: '#BBF7D0',
  },
  phase0Header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  phase0TitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phase0Badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  phase0BadgePending: { backgroundColor: '#FEF3C7' },
  phase0BadgeComplete: { backgroundColor: '#DCFCE7' },
  phase0BadgeText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  phase0Title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  phase0Subtitle: { fontSize: 12, color: '#92400E', marginBottom: 10 },
  phase0DoneMsg: { backgroundColor: '#DCFCE7', borderRadius: 8, padding: 10, marginBottom: 10 },
  phase0DoneMsgText: { fontSize: 12, color: '#166534', fontWeight: '500' },
  phase0Progress: { fontSize: 11, color: '#6B7280', marginTop: 6, marginBottom: 12 },

  // Missing docs
  missingDocsSection: { marginTop: 4 },
  missingDocsSectionTitle: { fontSize: 12, fontWeight: '700', color: '#D97706', marginBottom: 8 },
  missingDocRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 8, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A',
  },
  missingDocIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center',
  },
  missingDocName: { flex: 1, fontSize: 13, fontWeight: '500', color: '#374151' },
  uploadDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1A56DB', paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 6,
  },
  uploadDocBtnText: { fontSize: 11, color: '#fff', fontWeight: '600' },

  // Uploaded docs
  uploadedDocsSection: { marginTop: 12 },
  uploadedDocsSectionTitle: { fontSize: 12, fontWeight: '700', color: '#059669', marginBottom: 8 },
  uploadedDocRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 8, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: '#BBF7D0',
  },
  uploadedDocIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center',
  },
  uploadedDocInfo: { flex: 1 },
  uploadedDocName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  uploadedDocFile: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  // Lock banner
  lockedBanner: {
    backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  lockedBannerText: { fontSize: 12, color: '#6B7280', textAlign: 'center' },

  // Normal phase cards
  phaseCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 10, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05,
    shadowRadius: 4, elevation: 2,
  },
  phaseCardLocked: { backgroundColor: '#F9FAFB', opacity: 0.7 },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  phaseName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  phaseNameLocked: { color: '#9CA3AF' },
  phasePercent: { fontSize: 14, fontWeight: '700', color: '#1A56DB' },
  barContainer: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  progressButtons: { flexDirection: 'row', gap: 6 },
  progressBtn: { flex: 1, paddingVertical: 5, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center' },
  progressBtnActive: { backgroundColor: '#1A56DB' },
  progressBtnText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  progressBtnTextActive: { color: '#fff' },
  lockedPhaseHint: { fontSize: 11, color: '#D1D5DB', textAlign: 'center', marginTop: 4 },

  bottomBar: {
    padding: 20, paddingBottom: 32, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  nextBtn: {
    backgroundColor: '#1A56DB', borderRadius: 12, height: 52,
    justifyContent: 'center', alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
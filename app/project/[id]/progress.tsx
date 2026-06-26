import { File, Paths } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project, PhaseStatus, ProjectDocument } from '@/types';
import { ArrowLeft, FileText, Upload, CheckCircle, XCircle, Download } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

const CIRCLE_RADIUS = 60;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
const SAF_DIR_KEY = 'buildnext_saf_doc_directory_uri';

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
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const recomputePhase0 = (allPhases: PhaseStatus[], updatedDocs: ProjectDocument[]) => {
    const requiredDocs = updatedDocs.filter((d) => !d.optional);
    const allRequiredUploaded = requiredDocs.every((d) => d.available);
    return allPhases.map((p, i) => {
      if (i === 0 && p.name === 'Document Collection') {
        if (allRequiredUploaded) {
          return { ...p, progress: 100, status: 'completed' as const };
        }
        const doneCount = requiredDocs.filter((d) => d.available).length;
        const pct = requiredDocs.length > 0
          ? Math.round((doneCount / requiredDocs.length) * 100)
          : 100;
        return { ...p, progress: pct, status: 'in_progress' as const };
      }
      return p;
    });
  };

  // ── Upload a document ───────────────────────────────────────────────────────
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
        const updatedPhases = recomputePhase0(project.phases || [], updatedDocs);
        const overall = Math.round(updatedPhases.reduce((s, p) => s + p.progress, 0) / updatedPhases.length);
        const projectStatus = overall === 100 ? 'Completed' : overall > 0 ? 'In Progress' : 'Planning';
        await updateDoc(doc(db, 'projects', id!), {
          documents: updatedDocs,
          phases: updatedPhases,
          overallProgress: overall,
          status: projectStatus,
          updatedAt: new Date(),
        });
        const requiredDocs = updatedDocs.filter((d) => !d.optional);
        const allRequiredUploaded = requiredDocs.every((d) => d.available);
        if (allRequiredUploaded) {
          Alert.alert('✅ All Required Documents Uploaded!', 'Phase 0 — Document Collection is now complete. Construction phases are ready to begin!');
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

  // ── Save to Android Downloads folder ────────────────────────────────────────
  const saveToAndroidDownloads = async (sourceUri: string, fileName: string): Promise<boolean> => {
    const markerFile = new File(Paths.document, `${SAF_DIR_KEY}.txt`);
    let directoryUri: string | null = null;

    try {
      if (markerFile.exists) {
        directoryUri = markerFile.textSync();
      }
    } catch {
      directoryUri = null;
    }

    if (!directoryUri) {
      const downloadsUri = StorageAccessFramework.getUriForDirectoryInRoot('Download');
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
      if (!permissions.granted) return false;
      directoryUri = permissions.directoryUri;
      try {
        markerFile.create();
        markerFile.write(directoryUri);
      } catch {}
    }

    try {
      const sourceFile = new File(sourceUri);
      const base64 = sourceFile.base64Sync();
      const ext = fileName.split('.').pop() || 'pdf';
      const mimeType = ext === 'pdf' ? 'application/pdf' : 'image/jpeg';
      const newUri = await StorageAccessFramework.createFileAsync(directoryUri, fileName, mimeType);
      await StorageAccessFramework.writeAsStringAsync(newUri, base64, { encoding: 'base64' });
      return true;
    } catch (e) {
      try {
        if (markerFile.exists) markerFile.delete();
      } catch {}
      return false;
    }
  };

  // ── Download document to phone ──────────────────────────────────────────────
  const handleDownloadDoc = async (document: ProjectDocument) => {
    if (!document.fileUri) {
      Alert.alert('No file', 'This document was marked as available but no file was uploaded yet.');
      return;
    }

    setDownloading(document.id);
    try {
      const ext = document.fileName?.split('.').pop() || 'pdf';
      const safeFileName = (document.fileName || `${document.name}.${ext}`).replace(/\s+/g, '_');

      if (Platform.OS === 'android') {
        const saved = await saveToAndroidDownloads(document.fileUri, safeFileName);
        if (saved) {
          Alert.alert('Downloaded!', `"${document.name}" saved to your selected folder.`);
        } else {
          // fallback to share
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(document.fileUri, { dialogTitle: `Save — ${document.name}` });
          } else {
            Alert.alert('Error', 'Could not save document. Please try again.');
          }
        }
      } else {
        // iOS — copy to document dir then share (Save to Files)
        const destFile = new File(Paths.document, safeFileName);
        const sourceFile = new File(document.fileUri);
        await sourceFile.copy(destFile);
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(destFile.uri, {
            dialogTitle: `Save or Share — ${document.name}`,
            UTI: 'public.item',
          });
        } else {
          Alert.alert('Saved!', `"${document.name}" saved to app documents.`);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Could not download document. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  // ── Update normal phase progress ────────────────────────────────────────────
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

  const allRequiredDocs = documents.filter((d) => !d.optional);
  const allOptionalDocs = documents.filter((d) => d.optional);

  const renderDocRow = (document: ProjectDocument, isOptional = false) => {
    const hasFile = !!document.fileUri;
    const isAvailable = document.available;
    const isMissing = !isAvailable;
    const isDownloading = downloading === document.id;
    const isUploading = uploading === document.id;

    return (
      <View
        key={document.id}
        style={[
          styles.docFullRow,
          hasFile && styles.docFullRowUploaded,
          isAvailable && !hasFile && styles.docFullRowPending,
          isMissing && !isOptional && styles.docFullRowMissing,
          isMissing && isOptional && styles.docFullRowOptional,
        ]}
      >
        <View style={[
          styles.docFullIcon,
          hasFile ? styles.docIconGreen
            : isAvailable ? styles.docIconBlue
            : isOptional ? styles.docIconGray
            : styles.docIconAmber,
        ]}>
          <FileText size={16} color={
            hasFile ? '#059669'
              : isAvailable ? '#1A56DB'
              : isOptional ? '#9CA3AF'
              : '#D97706'
          } />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.docFullName} numberOfLines={1}>{document.name}</Text>
          <Text style={styles.docFullStatus}>
            {hasFile
              ? `📎 ${document.fileName}`
              : isAvailable
              ? 'Marked available — tap Upload to attach file'
              : isOptional
              ? 'Optional — not uploaded'
              : 'Not uploaded yet'}
          </Text>
        </View>

        {/* Download button — only if file exists */}
        {hasFile && (
          <TouchableOpacity
            style={[styles.docActionBtn, styles.docActionBtnGreen]}
            onPress={() => handleDownloadDoc(document)}
            disabled={isDownloading}
          >
            {isDownloading
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Download size={12} color="#fff" />
                  <Text style={styles.docActionBtnText}>Save</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {/* Upload button — if available but no file, or if missing */}
        {!hasFile && (
          <TouchableOpacity
            style={[
              styles.docActionBtn,
              isAvailable ? styles.docActionBtnBlue
                : isOptional ? styles.docActionBtnGray
                : styles.docActionBtnAmber,
            ]}
            onPress={() => handleDocUpload(document.id)}
            disabled={isUploading}
          >
            {isUploading
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Upload size={12} color="#fff" />
                  <Text style={styles.docActionBtnText}>Upload</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    );
  };

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
                  ✅ All required documents collected. Construction phases are active!
                </Text>
              </View>
            ) : (
              <Text style={styles.phase0Subtitle}>
                Upload all required documents to unlock construction phases. Optional documents won't block this.
              </Text>
            )}

            {/* Progress bar */}
            <View style={styles.barContainer}>
              <View style={[styles.barFill, {
                width: `${phase0?.progress || 0}%` as any,
                backgroundColor: phase0Complete ? '#059669' : '#D97706',
              }]} />
            </View>
            <Text style={styles.phase0Progress}>
              {documents.filter(d => !d.optional && d.available).length} of{' '}
              {documents.filter(d => !d.optional).length} required documents uploaded ({phase0?.progress || 0}%)
            </Text>

            {/* Required Documents */}
            {allRequiredDocs.length > 0 && (
              <View style={styles.docFullSection}>
                <Text style={styles.docFullSectionTitle}>📋 Required Documents</Text>
                {allRequiredDocs.map((doc) => renderDocRow(doc, false))}
              </View>
            )}

            {/* Optional Documents */}
            {allOptionalDocs.length > 0 && (
              <View style={styles.docFullSection}>
                <View style={styles.optionalTitleRow}>
                  <Text style={[styles.docFullSectionTitle, { color: '#1A56DB' }]}>
                    📄 Optional Documents
                  </Text>
                  <View style={styles.optionalBadge}>
                    <Text style={styles.optionalBadgeText}>Won't block phases</Text>
                  </View>
                </View>
                {allOptionalDocs.map((doc) => renderDocRow(doc, true))}
              </View>
            )}
          </View>
        )}

        {/* ── Construction Phases ── */}
        <Text style={styles.sectionLabel}>
          {isPhase0 ? 'Construction Phases' : 'Phase Progress'}
        </Text>

        {isPhase0 && !phase0Complete && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedBannerText}>
              🔒 Construction phases are locked until all required documents are uploaded.
              Optional documents don't affect this.
            </Text>
          </View>
        )}

        {phases
          .filter((_, idx) => !(idx === 0 && isPhase0))
          .map((phase, idx) => {
            const realIdx = isPhase0 ? idx + 1 : idx;
            const isLocked = isPhase0 && !phase0Complete;
            return (
              <View key={phase.name} style={[styles.phaseCard, isLocked && styles.phaseCardLocked]}>
                <View style={styles.phaseHeader}>
                  <Text style={[styles.phaseName, isLocked && styles.phaseNameLocked]}>
                    {phase.name}
                  </Text>
                  <Text style={[styles.phasePercent, isLocked && { color: '#D1D5DB' }]}>
                    {isLocked ? '🔒' : `${phase.progress}%`}
                  </Text>
                </View>
                <View style={styles.barContainer}>
                  <View style={[styles.barFill, {
                    width: `${phase.progress}%` as any,
                    backgroundColor: isLocked ? '#E5E7EB'
                      : phase.status === 'completed' ? '#1A56DB'
                      : phase.status === 'in_progress' ? '#D97706'
                      : '#E5E7EB',
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
                  <Text style={styles.lockedPhaseHint}>Complete required document collection to unlock</Text>
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
  phase0Card: {
    backgroundColor: '#FFF7ED', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1.5, borderColor: '#FED7AA',
  },
  phase0CardComplete: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  phase0Header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  phase0TitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phase0Badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  phase0BadgePending: { backgroundColor: '#FEF3C7' },
  phase0BadgeComplete: { backgroundColor: '#DCFCE7' },
  phase0BadgeText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  phase0Title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  phase0Subtitle: { fontSize: 12, color: '#92400E', marginBottom: 10 },
  phase0DoneMsg: { backgroundColor: '#DCFCE7', borderRadius: 8, padding: 10, marginBottom: 10 },
  phase0DoneMsgText: { fontSize: 12, color: '#166534', fontWeight: '500' },
  phase0Progress: { fontSize: 11, color: '#6B7280', marginTop: 6, marginBottom: 4 },
  docFullSection: { marginTop: 12 },
  docFullSectionTitle: { fontSize: 12, fontWeight: '700', color: '#D97706', marginBottom: 8 },
  optionalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  optionalBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  optionalBadgeText: { fontSize: 10, color: '#1A56DB', fontWeight: '600' },
  docFullRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 8, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  docFullRowUploaded: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  docFullRowPending: { borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' },
  docFullRowMissing: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  docFullRowOptional: { borderColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  docFullIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  docIconGreen: { backgroundColor: '#DCFCE7' },
  docIconBlue: { backgroundColor: '#EFF6FF' },
  docIconAmber: { backgroundColor: '#FEF3C7' },
  docIconGray: { backgroundColor: '#F3F4F6' },
  docFullName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  docFullStatus: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  docActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: '#9CA3AF',
  },
  docActionBtnGreen: { backgroundColor: '#059669' },
  docActionBtnBlue: { backgroundColor: '#1A56DB' },
  docActionBtnAmber: { backgroundColor: '#D97706' },
  docActionBtnGray: { backgroundColor: '#9CA3AF' },
  docActionBtnText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  lockedBanner: {
    backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
  },
  lockedBannerText: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  phaseCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
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
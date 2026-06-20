import { File, Paths, Directory } from 'expo-file-system';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project } from '@/types';
import { ArrowLeft, ChevronRight, Download } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';


const REPORTS = [
  { id: 'project', icon: '📊', title: 'Project Report', description: 'Overall project summary' },
  { id: 'material', icon: '🧱', title: 'Material Usage Report', description: 'Material used and remaining' },
  { id: 'progress', icon: '📈', title: 'Work Progress Report', description: 'Phase wise progress' },
  { id: 'payment', icon: '💳', title: 'Payment Report', description: 'All payments and dues' },
  { id: 'subcontractor', icon: '👷', title: 'Subcontractor Report', description: 'Subcontractor work status' },
  { id: 'daily', icon: '📋', title: 'Daily Site Report', description: 'Daily activities on site' },
];

// Key used to remember the Android folder the user picked, so we don't ask every time
const SAF_DIR_KEY = 'buildnext_saf_directory_uri';

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

  const saveToAndroidDownloads = async (sourceFile: File, fileName: string) => {
    // Try to reuse a previously granted folder permission first
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
      // Pre-fill the picker with the Downloads folder so the user just taps
      // "Use this folder" / "Allow" instead of navigating to find it manually.
      const downloadsUri = StorageAccessFramework.getUriForDirectoryInRoot('Download');
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync(downloadsUri);
      if (!permissions.granted) {
        return false; // user denied — caller should fall back to share
      }
      directoryUri = permissions.directoryUri;
      // remember it for next time
      try {
        markerFile.create();
        markerFile.write(directoryUri);
      } catch {}
    }

    try {
      const base64 = sourceFile.base64Sync();
      const newUri = await StorageAccessFramework.createFileAsync(
        directoryUri,
        fileName,
        'application/pdf'
      );
      await StorageAccessFramework.writeAsStringAsync(newUri, base64, { encoding: 'base64' });
      return true;
    } catch (e) {
      // directoryUri may have become invalid (e.g. permission revoked) — clear it and fail so caller falls back
      try {
        if (markerFile.exists) markerFile.delete();
      } catch {}
      return false;
    }
  };

  const generatePDF = async (reportId: string, reportTitle: string) => {
    if (!project) return;
    setDownloading(reportId);
    try {
      const paymentsSnap = await getDocs(collection(db, 'projects', id!, 'payments'));
      const payments = paymentsSnap.docs.map(d => d.data());
      const totalPaid = payments
        .filter(p => p.status === 'Paid')
        .reduce((s, p) => s + p.amount, 0);

      let bodyContent = '';

      if (reportId === 'project' || reportId === 'all') {
        bodyContent += `
          <div class="section">
            <h2>Project Details</h2>
            <div class="row"><span class="label">Customer Name</span><span class="value">${project.customerName || '-'}</span></div>
            <div class="row"><span class="label">Phone</span><span class="value">${project.customerPhone || '-'}</span></div>
            <div class="row"><span class="label">Email</span><span class="value">${project.customerEmail || '-'}</span></div>
            <div class="row"><span class="label">Address</span><span class="value">${project.customerAddress || '-'}</span></div>
            <div class="row"><span class="label">Site Location</span><span class="value">${project.siteLocation || '-'}</span></div>
            <div class="row"><span class="label">Project Type</span><span class="value">${project.projectType || '-'}</span></div>
            <div class="row"><span class="label">Plot Area</span><span class="value">${project.plotArea || '-'} Sq.Ft.</span></div>
            <div class="row"><span class="label">Start Date</span><span class="value">${project.startDate || '-'}</span></div>
            <div class="row"><span class="label">Expected Completion</span><span class="value">${project.expectedCompletion || '-'}</span></div>
            <div class="row"><span class="label">Status</span><span class="value">${project.status || '-'}</span></div>
            <div class="row"><span class="label">Overall Progress</span><span class="value">${project.overallProgress || 0}%</span></div>
          </div>`;
      }

      if (reportId === 'payment' || reportId === 'all') {
        bodyContent += `
          <div class="section">
            <h2>Financial Summary</h2>
            <div class="row"><span class="label">Total Estimate</span><span class="value">₹${(project.estimate?.total || 0).toLocaleString('en-IN')}</span></div>
            <div class="row"><span class="label">Paid Amount</span><span class="value completed">₹${totalPaid.toLocaleString('en-IN')}</span></div>
            <div class="row"><span class="label">Remaining</span><span class="value" style="color:#DC2626">₹${((project.estimate?.total || 0) - totalPaid).toLocaleString('en-IN')}</span></div>
            <div class="row"><span class="label">Construction Cost</span><span class="value">₹${(project.estimate?.constructionCost || 0).toLocaleString('en-IN')}</span></div>
            <div class="row"><span class="label">Material Cost</span><span class="value">₹${(project.estimate?.materialCost || 0).toLocaleString('en-IN')}</span></div>
            <div class="row"><span class="label">Labor Cost</span><span class="value">₹${(project.estimate?.laborCost || 0).toLocaleString('en-IN')}</span></div>
            <div class="row"><span class="label">Other Expenses</span><span class="value">₹${(project.estimate?.otherExpenses || 0).toLocaleString('en-IN')}</span></div>
          </div>
          ${payments.length > 0 ? `
          <div class="section">
            <h2>Payment History</h2>
            ${payments.map(p => `
              <div class="payment-card">
                <div class="row">
                  <span class="label">${p.milestone || '-'}</span>
                  <span class="value">₹${(p.amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div class="row">
                  <span class="label">${p.date || '-'}</span>
                  <span class="${p.status === 'Paid' ? 'paid' : 'pending'}">${p.status}</span>
                </div>
              </div>
            `).join('')}
          </div>` : '<p style="color:#9CA3AF;padding:8px">No payments recorded yet.</p>'}`;
      }

      if (reportId === 'material' || reportId === 'all') {
        bodyContent += `
          <div class="section">
            <h2>Material Usage</h2>
            ${(project.materials || []).length > 0
              ? (project.materials || []).map(m => `
                <div class="row">
                  <span class="label">${m}</span>
                  <span class="value completed">Selected</span>
                </div>`).join('')
              : '<p style="color:#9CA3AF;padding:8px">No materials selected yet.</p>'
            }
          </div>`;
      }

      if (reportId === 'progress' || reportId === 'all') {
        bodyContent += `
          <div class="section">
            <h2>Work Progress — Overall: ${project.overallProgress || 0}%</h2>
            ${(project.phases || []).length > 0
              ? (project.phases || []).map(phase => `
                <div class="phase-row">
                  <span style="flex:1">${phase.name}</span>
                  <span style="width:50px;text-align:center">${phase.progress || 0}%</span>
                  <span class="${phase.status === 'completed' ? 'completed' : phase.status === 'in_progress' ? 'in-progress' : 'upcoming'}" style="width:90px;text-align:right">
                    ${phase.status === 'completed' ? 'Completed' : phase.status === 'in_progress' ? 'In Progress' : 'Upcoming'}
                  </span>
                </div>`).join('')
              : '<p style="color:#9CA3AF;padding:8px">No phases added yet.</p>'
            }
          </div>`;
      }

      if (reportId === 'subcontractor' || reportId === 'all') {
        bodyContent += `
          <div class="section">
            <h2>Subcontractors</h2>
            ${(project.subcontractors || []).length > 0
              ? (project.subcontractors || []).map(s => `
                <div class="row">
                  <span class="label">${s.name} — ${s.role}<br/><small>${s.phone}</small></span>
                  <span class="${s.status === 'active' ? 'completed' : 'pending'}">${s.status === 'active' ? 'Active' : 'Pending'}</span>
                </div>`).join('')
              : '<p style="color:#9CA3AF;padding:8px">No subcontractors added yet.</p>'
            }
          </div>`;
      }

      if (reportId === 'daily' || reportId === 'all') {
        bodyContent += `
          <div class="section">
            <h2>Daily Site Report</h2>
            <div class="row"><span class="label">Current Status</span><span class="value">${project.status}</span></div>
            <div class="row"><span class="label">Overall Progress</span><span class="value">${project.overallProgress || 0}%</span></div>
            <div class="row"><span class="label">Active Phases</span><span class="value">${(project.phases || []).filter(p => p.status === 'in_progress').map(p => p.name).join(', ') || 'None'}</span></div>
            <div class="row"><span class="label">Completed Phases</span><span class="value">${(project.phases || []).filter(p => p.status === 'completed').length} / ${(project.phases || []).length}</span></div>
            <div class="row"><span class="label">Active Subcontractors</span><span class="value">${(project.subcontractors || []).filter(s => s.status === 'active').length}</span></div>
            <div class="row"><span class="label">Report Date</span><span class="value">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
          </div>`;
      }

      const html = `
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111827; margin: 0; }
            .header { background: #1A56DB; color: white; padding: 20px; border-radius: 8px; margin-bottom: 24px; }
            .header h1 { margin: 0; font-size: 20px; }
            .header p { margin: 6px 0 0; opacity: 0.85; font-size: 13px; }
            .badge { display: inline-block; background: #FEF3C7; color: #D97706; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-top: 10px; }
            .section { margin-bottom: 24px; background: #fff; border-radius: 8px; padding: 16px; border: 1px solid #F3F4F6; }
            .section h2 { font-size: 14px; color: #1A56DB; border-bottom: 2px solid #DBEAFE; padding-bottom: 8px; margin: 0 0 12px 0; }
            .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F9FAFB; }
            .row:last-child { border-bottom: none; }
            .label { color: #6B7280; font-size: 12px; flex: 1; }
            .value { font-weight: 600; font-size: 12px; text-align: right; }
            .phase-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; border-radius: 6px; background: #F9FAFB; font-size: 12px; }
            .completed { color: #059669; font-weight: bold; }
            .in-progress { color: #D97706; font-weight: bold; }
            .upcoming { color: #9CA3AF; }
            .payment-card { background: #F9FAFB; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; }
            .paid { color: #059669; font-weight: bold; font-size: 12px; }
            .pending { color: #D97706; font-weight: bold; font-size: 12px; }
            .footer { margin-top: 32px; text-align: center; color: #9CA3AF; font-size: 11px; padding-top: 16px; border-top: 1px solid #F3F4F6; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BuildNext — ${reportTitle}</h1>
            <p>${project.projectName} &bull; ${project.siteLocation}</p>
            <span class="badge">${project.status || 'In Progress'}</span>
          </div>
          ${bodyContent}
          <div class="footer">
            Generated by BuildNext &bull; ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const fileName = `${project.projectName}_${reportTitle}_${Date.now()}.pdf`.replace(/\s+/g, '_');
      const sourceFile = new File(uri);

      if (Platform.OS === 'android') {
        // Android: save directly into a user-chosen folder (e.g. Downloads) — true "download" behavior
        const saved = await saveToAndroidDownloads(sourceFile, fileName);
        if (saved) {
          Alert.alert('Downloaded!', `Saved as: ${fileName}`);
        } else {
          // permission denied or write failed — fall back to share sheet
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: `Save or Share — ${project.projectName}`,
            });
          } else {
            Alert.alert('Could not save', 'Please allow folder access to download the report.');
          }
        }
      } else {
        // iOS: Apple does not allow apps to write directly into the Files app —
        // the share sheet's "Save to Files" is the platform-correct way to download.
        const destFile = new File(Paths.document, fileName);
        await sourceFile.copy(destFile);

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(destFile.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Save or Share — ${project.projectName}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Downloaded!', `Saved as: ${fileName}`);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Could not generate report. Try again.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return (
    <View style={styles.loader}>
      <ActivityIndicator color="#1A56DB" />
    </View>
  );

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
            onPress={() => generatePDF(report.id, report.title)}
            activeOpacity={0.8}
          >
            <View style={styles.reportIcon}>
              <Text style={styles.reportIconText}>{report.icon}</Text>
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <Text style={styles.reportDesc}>{report.description}</Text>
            </View>
            {downloading === report.id
              ? <ActivityIndicator size="small" color="#1A56DB" />
              : <ChevronRight size={18} color="#D1D5DB" />
            }
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.downloadAllBtn}
          onPress={() => generatePDF('all', 'Complete Project Report')}
          disabled={downloading !== null}
        >
          {downloading === 'all'
            ? <ActivityIndicator color="#fff" />
            : <>
                <Download size={18} color="#fff" />
                <Text style={styles.downloadAllBtnText}>Download Report</Text>
              </>
          }
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
  projectBanner: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#DBEAFE',
  },
  projectBannerName: { fontSize: 13, fontWeight: '700', color: '#1A56DB' },
  projectBannerLocation: { fontSize: 11, color: '#6B7280' },
  content: { padding: 16 },
  reportCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  reportIcon: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#EFF6FF',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  reportIconText: { fontSize: 22 },
  reportInfo: { flex: 1 },
  reportTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  reportDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  bottomBar: {
    padding: 20, paddingBottom: 32, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  downloadAllBtn: {
    backgroundColor: '#1A56DB', borderRadius: 12, height: 52,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#1A56DB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  downloadAllBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
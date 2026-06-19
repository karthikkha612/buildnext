import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Project } from '@/types';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import { Platform } from 'react-native';

export default function NotifyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) setProject({ id: snap.id, ...snap.data() } as Project);
      setLoading(false);
    });
    return unsub;
  }, [id]);

  const togglePhase = (name: string) => {
    setSelectedPhases((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const pickImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e: Event) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        const uris: string[] = [];
        Array.from(files).forEach((file) => {
          uris.push(URL.createObjectURL(file));
        });
        setPhotos((prev) => [...prev, ...uris]);
      };
      input.click();
    }
  };

  const handleSend = async () => {
    if (selectedPhases.length === 0 && !message.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'projects', id!, 'updates'), {
        projectId: id,
        message: message.trim(),
        phases: selectedPhases,
        photos: [],
        sentAt: new Date(),
      });
      setSent(true);
      setTimeout(() => router.back(), 1500);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#1A56DB" /></View>;

  const phases = project?.phases || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notify Customer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {sent && (
          <View style={styles.sentBanner}>
            <Check size={16} color="#059669" />
            <Text style={styles.sentText}>Update sent to customer!</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Select Update To Share</Text>
        {phases.map((phase) => {
          const isChecked = selectedPhases.includes(phase.name);
          const statusLabels: Record<string, string> = {
            completed: 'The work has been completed successfully.',
            in_progress: 'The work is currently in progress.',
            upcoming: 'This phase is scheduled to begin soon.',
          };
          return (
            <TouchableOpacity
              key={phase.name}
              style={[styles.phaseRow, isChecked && styles.phaseRowChecked]}
              onPress={() => togglePhase(phase.name)}
            >
              <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                {isChecked && <Check size={12} color="#fff" />}
              </View>
              <View style={styles.phaseInfo}>
                <Text style={[styles.phaseName, isChecked && styles.phaseNameChecked]}>
                  {phase.name} {phase.status === 'completed' ? 'Completed' : phase.status === 'in_progress' ? 'In Progress' : ''}
                </Text>
                <Text style={styles.phaseDesc}>{statusLabels[phase.status]}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Add Message (Optional)</Text>
        <TextInput
          style={styles.messageInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message to the customer..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Add Photos</Text>
        <View style={styles.photoGrid}>
          {photos.map((uri, idx) => (
            <Image key={idx} source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
            <Camera size={24} color="#9CA3AF" />
            <Text style={styles.addPhotoText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.waIcon}>📱</Text>
              <Text style={styles.sendBtnText}>Send Update to Customer</Text>
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
  content: { padding: 20 },
  sentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 16,
  },
  sentText: { fontSize: 14, fontWeight: '600', color: '#059669' },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 12 },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
    gap: 12,
    backgroundColor: '#fff',
  },
  phaseRowChecked: { borderColor: '#1A56DB', backgroundColor: '#EFF6FF' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#1A56DB', borderColor: '#1A56DB' },
  phaseInfo: { flex: 1 },
  phaseName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  phaseNameChecked: { color: '#1A56DB' },
  phaseDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    minHeight: 100,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#F3F4F6' },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    gap: 4,
  },
  addPhotoText: { fontSize: 11, color: '#9CA3AF' },
  bottomBar: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sendBtn: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: { opacity: 0.7 },
  waIcon: { fontSize: 20 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

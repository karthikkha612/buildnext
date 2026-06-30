import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft, Camera, Image as ImageIcon,
  Trash2, Edit3, X, Check, Plus, ZoomIn, Upload,
} from 'lucide-react-native';
import {
  uploadGalleryPhoto,
  listenToGallery,
  updateCaption,
  deleteGalleryPhoto,
  GalleryPhoto,
} from '@/lib/galleryService';

// ─── Constants ────────────────────────────────────────────────────
const BLUE       = '#1A56DB';
const BLUE_LIGHT = '#EEF2FF';
const SCREEN_W   = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_W - 48 - 8) / 3;

// ─── Upload Progress Bar ──────────────────────────────────────────
function UploadBar({ progress }: { progress: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress / 100,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={ub.wrap}>
      <View style={ub.row}>
        <Upload size={13} color={BLUE} />
        <Text style={ub.label}>Uploading... {progress}%</Text>
      </View>
      <View style={ub.track}>
        <Animated.View
          style={[
            ub.fill,
            {
              width: anim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ─── Full-Screen Photo Viewer ─────────────────────────────────────
function PhotoViewer({
  photo,
  onClose,
  onDelete,
  onCaptionSave,
}: {
  photo: GalleryPhoto;
  onClose: () => void;
  onDelete: () => void;
  onCaptionSave: (caption: string) => void;
}) {
  const [editingCaption, setEditingCaption] = useState(false);
  const [caption, setCaption]               = useState(photo.caption);
  const fadeAnim                            = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 200, useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(onClose);
  };

  const handleSaveCaption = () => {
    onCaptionSave(caption);
    setEditingCaption(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Photo',
      'This will permanently delete this photo. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[pv.overlay, { opacity: fadeAnim }]}>

        {/* Top Bar */}
        <View style={pv.topBar}>
          <TouchableOpacity style={pv.iconBtn} onPress={handleClose}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={pv.iconBtn} onPress={handleDelete}>
            <Trash2 size={18} color="#FCA5A5" />
          </TouchableOpacity>
        </View>

        {/* Full Image */}
        <View style={pv.imageWrap}>
          <Image
            source={{ uri: photo.url }}
            style={pv.image}
            resizeMode="contain"
          />
        </View>

        {/* Caption Bar */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={pv.captionBar}>
            {editingCaption ? (
              <View style={pv.captionEditRow}>
                <TextInput
                  style={pv.captionInput}
                  value={caption}
                  onChangeText={setCaption}
                  placeholder="Add a caption..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoFocus
                  multiline
                />
                <TouchableOpacity
                  style={pv.captionSaveBtn}
                  onPress={handleSaveCaption}
                >
                  <Check size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={pv.captionRow}
                onPress={() => setEditingCaption(true)}
              >
                <Text style={pv.captionText}>
                  {caption || 'Tap to add a caption...'}
                </Text>
                <Edit3 size={14} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
            <Text style={pv.dateText}>
              {photo.uploadedAt?.toDate
                ? photo.uploadedAt.toDate().toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })
                : ''}
            </Text>
          </View>
        </KeyboardAvoidingView>

      </Animated.View>
    </Modal>
  );
}

// ─── Add Photo Bottom Sheet ───────────────────────────────────────
function AddPhotoSheet({
  visible,
  onClose,
  onPickGallery,
  onPickCamera,
}: {
  visible: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onPickCamera: () => void;
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={ap.overlay}>
          <TouchableWithoutFeedback>
            <View style={ap.sheet}>

              <View style={ap.handle} />
              <Text style={ap.title}>Add Photos</Text>
              <Text style={ap.sub}>
                Document your project's progress visually
              </Text>

              {/* Camera Option */}
              <TouchableOpacity style={ap.option} onPress={onPickCamera}>
                <View style={[ap.optionIcon, { backgroundColor: BLUE_LIGHT }]}>
                  <Camera size={22} color={BLUE} />
                </View>
                <View style={ap.optionText}>
                  <Text style={ap.optionTitle}>Take a Photo</Text>
                  <Text style={ap.optionSub}>
                    Use camera to capture current progress
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Gallery Option */}
              <TouchableOpacity style={ap.option} onPress={onPickGallery}>
                <View style={[ap.optionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <ImageIcon size={22} color="#059669" />
                </View>
                <View style={ap.optionText}>
                  <Text style={ap.optionTitle}>Choose from Gallery</Text>
                  <Text style={ap.optionSub}>
                    Pick existing photos from your device
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={ap.cancelBtn} onPress={onClose}>
                <Text style={ap.cancelTxt}>Cancel</Text>
              </TouchableOpacity>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Caption Modal ────────────────────────────────────────────────
function CaptionModal({
  visible,
  imageUri,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  imageUri: string;
  onConfirm: (caption: string) => void;
  onCancel: () => void;
}) {
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (visible) setCaption('');
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={cm.overlay}>
            <View style={cm.sheet}>

              <View style={cm.handle} />
              <Text style={cm.title}>Add Caption</Text>

              {/* Image Preview */}
              <Image
                source={{ uri: imageUri }}
                style={cm.preview}
                resizeMode="cover"
              />

              {/* Caption Input */}
              <TextInput
                style={cm.input}
                value={caption}
                onChangeText={setCaption}
                placeholder="Describe this photo (e.g. Foundation work completed)..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
              <Text style={cm.charCount}>{caption.length}/200</Text>

              {/* Action Buttons */}
              <View style={cm.actions}>
                <TouchableOpacity
                  style={cm.skipBtn}
                  onPress={() => onConfirm('')}
                >
                  <Text style={cm.skipTxt}>Skip Caption</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={cm.uploadBtn}
                  onPress={() => onConfirm(caption)}
                >
                  <Upload size={15} color="#fff" />
                  <Text style={cm.uploadTxt}>Upload Photo</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Gallery Screen ──────────────────────────────────────────
export default function ProjectGalleryScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [projectName, setProjectName]     = useState('Gallery');
  const [photos, setPhotos]               = useState<GalleryPhoto[]>([]);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [uploadPct, setUploadPct]         = useState(0);
  const [showAddSheet, setShowAddSheet]   = useState(false);
  const [pickedUri, setPickedUri]         = useState('');
  const [showCaption, setShowCaption]     = useState(false);
  const [viewerPhoto, setViewerPhoto]     = useState<GalleryPhoto | null>(null);

  // ── Load Project Name ─────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'projects', id), (snap) => {
      if (snap.exists()) {
        setProjectName(snap.data()?.projectName || 'Gallery');
      }
    });
  }, [id]);

  // ── Load Gallery Photos ───────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    return listenToGallery(id, (data) => {
      setPhotos(data);
      setLoading(false);
    });
  }, [id]);

  // ── Pick from Device Gallery ──────────────────────────────────
  const handlePickGallery = useCallback(async () => {
    setShowAddSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow photo library access in Settings.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
      setShowCaption(true);
    }
  }, []);

  // ── Take Photo with Camera ────────────────────────────────────
  const handlePickCamera = useCallback(async () => {
    setShowAddSheet(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow camera access in Settings.'
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
      setShowCaption(true);
    }
  }, []);

  // ── Upload Photo ──────────────────────────────────────────────
  const handleUpload = useCallback(async (caption: string) => {
    setShowCaption(false);
    if (!pickedUri || !id || !user) return;

    setUploading(true);
    setUploadPct(0);
    try {
      await uploadGalleryPhoto(
        id, pickedUri, caption, user.uid,
        (pct) => setUploadPct(pct)
      );
    } catch {
      Alert.alert('Upload Failed', 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
      setPickedUri('');
    }
  }, [pickedUri, id, user]);

  // ── Save Edited Caption ───────────────────────────────────────
  const handleCaptionSave = useCallback(async (
    photoId: string,
    caption: string
  ) => {
    if (!id) return;
    await updateCaption(id, photoId, caption);
    setViewerPhoto((prev) => prev ? { ...prev, caption } : prev);
  }, [id]);

  // ── Delete Photo ──────────────────────────────────────────────
  const handleDelete = useCallback(async (photo: GalleryPhoto) => {
    if (!id) return;
    setViewerPhoto(null);
    await deleteGalleryPhoto(id, photo.id, photo.storagePath);
  }, [id]);

  // ─────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>

      {/* ── Header ──────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color="#111827" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {projectName}
          </Text>
          <Text style={s.headerSub}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setShowAddSheet(true)}
        >
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Upload Progress Bar ──────────────────────── */}
      {uploading && <UploadBar progress={uploadPct} />}

      {/* ── Body ────────────────────────────────────── */}
      {loading ? (
        <View style={s.loaderWrap}>
          <ActivityIndicator color={BLUE} size="large" />
        </View>
      ) : photos.length === 0 ? (

        /* ── Empty State ──────────────────────────────── */
        <View style={s.emptyWrap}>
          <View style={s.emptyIconWrap}>
            <ImageIcon size={40} color="#D1D5DB" />
          </View>
          <Text style={s.emptyTitle}>No photos yet</Text>
          <Text style={s.emptySub}>
            Start building a visual progress log for this project.
            {'\n'}Take photos or pick from your gallery.
          </Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => setShowAddSheet(true)}
          >
            <Camera size={16} color="#fff" />
            <Text style={s.emptyBtnTxt}>Add First Photo</Text>
          </TouchableOpacity>
        </View>

      ) : (

        /* ── Photo Grid ───────────────────────────────── */
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.grid}
        >
          {photos.map((photo) => (
            <TouchableOpacity
              key={photo.id}
              style={s.thumb}
              onPress={() => setViewerPhoto(photo)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: photo.url }}
                style={s.thumbImg}
                resizeMode="cover"
              />

              {/* Caption Badge */}
              {photo.caption ? (
                <View style={s.captionBadge}>
                  <Text style={s.captionBadgeTxt} numberOfLines={2}>
                    {photo.caption}
                  </Text>
                </View>
              ) : (
                <View style={s.noCaptionBadge}>
                  <Edit3 size={10} color="rgba(255,255,255,0.7)" />
                </View>
              )}

              {/* Zoom Icon */}
              <View style={s.thumbOverlay}>
                <ZoomIn size={16} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
          ))}

          {/* Add More Tile */}
          <TouchableOpacity
            style={s.addTile}
            onPress={() => setShowAddSheet(true)}
          >
            <Plus size={24} color="#9CA3AF" />
            <Text style={s.addTileTxt}>Add</Text>
          </TouchableOpacity>

          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* ── Add Photo Sheet ───────────────────────────── */}
      <AddPhotoSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        onPickGallery={handlePickGallery}
        onPickCamera={handlePickCamera}
      />

      {/* ── Caption Modal ─────────────────────────────── */}
      {showCaption && pickedUri ? (
        <CaptionModal
          visible={showCaption}
          imageUri={pickedUri}
          onConfirm={handleUpload}
          onCancel={() => {
            setShowCaption(false);
            setPickedUri('');
          }}
        />
      ) : null}

      {/* ── Full Screen Photo Viewer ──────────────────── */}
      {viewerPhoto && (
        <PhotoViewer
          photo={viewerPhoto}
          onClose={() => setViewerPhoto(null)}
          onDelete={() => handleDelete(viewerPhoto)}
          onCaptionSave={(cap) => handleCaptionSave(viewerPhoto.id, cap)}
        />
      )}

    </View>
  );
}

// ─── Upload Bar Styles ────────────────────────────────────────────
const ub = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { fontSize: 12, color: BLUE, fontWeight: '600' },
  track: {
    height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 99, overflow: 'hidden',
  },
  fill:  { height: '100%', backgroundColor: BLUE, borderRadius: 99 },
});

// ─── Photo Viewer Styles ──────────────────────────────────────────
const pv = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 16, paddingBottom: 10,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageWrap: { flex: 1, justifyContent: 'center' },
  image:     { width: '100%', height: '100%' },
  captionBar: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 6,
  },
  captionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  captionText:    { flex: 1, fontSize: 14, color: '#fff', lineHeight: 20 },
  captionEditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  captionInput: {
    flex: 1, color: '#fff', fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 4, lineHeight: 20,
  },
  captionSaveBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: BLUE,
    justifyContent: 'center', alignItems: 'center',
  },
  dateText: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
});

// ─── Add Sheet Styles ─────────────────────────────────────────────
const ap = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 4 },
  sub:   { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  optionIcon: {
    width: 46, height: 46, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  optionText:  { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  optionSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  cancelBtn: {
    marginTop: 16, paddingVertical: 13,
    backgroundColor: '#F3F4F6', borderRadius: 12,
    alignItems: 'center',
  },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});

// ─── Caption Modal Styles ─────────────────────────────────────────
const cm = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center', marginBottom: 16,
  },
  title:   { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 14 },
  preview: {
    width: '100%', height: 180, borderRadius: 12,
    marginBottom: 14, backgroundColor: '#F3F4F6',
  },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 12,
    fontSize: 13, color: '#111827',
    minHeight: 80, lineHeight: 20,
  },
  charCount: {
    fontSize: 11, color: '#9CA3AF',
    alignSelf: 'flex-end', marginTop: 4, marginBottom: 16,
  },
  actions:   { flexDirection: 'row', gap: 10 },
  skipBtn: {
    flex: 1, height: 46, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  skipTxt:   { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  uploadBtn: {
    flex: 2, height: 46, borderRadius: 12,
    backgroundColor: BLUE,
    flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 7,
  },
  uploadTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
});

// ─── Main Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F9FAFB' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  backBtn:      { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSub:    { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: BLUE,
    justifyContent: 'center', alignItems: 'center',
  },

  // Empty State
  emptyWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySub: {
    fontSize: 13, color: '#9CA3AF',
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: BLUE, borderRadius: 12,
    paddingHorizontal: 22, paddingVertical: 12,
  },
  emptyBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Photo Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 16, gap: 8,
  },
  thumb: {
    width: THUMB_SIZE, height: THUMB_SIZE,
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  thumbImg:     { width: '100%', height: '100%' },
  thumbOverlay: {
    position: 'absolute', top: 6, right: 6,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  captionBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 5,
  },
  captionBadgeTxt: { fontSize: 9, color: '#fff', lineHeight: 13 },
  noCaptionBadge:  { position: 'absolute', bottom: 5, right: 5 },

  // Add Tile
  addTile: {
    width: THUMB_SIZE, height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    gap: 4,
  },
  addTileTxt: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
});

import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { db } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────
export interface GalleryPhoto {
  id: string;
  url: string;       // base64 data URI
  caption: string;
  storagePath: string;
  uploadedAt: any;
  uploadedBy: string;
}

// ─── Upload photo (Base64 → Firestore) ───────────────────────────
export async function uploadGalleryPhoto(
  projectId: string,
  uri: string,
  caption: string,
  userId: string,
  onProgress?: (pct: number) => void
): Promise<GalleryPhoto> {

  onProgress?.(10);

  // 1. Compress + resize the image to keep it small
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    {
      compress: 0.5,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );

  onProgress?.(50);

  // 2. Build base64 data URI
  const base64Uri = `data:image/jpeg;base64,${compressed.base64}`;

  onProgress?.(75);

  // 3. Save to Firestore
  const docRef = await addDoc(
    collection(db, 'projects', projectId, 'gallery'),
    {
      url:        base64Uri,
      caption:    caption.trim(),
      storagePath: '',        // no storage path needed
      uploadedAt: new Date(),
      uploadedBy: userId,
    }
  );

  onProgress?.(100);

  return {
    id:          docRef.id,
    url:         base64Uri,
    caption:     caption.trim(),
    storagePath: '',
    uploadedAt:  new Date(),
    uploadedBy:  userId,
  };
}

// ─── Listen to gallery photos in real-time ────────────────────────
export function listenToGallery(
  projectId: string,
  callback: (photos: GalleryPhoto[]) => void
): () => void {
  const q = query(
    collection(db, 'projects', projectId, 'gallery'),
    orderBy('uploadedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ id: d.id, ...d.data() } as GalleryPhoto))
    );
  });
}

// ─── Update caption ───────────────────────────────────────────────
export async function updateCaption(
  projectId: string,
  photoId: string,
  caption: string
): Promise<void> {
  await updateDoc(
    doc(db, 'projects', projectId, 'gallery', photoId),
    { caption: caption.trim() }
  );
}

// ─── Delete photo ─────────────────────────────────────────────────
export async function deleteGalleryPhoto(
  projectId: string,
  photoId: string,
  storagePath: string
): Promise<void> {
  // Just delete from Firestore — no storage to clean up
  await deleteDoc(doc(db, 'projects', projectId, 'gallery', photoId));
}

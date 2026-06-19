import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAMcqkSZk7wPaw5gMjKOaVle-nDzPjoHgI',
  authDomain: 'buildnext-e1dc8.firebaseapp.com',
  projectId: 'buildnext-e1dc8',
  storageBucket: 'buildnext-e1dc8.firebasestorage.app',
  messagingSenderId: '741861137757',
  appId: '1:741861137757:web:4d1a290b9d5be748b19cb4',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;

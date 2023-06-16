import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getStorage, ref } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyC47ykBZR7c1J9J1cLRtKtIVaQ9TW9sfC4',
  authDomain: 'frames-generator.firebaseapp.com',
  projectId: 'frames-generator',
  storageBucket: 'frames-generator.appspot.com',
  messagingSenderId: '535187500334',
  appId: '1:535187500334:web:28203f4fdeb29b9afc1ebf',
  measurementId: 'G-2PXD8ERLX5',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

export const storage = getStorage(app);
export const storageRef = ref(storage, 'images');

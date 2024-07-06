import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage, ref } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDC3-U8451DPS2GSy_HgWwEV7aPM4oZZiI",
  authDomain: "frame-generator.firebaseapp.com",
  projectId: "frame-generator",
  storageBucket: "frame-generator.appspot.com",
  messagingSenderId: "448364985092",
  appId: "1:448364985092:web:e7f96cc9e3f3cd42bcae51",
  measurementId: "G-R6MFWFPP96",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

export const storage = getStorage(app);
export const storageRef = ref(storage, "images");

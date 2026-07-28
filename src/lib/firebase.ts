import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyByKyMnw_Mngg_1nqDkPlcmypf-5q9brfc",
  authDomain: "vediohost-6de71.firebaseapp.com",
  projectId: "vediohost-6de71",
  storageBucket: "vediohost-6de71.firebasestorage.app",
  messagingSenderId: "531619792698",
  appId: "1:531619792698:web:331fea63dc6678132fb203",
  measurementId: "G-L4MMSEJDEK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);

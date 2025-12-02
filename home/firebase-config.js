// /home/firebase-config.js
// FULL Firebase v10 initialization for HOME page

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase v10 Modular Config (Shared for Home + Auth)

export const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.firebasestorage.app",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth + persistence
const auth = getAuth(app);
try {
  await setPersistence(auth, browserLocalPersistence);
  console.log("HOME Auth persistence enabled");
} catch (err) {
  console.warn("Persistence error:", err);
}

// Firestore
const db = getFirestore(app);

console.log("🔥 Firebase v10 HOME initialized");

// Export for use in home/script.js
export { auth, db };

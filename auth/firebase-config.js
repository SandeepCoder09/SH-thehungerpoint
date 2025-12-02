// /home/firebase-config.js
// FULL Firebase v10 modular initialization for HOME page

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// /auth/firebase-config.js
// Firebase v10 config (Auth pages)

export const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-thehunger-point.firebasestorage.app",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

// Initialize app
const app = initializeApp(firebaseConfig);

// Auth + persistence
const auth = getAuth(app);
try {
  await setPersistence(auth, browserLocalPersistence);
  console.log("🔥 HOME Auth persistence enabled");
} catch (err) {
  console.warn("⚠️ Could not set persistence:", err);
}

// Firestore
const db = getFirestore(app);

console.log("🔥 Firebase v10 (HOME) ready");

// EXPORT for home/script.js
export { auth, db };

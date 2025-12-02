// /home/firebase-config.js
// FULL Firebase v10 modular initialization for HOME page

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyBAR2bTveqOertBkpt95YId9hDPrg6S9_E",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.appspot.com",
  messagingSenderId: "312843485011",
  appId: "1:312843485011:web:347c18ee0ad022a1beaba6"
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

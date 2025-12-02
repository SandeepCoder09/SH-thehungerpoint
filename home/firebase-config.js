// /home/firebase-config.js
// Firebase v10 — FULL INITIALIZATION for Home page

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ------------------------------------------
   Firebase Config (YOUR correct project)
------------------------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAyBMrrpmW0b7vhBCgaAObL0AOGeNrga_8",
  authDomain: "sh-the-hunger-point.firebaseapp.com",
  projectId: "sh-the-hunger-point",
  storageBucket: "sh-the-hunger-point.firebasestorage.app",
  messagingSenderId: "401237282420",
  appId: "1:401237282420:web:5162604a4bb2b9799b8b21",
  measurementId: "G-4KP3RJ15E9"
};

/* ------------------------------------------
   Initialize Firebase (HOME PAGE)
------------------------------------------- */
const app = initializeApp(firebaseConfig);

/* AUTH */
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence)
  .then(() => console.log("🔥 Auth persistence enabled (home)"))
  .catch((err) => console.warn("Persistence error:", err));

/* FIRESTORE */
const db = getFirestore(app);

console.log("🔥 Firebase v10 Home initialized");

/* EXPORT for script.js */
export { auth, db };

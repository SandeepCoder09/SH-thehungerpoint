// /auth/sh-auth.js
// Global Firebase Modular Loader + Auth Guard + User Snapshot Loader

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { firebaseConfig } from "/auth/firebase-config.js";

// ------------------------------------------
// INIT FIREBASE (GLOBAL SINGLE INSTANCE)
// ------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Make globally available
window.auth = auth;
window.db = db;
window.storage = storage;

// ------------------------------------------
// AUTH PROTECTION
// ------------------------------------------
onAuthStateChanged(auth, async (user) => {
  const path = window.location.pathname;

  const isAuthPage =
    path.startsWith("/auth/") ||
    path.includes("login") ||
    path.includes("signup");

  if (!user) {
    if (!isAuthPage) window.location.href = "/auth/login.html";
    return;
  }

  // Logged-in user available globally
  window.currentUser = user;

  // Dispatch event so profile/settings can react
  document.dispatchEvent(new CustomEvent("sh-user-ready", { detail: user }));
});
// /auth/sh-auth.js
// Modular Firebase bootstrap for SH — exports auth/db/storage and a waitForAuth() helper.
// Place this as a module and load it before other modular page scripts.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { firebaseConfig } from "/auth/firebase-config.js";

// Initialize Firebase app (idempotent if called multiple times)
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  // initializeApp throws if already initialized — ignore
  // but still continue to get services
  // console.warn("Firebase already initialized");
}

// Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Expose globals for older scripts that rely on window.* (safe)
window.auth = auth;
window.db = db;
window.storage = storage;

// Ensure local persistence for auth by default (same device)
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} catch (e) {}

// When auth is ready, dispatch event; also keep a promise for waiters
let _resolveReady;
const _readyPromise = new Promise((resolve) => { _resolveReady = resolve; });

function _notifyReady() {
  // mark ready: set window.__sh_auth_ready__ and dispatch event
  window.__sh_auth_ready__ = true;
  _resolveReady(true);
  try {
    window.dispatchEvent(new Event("sh-auth-ready"));
  } catch (e) {}
}

// monitor onAuthStateChanged to populate window.currentUser for compat
onAuthStateChanged(auth, (user) => {
  window.currentUser = user || null;
  // always notify ready once we have run at least once
  _notifyReady();
});

// safety: if onAuthStateChanged didn't fire within 2s, still notify so pages don't hang
setTimeout(() => {
  if (!window.__sh_auth_ready__) _notifyReady();
}, 2000);

/**
 * waitForAuth(timeoutMs)
 * Resolves when sh-auth is ready (auth and db exposed), or rejects on timeout.
 */
export async function waitForAuth(timeoutMs = 5000) {
  if (window.__sh_auth_ready__) return Promise.resolve(true);
  let timedOut = false;
  const t = setTimeout(() => (timedOut = true), timeoutMs);
  await _readyPromise;
  clearTimeout(t);
  if (timedOut) return Promise.reject(new Error("sh-auth: timeout"));
  return true;
}

// Export the services for module users
export { auth, db, storage };

// Also set window exports so legacy scripts can use them (already done above)
window.shAuth = { waitForAuth, auth, db, storage };
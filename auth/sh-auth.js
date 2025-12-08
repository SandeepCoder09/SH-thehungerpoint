// /auth/sh-auth.js
// Modular Firebase init + small auth helpers used across the site.
// Import this as: import { auth, db, storage, requireUser, onUser } from "/auth/sh-auth.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail as _sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// You must export or provide firebaseConfig in /auth/firebase-config.js
// Example in your HTML: <script type="module" src="/auth/sh-auth.js"></script>
// If you also use a separate firebase-config.js that sets `export const firebaseConfig = {...}`,
// import that instead. Here we try to read from that file if present.
let firebaseConfig = null;
try {
  // dynamic import of your config file (if it exists and exports firebaseConfig)
  // This will fail silently if /auth/firebase-config.js doesn't export; caller pages usually load it.
  const cfg = await import("/auth/firebase-config.js");
  firebaseConfig = cfg.firebaseConfig;
} catch (err) {
  // If user already loads firebase config earlier in page via a <script> that sets window.firebaseConfig,
  // pick it up to avoid double-loading.
  firebaseConfig = window.firebaseConfig || window.firebaseConfigGlobal || firebaseConfig;
}

if (!firebaseConfig) {
  console.error("sh-auth.js: no firebaseConfig found at /auth/firebase-config.js or window.firebaseConfig");
  // create a dummy config to avoid throwing on import; any usage should fail gracefully
  firebaseConfig = {};
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// internal small state
let _user = null;
let _ready = false;
const _waiters = [];

/**
 * requireUser(callback)
 * - callback will be invoked with the Firebase User object when there's a logged-in user.
 * - if no user -> will redirect to /auth/login.html (preserves next param).
 */
export function requireUser(cb) {
  // If already ready and user present — call immediately
  if (_ready && _user) {
    cb(_user);
    return;
  }

  // Wait until auth state resolves
  _waiters.push(cb);
}

// onUser(cb): subscribe to auth changes; cb gets (user|null)
export function onUser(cb) {
  cb(_user);
  // return unsubscribe handle
  return onAuthStateChanged(auth, (u) => cb(u));
}

// send a password reset (wrapper)
export async function sendPasswordResetEmail(email) {
  return _sendPasswordResetEmail(auth, email);
}

// internal helper to flush waiters when user available
function _flushWaiters() {
  while (_waiters.length) {
    const fn = _waiters.shift();
    try {
      fn(_user);
    } catch (err) {
      console.error("sh-auth waiter error:", err);
    }
  }
}

// listen to auth state and set globals
onAuthStateChanged(auth, (user) => {
  _user = user;
  _ready = true;

  // dispatch DOM events so other scripts can hook into them
  window.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
  if (user) {
    _flushWaiters();
  } else {
    window.dispatchEvent(new CustomEvent("user-signed-out", {}));
  }

  // If no user present and requireUser was called earlier, redirect to login preserving path
  if (!user && _waiters.length > 0) {
    const currentPath = window.location.pathname + (window.location.search || "");
    const encodedNext = encodeURIComponent(currentPath);
    // small delay so caller can still run any cleanup
    setTimeout(() => {
      window.location.href = `/auth/login.html?next=${encodedNext}`;
    }, 50);
  }
});

// helpful debug export
export function isReady() {
  return _ready;
}

export function currentUser() {
  return _user;
}

// default export (for convenience)
export default {
  auth,
  db,
  storage,
  requireUser,
  onUser,
  sendPasswordResetEmail,
  currentUser,
  isReady,
};